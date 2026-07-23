# Anyway, the Sea — Cycle 1 Architecture Proposal (Draft)
**Document Version**: 1.0.0  
**Phase**: Cycle 1 Draft  
**Target Module**: Map Coordinate Projection & Audio CDN Streaming  
**Author**: Lead Architect (explorer_architect / BERRY 🍎)

---

## Executive Summary

This proposal outlines the technical architecture and mathematical designs for two major system upgrades in the *Anyway, the Sea* mobile application:
1. **Map Projection Overhaul**: Transitioning the map screen from static mock pin coordinates to a dynamic, real-world coordinate mapping engine. This converts WGS84 GPS coordinates (latitude/longitude) of the user and places onto the static custom illustration `quiet-map.png` while dynamically correcting for aspect ratio cropping (`resizeMode="cover"`).
2. **Audio CDN Streaming Overhaul**: Migrating local audio assets to a Content Delivery Network (CDN) to reduce initial app bundle size, streaming via `expo-av`, and caching/pre-fetching persistently via `expo-file-system` to support robust, offline-capable playback with a triple-redundant fallback scheme.

---

## 1. Map Projection Overhaul

### 1.1 The Coordinate Alignment Problem
In the current implementation of `mobile/app/(tabs)/map.tsx`, map coordinates are statically defined as mock percentages:
```typescript
{ left: `${spot.pin.x * 100}%`, top: `${spot.pin.y * 100}%` }
```
When transitioning to a dynamic database of places generated from TourAPI (containing WGS84 `latitude` and `longitude`), we need to dynamically calculate `(x, y)` relative coordinates on the static map image.

Furthermore, because the map screen renders the background image using `resizeMode="cover"` inside a container of arbitrary device aspect ratios:
* The image is scaled and cropped (either horizontally or vertically) to fill the parent container.
* Pin percentage positioning relative to the container boundaries will *not* align with the visual elements on the scaled/cropped image, causing severe visual drift across different screen sizes.

---

### 1.2 Mathematical Projection Models

To convert a WGS84 coordinate $(Lat, Lng)$ to image relative coordinates $(x_{\text{img}}, y_{\text{img}}) \in [0, 1] \times [0, 1]$, three models are proposed:

#### Model A: Equirectangular (Linear) Bounding Box Model
Assuming the static map is north-up (no rotation or skewing) and represents a small geographical region (Busan spans only $\approx 0.35^{\circ}$ latitude, making earth curvature distortion negligible):
$$x_{\text{img}} = \frac{Lng - Lng_{\min}}{Lng_{\max} - Lng_{\min}}$$
$$y_{\text{img}} = \frac{Lat_{\max} - Lat}{Lat_{\max} - Lat_{\min}}$$
*Note: $y_{\text{img}} = 0$ is at the top of the image (corresponding to $Lat_{\max}$), and $y_{\text{img}} = 1$ is at the bottom of the image (corresponding to $Lat_{\min}$).*

#### Model B: Web Mercator Projection Model
If the static map was exported directly from a standard web mapping service (e.g., OpenStreetMap, Mapbox, or Google Maps) using EPSG:3857:
$$y_{\text{mercator}}(Lat) = \ln\left(\tan\left(\frac{\pi}{4} + \frac{Lat \cdot \pi}{360}\right)\right)$$
$$x_{\text{img}} = \frac{Lng - Lng_{\min}}{Lng_{\max} - Lng_{\min}}$$
$$y_{\text{img}} = \frac{y_{\text{mercator}}(Lat_{\max}) - y_{\text{mercator}}(Lat)}{y_{\text{mercator}}(Lat_{\max}) - y_{\text{mercator}}(Lat_{\min})}$$

