# Technical Critique: Cycle 1 Draft Architecture Proposal

**Document Version**: 1.0.0  
**Phase**: Cycle 2 Review & Critique  
**Target Module**: Map Coordinate Projection & Audio CDN Streaming  
**Author**: Principal Critic (critic_reviewer / BERRY 🍎)

---

## Executive Review Summary

This document presents a technical critique of the Lead Architect's Cycle 1 Draft Architecture Proposal. While the initial proposal provides a solid conceptual foundation, it contains critical gaps that would cause spatial alignment failures, compilation errors, network crashes, and audio leaks. 

Key issues addressed in this critique:
1. **Spatial Inversion on the Static Map**: The physical layout of `quiet-map.png` is vertically inverted (Sea at the top, Mountains at the bottom) compared to standard WGS84 geography (Sea to the South, Mountains to the North). Model A/B will map coordinates upside down.
2. **Missing Dependencies**: `expo-file-system` is not defined in `mobile/package.json`.
3. **Offline Detection Overhead**: The offline detection stack requires a robust, low-overhead design.
4. **Audio Concurrency Race Conditions**: `expo-av` async creation lacks request synchronization, leading to orphaned audio streams and channel exhaustion.
5. **SWR & Cache Sync**: A formal architecture is required to link SWR data fetching with the background audio cache warm-up.

---

## 1. Map Projection: The Spatial Inversion Mismatch

### 1.1 The Inversion Problem Analyzed
The static map image `quiet-map.png` features:
* **Top portion**: Sea, beaches, and coastal shorelines.
* **Bottom portion**: Mountains, hills, and inland regions.

In real-world geography (and standard WGS84 projection of Busan):
* **South** (lower latitude, e.g., $\approx 35.02^\circ$ N) is the Sea.
* **North** (higher latitude, e.g., $\approx 35.29^\circ$ N) is the mountain range (Geumjeongsan, etc.).

If we apply the proposed **Model A (Linear Equirectangular)**:
$$y_{\text{img}} = \frac{Lat_{\max} - Lat}{Lat_{\max} - Lat_{\min}}$$
* As latitude decreases (moving South towards the Sea), $y_{\text{img}}$ approaches $1$ (mapping to the bottom of the image).
* As latitude increases (moving North towards the Mountains), $y_{\text{img}}$ approaches $0$ (mapping to the top of the image).

**Consequence**: Sea-based spots (e.g., Haeundae) will be rendered on the mountains at the bottom of the screen, and mountain-based spots will be rendered in the ocean at the top of the screen.

### 1.2 Resolving the Inversion (Mathematical Solutions)

To map WGS84 coordinates $(Lat, Lng)$ correctly to image-relative coordinates $(x_{\text{img}}, y_{\text{img}}) \in [0, 1] \times [0, 1]$ on `quiet-map.png`, we must invert the latitude mapping. 

#### Method A: Custom Coordinate Translation (1D Correction)
If the map has no rotational skew and standard left-right (West-East) scaling holds:
$$x_{\text{img}} = \frac{Lng - Lng_{\min}}{Lng_{\max} - Lng_{\min}}$$
$$y_{\text{img}} = \frac{Lat - Lat_{\min}}{Lat_{\max} - Lat_{\min}}$$
* *Proof of Correction*: When $Lat = Lat_{\min}$ (South / Sea), $y_{\text{img}} = 0$ (Top of image). When $Lat = Lat_{\max}$ (North / Mountains), $y_{\text{img}} = 1$ (Bottom of image). This matches the physical representation.

#### Method B: 2D Affine Transformation (Model C)
For hand-drawn maps with rotational or scaling distortions, we map:
$$x_{\text{img}} = a_1 \cdot Lng + a_2 \cdot Lat + a_3$$
$$y_{\text{img}} = b_1 \cdot Lng + b_2 \cdot Lat + b_3$$

By solving the system of equations with calibration points, the vertical inversion is automatically handled: the coefficient $b_2$ (linking latitude to $y_{\text{img}}$) will naturally solve to a positive value (reversing the standard North-up mapping).

