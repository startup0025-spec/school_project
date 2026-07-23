# Cycle 2 Refined Design: Audio CDN Streaming & Offline Cache Manager

**Document Version**: 2.0.0  
**Phase**: Refined Architecture & Implementation Design  
**Target Module**: Audio CDN Streaming, Offline Caching, & Concurrency Control  
**Author**: Lead Architect (explorer_architect / BERRY 🍎)

---

## Executive Summary

This document presents the **Cycle 2 Refined Design** addressing the technical critique from the Principal Critic and the subsequent pivot directives from the parent agent. 

Following parent directives, all map projection and coordinate mapping tasks are immediately halted and excluded from this design. The focus is 100% on providing a robust, highly resilient, and race-free architecture for **Audio CDN Streaming and Offline Cache Management** within the Anyway the Sea mobile application.

Key design refinements included in this proposal:
1. **Dependency Overhaul**: Adding native Expo modules (`expo-file-system` and `expo-network`) to ensure stable local storage and network discovery.
2. **Double-Layered Offline Detection**: Verifying not just local network presence but true end-to-end reachability to the CDN.
3. **Playback Request ID Lock**: A concurrency control mechanism in the audio engine to eliminate orphaned sound leaks during rapid interactions.
4. **SWR Cache Warm-up Flow**: An automated background pre-fetching pattern linking the spot data fetch to audio cache warming.

---

## 1. Dependencies & Package Strategy

To support persistent cache writes and network status checks, we introduce two native Expo modules. This section details their integration and alignment with the application bundle.

### 1.1 Package Additions
We recommend adding the following entries to the `dependencies` block of `mobile/package.json`:

```json
"dependencies": {
  "expo-av": "^16.0.8",
  "expo-dev-client": "~6.0.21",
  "expo-file-system": "~18.0.8",
  "expo-network": "~18.0.8",
  "expo-notifications": "^57.0.3",
  "expo-task-manager": "^57.0.2"
}
```

### 1.2 Installation & SDK Alignment
Installing native modules manually can lead to compile-time version mismatches with the active Expo SDK version (`~54.0.27`). To guarantee version consistency alignment, developers must install these dependencies using `npx expo install`:

```bash
npx expo install expo-file-system expo-network
```

**Why this is safe:**
* **Metro Bundle Resolution**: The `npx expo install` command inspects `mobile/package.json` to find the target Expo SDK version and automatically resolves the semver range to the correct verified version (`~18.0.8` for both modules in Expo SDK 54).
* **Native Linkage**: Expo SDK 54 manages autolinking during the prebuild phase, eliminating manual CocoaPods or Gradle configuration.

---

## 2. Double-Layered Offline Detection Logic

Relying solely on local network interfaces (e.g., whether Wifi is enabled) often yields false positives where the device is connected to a router that has no actual internet access. This is especially critical in coastal or mountainous zones. 

We propose a **double-layered reachability check**:
1. **Layer 1 (Local Medium Check)**: Use `expo-network` to check basic interface availability. If no active medium exists, immediately fail fast.
2. **Layer 2 (True Internet Reachability)**: Proactively perform a pre-flight fetch `HEAD` check to the CDN with a `2000ms` timeout. If the server is unreachable or times out, transition immediately to the offline fallbacks.

### 2.1 Connectivity Service Implementation Sketch
Create a new file `mobile/lib/services/offline_detection_service.ts`:

```typescript
import * as Network from 'expo-network';

/**
 * Checks true internet reachability to the CDN.
 * 
 * 1. Checks if a network interface is connected.
 * 2. Attempts a pre-flight HEAD request to the CDN with a 2000ms timeout.
 */
export async function checkOnlineStatus(testUrl: string): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    
    // Fast-fail if the interface says it is disconnected
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      console.log('[Offline Detection] Local interface disconnected or unreachable.');
      return false;
    }

    // Pre-flight HEAD check with a strict timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(testUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Offline Detection] Pre-flight reachability check timed out after 2000ms.');
    } else {
      console.warn('[Offline Detection] Pre-flight check failed:', error.message || error);
    }
    return false;
  }
}
```

---