#### Model C: 3-Point Affine Calibration Model
If the static map `quiet-map.png` is an artistic, hand-drawn illustration with slight tilt, rotation, or non-linear scaling, a rectangular bounding box will fail. We define a 2D affine transformation mapping:
$$x_{\text{img}} = a_1 \cdot Lng + a_2 \cdot Lat + a_3$$
$$y_{\text{img}} = b_1 \cdot Lng + b_2 \cdot Lat + b_3$$
To calibrate this model, we register **three anchor points** (such as three distinct water spots in Busan: e.g., Dadaepo Beach in the southwest, Oncheoncheon in the center, and Haeundae in the east) where both WGS84 coordinates $(Lat_i, Lng_i)$ and relative image coordinates $(x_i, y_i)$ are known.
We solve the linear system for the mapping coefficients:
$$\begin{pmatrix} x_1 \\ x_2 \\ x_3 \end{pmatrix} = \begin{pmatrix} Lng_1 & Lat_1 & 1 \\ Lng_2 & Lat_2 & 1 \\ Lng_3 & Lat_3 & 1 \end{pmatrix} \begin{pmatrix} a_1 \\ a_2 \\ a_3 \end{pmatrix}$$
$$\begin{pmatrix} y_1 \\ y_2 \\ y_3 \end{pmatrix} = \begin{pmatrix} Lng_1 & Lat_1 & 1 \\ Lng_2 & Lat_2 & 1 \\ Lng_3 & Lat_3 & 1 \end{pmatrix} \begin{pmatrix} b_1 \\ b_2 \\ b_3 \end{pmatrix}$$
Using Cramer's Rule or Matrix Inversion in TypeScript, the coefficients are computed once at startup or compiled in as constants.

---

### 1.3 Crop Compensation for `resizeMode="cover"`

To align pins correctly when the map image is cropped dynamically to cover a screen of dimensions $(W_c, H_c)$, we calculate the rendering scale and offset of the image:

Let:
* $(W_i, H_i)$ be the natural pixel dimensions of `quiet-map.png` (e.g., $1024 \times 1024$).
* $(W_c, H_c)$ be the layout dimensions of the container view (obtained via React Native's `onLayout`).

1. **Calculate scale factor ($s$)** under `cover`:
   $$s = \max\left(\frac{W_c}{W_i}, \frac{H_c}{H_i}\right)$$
2. **Calculate rendered dimensions** of the image:
   $$W_r = s \cdot W_i, \quad H_r = s \cdot H_i$$
3. **Calculate translation offsets** (as the image is centered):
   $$dx = \frac{W_c - W_r}{2}$$
   $$dy = \frac{H_c - H_r}{2}$$
4. **Convert image-relative coordinate $(x_{\text{img}}, y_{\text{img}})$ to container-relative coordinate $(x_{\text{screen}}, y_{\text{screen}})$**:
   $$x_{\text{screen}} = \frac{x_{\text{img}} \cdot W_r + dx}{W_c}$$
   $$y_{\text{screen}} = \frac{y_{\text{img}} \cdot H_r + dy}{H_c}$$
   *These screen percentage coordinates are directly applied to the pin wrapper's `left` and `top` properties.*

---

### 1.4 Code Implementation Sketch (`useMapProjection.ts`)

A reusable custom hook is proposed to coordinate this projection and crop-compensation:

```typescript
import { useState } from 'react';
import { LayoutChangeEvent } from 'react-native';

export interface MapBounds {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

// Bounding box for Busan static map illustration (Calibrated values)
export const BUSAN_MAP_BOUNDS: MapBounds = {
  latMin: 35.02,  // Southernmost (e.g. Dadaepo Beach)
  latMax: 35.29,  // Northernmost (e.g. Geumjeongsan area)
  lngMin: 128.79, // Westernmost (e.g. Nakdong River Estuary)
  lngMax: 129.28, // Easternmost (e.g. Haeundae/Songjeong)
};

export interface ImageDimensions {
  width: number;
  height: number;
}

export function useMapProjection(
  bounds: MapBounds = BUSAN_MAP_BOUNDS,
  imageSize: ImageDimensions = { width: 1080, height: 1080 } // Natural dimensions of quiet-map.png
) {
  const [containerSize, setContainerSize] = useState<ImageDimensions | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const getScreenCoordinates = (latitude: number, longitude: number) => {
    // 1. Calculate relative coordinates on the original image (Model A - Linear)
    const xImg = (longitude - bounds.lngMin) / (bounds.lngMax - bounds.lngMin);
    const yImg = (bounds.latMax - latitude) / (bounds.latMax - bounds.latMin);

    // Clamping coordinates within [0, 1] bounds
    const xClamped = Math.max(0, Math.min(1, xImg));
    const yClamped = Math.max(0, Math.min(1, yImg));

    if (!containerSize) {
      // Fallback if layout hasn't occurred yet
      return { left: `${xClamped * 100}%`, top: `${yClamped * 100}%` };
    }

    const { width: Wc, height: Hc } = containerSize;
    const { width: Wi, height: Hi } = imageSize;

    // 2. Compute resizeMode="cover" mapping
    const scale = Math.max(Wc / Wi, Hc / Hi);
    const Wr = scale * Wi;
    const Hr = scale * Hi;

    const dx = (Wc - Wr) / 2;
    const dy = (Hc - Hr) / 2;

    const xScreenPixel = xClamped * Wr + dx;
    const yScreenPixel = yClamped * Hr + dy;

    // 3. Return percentage positions relative to the screen container
    return {
      left: `${(xScreenPixel / Wc) * 100}%`,
      top: `${(yScreenPixel / Hc) * 100}%`,
    };
  };

  return { handleLayout, getScreenCoordinates };
}
```

---

## 2. Audio CDN Streaming Overhaul

### 2.1 CDN Hosting & Paths
Local ambient audio assets (currently loaded via local `require`) will be hosted on GitHub Pages CDN (aligned with the place database SWR flow) to support lightweight bundling and on-demand streaming:
* **Base URL**: `https://haetae05.github.io/Anyway_the_Sea/sounds/`
* **File Mappings**:
  * `ambient_sea.mp3` $\rightarrow$ `https://haetae05.github.io/Anyway_the_Sea/sounds/ambient_sea.mp3`
  * `ambient_river.mp3` $\rightarrow$ `https://haetae05.github.io/Anyway_the_Sea/sounds/ambient_river.mp3`
  * `white_noise_wind.mp3` $\rightarrow$ `https://haetae05.github.io/Anyway_the_Sea/sounds/white_noise_wind.mp3`
  * `emergency_siren.wav` $\rightarrow$ `https://haetae05.github.io/Anyway_the_Sea/sounds/emergency_siren.wav`

---

### 2.2 Pre-fetching and Caching Strategy (`expo-file-system`)

For a Calm UX, the app must remain functional in remote coastal zones or mountain streams with poor or non-existent cellular connectivity (0B/s). Therefore, streaming must support a **Persistent Local Cache**.

#### Cache Storage Directory
We will use `FileSystem.documentDirectory` rather than `FileSystem.cacheDirectory` for audio assets.
* *Rationale*: `FileSystem.cacheDirectory` files can be deleted silently by the operating system when the device runs low on storage. For safety features (like the emergency siren), storage loss is unacceptable. `FileSystem.documentDirectory` guarantees the downloaded audio files remain persistent.

#### Pre-fetching Mechanism
A dedicated background service (`audio_caching_service.ts`) will pre-fetch all CDN audio files on app startup (or when background location tracking is activated), downloading them sequentially.

---

### 2.3 Triple-Redundant Offline Fallback Strategy

When a place's water type changes and a sound is triggered:
1. **Try Local Cache**: Read the local persistent file path (`FileSystem.documentDirectory + 'sounds/...'`). If it exists, load and play it.
2. **Try CDN Stream (Online)**: If the local file does not exist, check network connectivity. If online, stream the audio from the CDN URL and concurrently trigger a background download to cache the file for future offline use.
3. **Try Bundled Fallback (Offline)**: If the local file does not exist and the network is offline (cold start in a dead zone), fallback to the local bundled assets embedded in the application binary via static lookups.

```
                  Trigger Sound Playback
                           │
                           ▼
                 Is file cached locally?
                 (in DocumentDirectory)
                       /       \
                [Yes] /         \ [No]
                     /           \
                    ▼             ▼
             Play Local File    Is device online?
                                  /       \
                           [Yes] /         \ [No]
                                /           \
                               ▼             ▼
                        Stream CDN Url    Play Bundled Asset
                        & Cache in Bg     (require fallback)
```

---

### 2.4 Code Implementation Sketch (`audio_caching_service.ts`)

```typescript
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

const CDN_BASE_URL = 'https://haetae05.github.io/Anyway_the_Sea/sounds/';
const SOUND_FILES = ['ambient_sea.mp3', 'ambient_river.mp3', 'white_noise_wind.mp3', 'emergency_siren.wav'];
const CACHE_DIR = `${FileSystem.documentDirectory}sounds/`;

// Local require map for bundle fallbacks (strictly static for Metro compiler)
export const BUNDLED_SOUNDS: Record<string, any> = {
  'ambient_sea.mp3': require('../../assets/sounds/ambient_sea.mp3'),
  'ambient_river.mp3': require('../../assets/sounds/ambient_river.mp3'),
  'white_noise_wind.mp3': require('../../assets/sounds/white_noise_wind.mp3'),
  'emergency_siren.wav': require('../../assets/sounds/emergency_siren.wav'),
};

/**
 * Initializes cache directory and downloads all CDN audio files
 */
export async function prefetchAudioAssets(onProgress?: (progress: number) => void): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }

    let completed = 0;
    for (const filename of SOUND_FILES) {
      const localUri = `${CACHE_DIR}${filename}`;
      const fileInfo = await FileSystem.getInfoAsync(localUri);

      if (!fileInfo.exists) {
        const remoteUrl = `${CDN_BASE_URL}${filename}`;
        console.log(`[Audio Cache] Downloading: ${filename}`);
        await FileSystem.downloadAsync(remoteUrl, localUri);
      } else {
        console.log(`[Audio Cache] Already cached: ${filename}`);
      }

      completed++;
      if (onProgress) {
        onProgress(completed / SOUND_FILES.length);
      }
    }
    console.log('[Audio Cache] Prefetching completed successfully.');
  } catch (error) {
    console.error('[Audio Cache] Prefetching failed:', error);
  }
}

/**
 * Resolves the playback source (local file, CDN stream, or bundled fallback)
 */
export async function resolveAudioSource(filename: string, isOnline: boolean): Promise<any> {
  const localUri = `${CACHE_DIR}${filename}`;
  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      console.log(`[Audio Engine] Resolving to Cached Local File: ${localUri}`);
      return { uri: localUri };
    }

    if (isOnline) {
      console.log(`[Audio Engine] Cache miss. Resolving to CDN Stream: ${CDN_BASE_URL}${filename}`);
      // Trigger background download to cache the file
      FileSystem.downloadAsync(`${CDN_BASE_URL}${filename}`, localUri).catch((err) => {
        console.warn(`[Audio Cache] Failed to cache file in background: ${filename}`, err);
      });
      return { uri: `${CDN_BASE_URL}${filename}` };
    }
  } catch (err) {
    console.warn(`[Audio Engine] Error during cache resolution for ${filename}`, err);
  }

  // Final fallback to bundled asset
  console.log(`[Audio Engine] Resolving to Bundled Fallback: ${filename}`);
  return BUNDLED_SOUNDS[filename];
}
```

---

### 2.5 Integrating Caching with `audio_engine_service.ts`

To integrate this caching logic, `playAmbientSound` and `playEmergencySiren` in `mobile/lib/services/audio_engine_service.ts` will be updated to resolve their sources dynamically:

```typescript
import { Audio } from 'expo-av';
import { NetInfo } from '@react-native-community/netinfo'; // Assuming NetInfo is present or checking network status
import { resolveAudioSource } from './audio_caching_service';

let ambientSound: Audio.Sound | null = null;
let windSound: Audio.Sound | null = null;
let sirenSound: Audio.Sound | null = null;

// Helper to determine network connectivity
async function checkOnlineStatus(): Promise<boolean> {
  // Can be implemented using expo-network or @react-native-community/netinfo
  // Fallback to true if unknown, letting expo-av handle potential streaming errors
  return true; 
}

export async function playAmbientSound(waterType: string | undefined): Promise<void> {
  try {
    await stopAmbientSound();
    
    const isOnline = await checkOnlineStatus();
    const soundFile = waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';
    
    // Resolve dynamic playback source (Cache -> CDN -> Bundle)
    const ambientSource = await resolveAudioSource(soundFile, isOnline);
    const windSource = await resolveAudioSource('white_noise_wind.mp3', isOnline);

    const { sound: ambient } = await Audio.Sound.createAsync(ambientSource);
    ambientSound = ambient;
    await ambientSound.setIsLoopingAsync(true);
    await ambientSound.playAsync();

    const { sound: wind } = await Audio.Sound.createAsync(windSource);
    windSound = wind;
    await windSound.setIsLoopingAsync(true);
    await windSound.playAsync();
  } catch (err) {
    console.error('[Audio Engine] Playback failed:', err);
  }
}
```

---

## 3. Architecture Review & Safety Assessment

1. **Memory Footprint**: `expo-file-system` caching prevents repeatedly loading large sound files into memory from remote network channels. File resolution maps directly to local URIs which the OS handles efficiently.
2. **Offline Resilience**: The triple-redundant logic ensures zero app crashes on network disconnects. A full offline state will gracefully transition to bundled assets.
3. **Calm UX Principles**:
   * Pre-fetching happens silently in the background.
   * Map pins do not stutter or reload because screen boundaries are calculated dynamically via a simple, zero-latency TypeScript coordinate transform.
4. **Calibration Safety**: The 3-Point Affine Calibration Model provides an elegant correction mechanism if the static `quiet-map.png` image becomes distorted or rotated, preventing manual visual correction hacks in UI files.