#### Least-Squares Calibration (4-Point Regression)
To smooth out non-linear errors in hand-drawn illustrations, we use 4 calibration points:
$$M = \begin{pmatrix} Lng_1 & Lat_1 & 1 \\ Lng_2 & Lat_2 & 1 \\ Lng_3 & Lat_3 & 1 \\ Lng_4 & Lat_4 & 1 \end{pmatrix}, \quad X = \begin{pmatrix} x_1 \\ x_2 \\ x_3 \\ x_4 \end{pmatrix}, \quad Y = \begin{pmatrix} y_1 \\ y_2 \\ y_3 \\ y_4 \end{pmatrix}$$
We solve for coefficients $A = (a_1, a_2, a_3)^T$ and $B = (b_1, b_2, b_3)^T$ using:
$$A = (M^T M)^{-1} M^T X$$
$$B = (M^T M)^{-1} M^T Y$$

### 1.3 Recommended Calibration Points
To calibrate the Busan illustration, we select four widely distributed water and geographical landmarks:

| Landmark | Real GPS (Lat, Lng) | Map Position $(x_{\text{img}}, y_{\text{img}})$ | Geographic Significance |
| :--- | :--- | :--- | :--- |
| **Dadaepo Beach** | $(35.0463, 128.9665)$ | $(0.15, 0.15)$ | Southwest (Sea / Coastal) $\rightarrow$ Top-Left |
| **Haeundae Beach** | $(35.1587, 129.1604)$ | $(0.85, 0.20)$ | Southeast (Sea / Coastal) $\rightarrow$ Top-Right |
| **Geumjeongsan Summit** | $(35.2758, 129.0539)$ | $(0.35, 0.85)$ | Northwest/North (Mountain / Inland) $\rightarrow$ Bottom-Left |
| **Gijang Dream Church** | $(35.2425, 129.2241)$ | $(0.90, 0.70)$ | Northeast (Coastal) $\rightarrow$ Bottom-Right |

---

## 2. Dependencies & Offline detection

### 2.1 Missing Package: `expo-file-system`
The Lead Architect's caching script imports `expo-file-system`, but it is absent from `mobile/package.json`. 
* **Critique**: The application will fail to compile under Metro due to unresolved imports.
* **Action Plan**: Add `"expo-file-system": "~18.0.8"` (or compatible Expo SDK 54 version) to `mobile/package.json` dependencies.
* **Installation**: Developers must install it via `npx expo install expo-file-system` to guarantee version lockstep.

### 2.2 Offline Detection Strategy Comparison
We evaluate the optimal stack for network reachability to balance performance and accuracy:

| Strategy | Implementation | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: `expo-network`** | `Network.getNetworkStateAsync()` | Official Expo API. Detects connection medium (Wifi/Cellular/None). | Additional native bundle size. Does not guarantee end-to-end internet. | **Recommended for State/UI** |
| **Option B: Pure Fetch HEAD** | `fetch(CDN, { method: 'HEAD' })` | Zero dependencies. Verifies actual CDN server reachability. | Async latency (1-2s delay). Network overhead. | **Recommended for Pre-flight checks** |
| **Option C: Stream Catch** | Catch errors inside `Sound.createAsync()` | Low overhead. Only handles failures at point-of-use. | Reactive rather than proactive. Bad UX if check fails late. | **Mandatory Fallback** |

* **Proposal**: Implement a hybrid approach. Use a lightweight pre-flight HEAD fetch with a timeout (e.g., 2000ms) to check if the CDN is reachable. If it fails, instantly switch to the offline local cache or bundled fallback.

---

## 3. Concurrency, Performance, and Cache Sync

### 3.1 Concurrency and Race Conditions in `expo-av`
The current implementation of `playAmbientSound` is vulnerable to overlapping sound leaks:
```typescript
await stopAmbientSound(); // 1. Unloads active sounds
const { sound: ambient } = await Audio.Sound.createAsync(soundAsset); // 2. Async loading (takes time)
ambientSound = ambient; // 3. Re-assigns global reference
```