## 3. Concurrency and Playback Request ID Lock

Android and iOS systems restrict active concurrent audio channels (often limiting devices to 3-4 simultaneous tracks). The default async execution of `Audio.Sound.createAsync()` in `expo-av` introduces a race condition when the user clicks spots rapidly:
1. "Spot A" click triggers `playAmbientSound("river")`.
2. The asynchronous file loading starts.
3. "Spot B" click immediately triggers `playAmbientSound("sea")` before the river sound resolves.
4. The first stream resolves *after* the second stream starts, causing both ambient tracks to play concurrently, creating an **audio leak** that cannot be controlled or stopped since the state variables were overwritten.

### 3.1 Playback Request ID Lock Mechanism
To resolve this, we introduce an auto-incrementing **request token lock**:
* Every invocation of `playAmbientSound` increments a global token: `activePlaybackRequestId`.
* The local execution context captures this ID as `currentRequestId`.
* At every await boundary (after SWR, cache resolution, and sound initialization), the script checks if `currentRequestId !== activePlaybackRequestId`.
* If a mismatch is detected, the resource is immediately discarded via `unloadAsync()` and execution terminates.

### 3.2 Refined Audio Engine Service
Refined file `mobile/lib/services/audio_engine_service.ts`:

```typescript
import { Audio } from 'expo-av';
import { resolveAudioSource } from './audio_caching_service';
import { checkOnlineStatus } from './offline_detection_service';

let ambientSound: Audio.Sound | null = null;
let windSound: Audio.Sound | null = null;
let sirenSound: Audio.Sound | null = null;

// Global request ID to track the latest user action
let activePlaybackRequestId = 0;
const CDN_BASE_URL = 'https://haetae05.github.io/Anyway_the_Sea/sounds/';

/**
 * Configure the global audio session for background playback.
 */
export async function configureBackgroundAudioSession(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    });
    console.log('[Audio Engine] Background session mode registered.');
  } catch (error) {
    console.error('[Audio Engine] Failed to configure background audio session:', error);
  }
}

/**
 * Stops all currently playing sounds and explicitly unloads them.
 * This guarantees native channel release.
 */
export async function stopAmbientSound(): Promise<void> {
  try {
    if (ambientSound) {
      await ambientSound.stopAsync();
      await ambientSound.unloadAsync();
      ambientSound = null;
    }
    if (windSound) {
      await windSound.stopAsync();
      await windSound.unloadAsync();
      windSound = null;
    }
    if (sirenSound) {
      await sirenSound.stopAsync();
      await sirenSound.unloadAsync();
      sirenSound = null;
    }
    console.log('[Audio Engine] Stopped and unloaded all active audio tracks.');
  } catch (err) {
    console.error('[Audio Engine] Sound stop and release failed:', err);
  }
}

/**
 * Plays ambient sound matching the selected waterType, with concurrency protection.
 */
export async function playAmbientSound(waterType: string | undefined): Promise<void> {
  const currentRequestId = ++activePlaybackRequestId;
  console.log(`[Audio Engine] [Req #${currentRequestId}] Requested sound for: ${waterType || 'default'}`);

  try {
    // 1. Instantly stop and unload prior players
    await stopAmbientSound();

    const soundFile = waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';
    const cdnUrl = `${CDN_BASE_URL}${soundFile}`;

    // 2. Double-layered network check
    const isOnline = await checkOnlineStatus(cdnUrl);
    
    // Concurrency check 1 (Network fetch boundary)
    if (currentRequestId !== activePlaybackRequestId) {
      console.log(`[Audio Engine] [Req #${currentRequestId}] Aborted: superseded before cache resolution.`);
      return;
    }

    // 3. Resolve the path (Local Cache -> CDN Stream -> Bundled Fallback)
    const ambientSource = await resolveAudioSource(soundFile, isOnline);
    const windSource = await resolveAudioSource('white_noise_wind.mp3', isOnline);

    // Concurrency check 2 (Source resolution boundary)
    if (currentRequestId !== activePlaybackRequestId) {
      console.log(`[Audio Engine] [Req #${currentRequestId}] Aborted: superseded during source resolution.`);
      return;
    }

    // 4. Load ambient sound asset
    console.log(`[Audio Engine] [Req #${currentRequestId}] Loading ambient track...`);
    const { sound: ambient } = await Audio.Sound.createAsync(ambientSource);

    // Concurrency check 3 (Ambient load boundary)
    if (currentRequestId !== activePlaybackRequestId) {
      console.log(`[Audio Engine] [Req #${currentRequestId}] Aborted: superseded during ambient load. Unloading...`);
      await ambient.unloadAsync();
      return;
    }

    ambientSound = ambient;
    await ambientSound.setIsLoopingAsync(true);
    await ambientSound.playAsync();
    console.log(`[Audio Engine] [Req #${currentRequestId}] Ambient track playing.`);

    // 5. Load and mix wind noise
    console.log(`[Audio Engine] [Req #${currentRequestId}] Loading wind white noise...`);
    const { sound: wind } = await Audio.Sound.createAsync(windSource);

    // Concurrency check 4 (Wind load boundary)
    if (currentRequestId !== activePlaybackRequestId) {
      console.log(`[Audio Engine] [Req #${currentRequestId}] Aborted: superseded during wind load. Unloading...`);
      await wind.unloadAsync();
      return;
    }

    windSound = wind;
    await windSound.setIsLoopingAsync(true);
    await windSound.playAsync();
    console.log(`[Audio Engine] [Req #${currentRequestId}] Wind track playing. Mixing complete.`);

  } catch (err) {
    console.error(`[Audio Engine] [Req #${currentRequestId}] Execution failed:`, err);
  }
}

/**
 * Emergency danger siren
 */
export async function playEmergencySiren(): Promise<void> {
  const currentRequestId = ++activePlaybackRequestId;
  console.log(`[Audio Engine] [Req #${currentRequestId}] PLAYING EMERGENCY SIREN!`);

  try {
    await stopAmbientSound();

    const isOnline = await checkOnlineStatus(`${CDN_BASE_URL}emergency_siren.wav`);
    
    if (currentRequestId !== activePlaybackRequestId) return;

    const sirenSource = await resolveAudioSource('emergency_siren.wav', isOnline);

    if (currentRequestId !== activePlaybackRequestId) return;

    const { sound: siren } = await Audio.Sound.createAsync(sirenSource);

    if (currentRequestId !== activePlaybackRequestId) {
      await siren.unloadAsync();
      return;
    }

    sirenSound = siren;
    await sirenSound.setIsLoopingAsync(true);
    await sirenSound.setVolumeAsync(1.0);
    await sirenSound.playAsync();
  } catch (err) {
    console.error(`[Audio Engine] [Req #${currentRequestId}] Siren failed:`, err);
  }
}
```

---

## 4. SWR Cache Warm-up Hook Pattern

To guarantee a Calm UX where audio playback is instantaneous upon tapping a spot, the application must not wait for the user to select a spot before caching the audio. Instead, we link SWR data fetching of spots to background audio pre-fetching.

### 4.1 Custom SWR React Hook
The custom hook `useSpots` wraps the SWR fetcher (utilizing the cached `getPlaces` function under the hood). A `useEffect` hook monitors changes in the fetched data and triggers background downloads.

Create a new file `mobile/hooks/useSpots.ts`:

```typescript
import useSWR from 'swr';
import { useEffect } from 'react';
import { getPlaces } from '../core_engine/src/database/local_places';
import { prefetchAudioAssets } from '../lib/services/audio_caching_service';

/**
 * Custom hook to manage SWR fetching of spots and orchestrate background audio cache warming.
 */