**The Bug Scenario**:
1. User clicks "Spot A" $\rightarrow$ `playAmbientSound("river")` runs.
2. `stopAmbientSound()` runs. `Audio.Sound.createAsync` is awaited.
3. User rapidly clicks "Spot B" before the first load completes $\rightarrow$ `playAmbientSound("sea")` runs.
4. The second call runs `stopAmbientSound()`. Since `ambientSound` is still `null` (first load hasn't resolved), nothing is unloaded.
5. First load completes $\rightarrow$ plays river loop, sets `ambientSound = ambient1`.
6. Second load completes $\rightarrow$ plays sea loop, overwrites `ambientSound = ambient2`.
7. **Result**: Both the river and sea loops are playing simultaneously in the background. The reference to `ambient1` is lost, making it impossible to stop without restarting the app. This leads to **audio track leak** and crashes due to native channel exhaustion.

#### Mitigation: The Playback Request ID Lock
We must implement a request synchronization token to reject stale asynchronous loads:

```typescript
let activePlaybackRequestId = 0;

export async function playAmbientSound(waterType: string | undefined): Promise<void> {
  const currentRequestId = ++activePlaybackRequestId;

  try {
    await stopAmbientSound();

    const isOnline = await checkOnlineStatus();
    const soundFile = waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';

    // Resolve source (Cache -> CDN -> Bundle)
    const ambientSource = await resolveAudioSource(soundFile, isOnline);
    
    // Perform Async Load
    const { sound: ambient } = await Audio.Sound.createAsync(ambientSource);

    // Concurrency Lock Check
    if (currentRequestId !== activePlaybackRequestId) {
      await ambient.unloadAsync(); // Instantly discard stale resource
      return;
    }

    ambientSound = ambient;
    await ambientSound.setIsLoopingAsync(true);
    await ambientSound.playAsync();

    // Repeat for wind white noise
    const windSource = await resolveAudioSource('white_noise_wind.mp3', isOnline);
    const { sound: wind } = await Audio.Sound.createAsync(windSource);

    if (currentRequestId !== activePlaybackRequestId) {
      await wind.unloadAsync();
      return;
    }

    windSound = wind;
    await windSound.setIsLoopingAsync(true);
    await windSound.playAsync();

  } catch (err) {
    console.error('[Audio Engine] Playback transition aborted:', err);
  }
}
```

### 3.2 Performance and Resource Management
* **Channel Management**: Android devices often limit concurrent audio channels to 3-4 tracks. Ensure that `stopAmbientSound` explicitly calls `unloadAsync()` on all tracks.
* **Pre-fetching and SWR Cache Sync**:
  To achieve a Calm UX, SWR data fetches (locations, weather) must trigger pre-fetching in the background so that audio is ready *before* playback.
  
  **Data-to-Audio Flow**:
  1. `useSWR('/api/spots')` fetches active quiet spots.
  2. SWR updates the client state.
  3. A `useEffect` hook monitors the SWR data. On change, it extracts the filenames (e.g., `ambient_sea.mp3`) and invokes `prefetchAudioAssets()` asynchronously.
  4. The pre-fetching service downloads missing files to `FileSystem.documentDirectory` in the background.
  5. When the user navigates, `resolveAudioSource()` instantly retrieves the local URI, ensuring immediate playback without waiting for network streaming.

```
+--------------------+      Updates      +--------------------+
|  useSWR() Hook     | ----------------> |  Quiet Spot State  |
+--------------------+                   +--------------------+
          |                                        |
          | Trigger Side Effect                    | User Selection
          v                                        v
+-----------------------------+          +-------------------------+
| useEffect()                 |          | Playback Trigger        |
| - Extract sound files       |          | - resolveAudioSource()  |
| - prefetchAudioAssets() bg  |          | - Instant Local Play    |
+-----------------------------+          +-------------------------+
          |                                        ^
          v                                        |
+--------------------------------------------------+
| FileSystem.documentDirectory (Persistent Cache)  |
+--------------------------------------------------+
```