export function useSpots() {
  // SWR fetches location spots (stale data served from AsyncStorage first, revalidated in background)
  const { data: spots, error, mutate } = useSWR('/api/spots', getPlaces, {
    revalidateOnFocus: false, // Prevent redundant checks on window focus
    dedupingInterval: 60000,  // Deduplicate requests within 1 minute
  });

  useEffect(() => {
    // Return early if there are no spots fetched
    if (!spots || spots.length === 0) return;

    // Extract necessary sound assets dynamically based on current spots
    const audioFilesToWarm = new Set<string>();
    
    spots.forEach((spot) => {
      const waterType = spot.waterType; // 'sea' or 'river'
      audioFilesToWarm.add(waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3');
    });

    // Always ensure background tracks and safety sirens are cached
    audioFilesToWarm.add('white_noise_wind.mp3');
    audioFilesToWarm.add('emergency_siren.wav');

    const filesArray = Array.from(audioFilesToWarm);

    console.log(`[Audio Warmup] Starting background cache warming for: ${filesArray.join(', ')}`);
    
    // Warm the cache asynchronously in the background
    prefetchAudioAssets(filesArray).catch((err) => {
      console.warn('[Audio Warmup] Background cache warming failed:', err);
    });
  }, [spots]);

  return {
    spots,
    isLoading: !spots && !error,
    isError: error,
    mutate,
  };
}
```

### 4.2 Updating the Cache Manager for Bulk Downloads
We must refine `audio_caching_service.ts` to accept a dynamic list of files to download:

```typescript
import * as FileSystem from 'expo-file-system';

const CDN_BASE_URL = 'https://haetae05.github.io/Anyway_the_Sea/sounds/';
const CACHE_DIR = `${FileSystem.documentDirectory}sounds/`;

export const BUNDLED_SOUNDS: Record<string, any> = {
  'ambient_sea.mp3': require('../../assets/sounds/ambient_sea.mp3'),
  'ambient_river.mp3': require('../../assets/sounds/ambient_river.mp3'),
  'white_noise_wind.mp3': require('../../assets/sounds/white_noise_wind.mp3'),
  'emergency_siren.wav': require('../../assets/sounds/emergency_siren.wav'),
};

/**
 * Prefetches and stores a specified array of audio files in local persistent storage.
 */
export async function prefetchAudioAssets(filenames: string[]): Promise<void> {
  try {
    // 1. Verify existence of the cache directory
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }

    // 2. Perform concurrent check-and-download tasks
    await Promise.all(
      filenames.map(async (filename) => {
        const localUri = `${CACHE_DIR}${filename}`;
        const fileInfo = await FileSystem.getInfoAsync(localUri);

        if (!fileInfo.exists) {
          const remoteUrl = `${CDN_BASE_URL}${filename}`;
          console.log(`[Audio Cache] Downloading missing asset: ${filename}`);
          await FileSystem.downloadAsync(remoteUrl, localUri);
        } else {
          console.log(`[Audio Cache] Asset already present in cache: ${filename}`);
        }
      })
    );
    console.log('[Audio Cache] Cache warming batch completed.');
  } catch (error) {
    console.error('[Audio Cache] Batch prefetching failed:', error);
    throw error; // Let caller catch and log
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
      console.log(`[Audio Cache] Resolved to persistent local cache: ${localUri}`);
      return { uri: localUri };
    }

    if (isOnline) {
      console.log(`[Audio Cache] Cache miss. Streaming from CDN: ${CDN_BASE_URL}${filename}`);
      // Asynchronously cache the file in background for subsequent offline play
      FileSystem.downloadAsync(`${CDN_BASE_URL}${filename}`, localUri).catch((err) => {
        console.warn(`[Audio Cache] Failed to write background cache: ${filename}`, err);
      });
      return { uri: `${CDN_BASE_URL}${filename}` };
    }
  } catch (err) {
    console.warn(`[Audio Cache] Error checking cache for ${filename}:`, err);
  }

  // Final fallback to bundled asset
  console.log(`[Audio Cache] Resolved to binary-bundled fallback: ${filename}`);
  return BUNDLED_SOUNDS[filename];
}
```

---

## 5. Architectural Quality Checks

1. **Native Channel Leak Prevention**: Explicitly stops and unloads all three channels (`ambientSound`, `windSound`, `sirenSound`) before every state change. This ensures Android channels are released cleanly.
2. **Offline Resilience**: Combining `expo-network` check with a true pre-flight HEAD call prevents the application from locking up on cold starts in cellular dead zones.
3. **Optimized Threading**: Pre-fetching runs concurrently under React `useEffect` in the background, keeping UI frames smooth (60fps) during sound asset warming.
