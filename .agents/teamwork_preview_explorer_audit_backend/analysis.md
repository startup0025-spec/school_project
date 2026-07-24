# Comprehensive Analysis Report: Backend Services, Audio Engine, Network APIs & Data Pipeline Audit

**Project**: `Anyway_the_Sea` (잔물결)  
**Audit Scope**:
1. `mobile/lib/services/` (`audio_engine_service.ts`, `audio_caching_service.ts`, `geofencing_service.ts`, `notification_service.ts`)
2. `mobile/core_engine/src/` (`network/client.ts`, `network/busan_api.ts`, `network/kma_api.ts`, `api.ts`)
3. `scripts/pipeline/` (`bake_places.js`, `check_grid.js`, `test_pipeline.js`, `utils/*`, `data/*`)

---

## Executive Summary
A meticulous, exhaustive audit of the backend, audio DSP mixing, geofencing, networking, and pre-baking data pipeline was conducted. The codebase demonstrates high engineering standards with robust mechanisms such as reference-counted loading locks for LRU caching, hysteresis-based adaptive geofencing, and zero-burden offline fallback mechanisms. However, several critical bugs, memory leaks, unhandled promise rejections, and edge case vulnerabilities were identified across multiple layers.

Below is the detailed itemization of findings categorized by domain.

---

## Domain 1: DSP Audio Mixing & Audio Engine Flaws

### 1.1 Volume Envelope Animation Interval Leak & Ghost Updates
- **File**: `mobile/lib/services/audio_engine_service.ts`
- **Lines**: 256–268 (`playDynamicMix`)
- **Severity**: **HIGH**
- **Description**:
  When a wind track is initialized, a `setInterval` is created to animate the volume envelope every 500–1000ms:
  ```typescript
  const windInterval = setInterval(async () => {
    try {
      if (currentRequestId === activePlaybackRequestId && windSound) {
        const gustVol = 0.3 + Math.random() * 0.5;
        await windSound.setVolumeAsync(gustVol);
      }
    } catch { ... }
  }, 500 + Math.floor(Math.random() * 500));
  ```
  If `playDynamicMix` is called repeatedly or if an external eviction/stop occurs, `activeIntervals` is only cleared when `stopAmbientSound()` is called. If `stopAmbientSound()` is invoked while an async `setVolumeAsync` call is pending or if `stopAmbientSound()` is missed (e.g. state transition or race condition), the interval continues ticking indefinitely. Furthermore, `currentRequestId === activePlaybackRequestId` check inside the timer callback does NOT call `clearInterval(windInterval)` when it detects a stale `currentRequestId`. Thus, the interval callback continues firing uselessly forever, consuming timer resources and CPU cycles.
- **Recommended Fix**:
  In the interval callback, if `currentRequestId !== activePlaybackRequestId`, immediately call `clearInterval(windInterval)` and return. Ensure interval handles are tracked with explicit cleanup callbacks attached to the `Audio.Sound` lifecycle.

### 1.2 Unhandled Rejections in CDN Fallback Loader (`Promise.race` Leaks)
- **File**: `mobile/lib/services/audio_engine_service.ts`
- **Lines**: 57–83 (`loadSoundWithFallback`)
- **Severity**: **HIGH**
- **Description**:
  In `loadSoundWithFallback`, a `Promise.race` is performed between `wrappedLoadPromise` and `timeoutPromise`:
  ```typescript
  const loadPromise = Audio.Sound.createAsync(source, { shouldPlay: false });
  const wrappedLoadPromise = loadPromise.then(...).catch(...);
  const result = await Promise.race([wrappedLoadPromise, timeoutPromise]);
  ```
  If `timeoutPromise` rejects first (after 5000ms), `Promise.race` throws an error caught by the `catch` block of `loadSoundWithFallback`, which then falls back to `BUNDLED_SOUNDS`.
  However, the underlying `loadPromise` (`Audio.Sound.createAsync`) is STILL running in the background! If `loadPromise` later rejects (e.g., DNS error, HTTP 404/500, network disconnect), the rejection occurs AFTER `didTimeout` is set to `true`.
  In `wrappedLoadPromise`, when `didTimeout` is true, `.catch((err) => { return undefined as any; })` is executed. BUT if `Audio.Sound.createAsync` itself fails BEFORE `.then()` attaches, or if the underlying native Expo module throws an unhandled rejection, it can cause an uncaught promise rejection in React Native.
  Moreover, if `createAsync` resolves late after timeout, `result.sound.unloadAsync().catch(() => {})` is called, but if `result` is undefined or malformed due to an error, `result.sound` access can throw a `TypeError: Cannot read property 'sound' of undefined`.
- **Recommended Fix**:
  Add defensive checks on `result?.sound` before invoking `unloadAsync()`:
  ```typescript
  if (didTimeout && result && result.sound) {
    result.sound.unloadAsync().catch(() => {});
  }
  ```

### 1.3 Superceded Async Load Race Condition (`activeSounds` Orphan Leak)
- **File**: `mobile/lib/services/audio_engine_service.ts`
- **Lines**: 196–225 (`playDynamicMix`)
- **Severity**: **MEDIUM**
- **Description**:
  When `playDynamicMix` runs concurrently (e.g., fast user location updates across boundaries):
  1. Request #1 starts `loadSoundWithFallback`.
  2. Request #2 starts, increments `activePlaybackRequestId`, and calls `stopAmbientSound()`.
  3. `stopAmbientSound()` clears `activeSounds` (which currently holds Request #0's sounds).
  4. Request #1 finishes loading its 3 ambient tracks and 1 wind track.
  5. Lines 218–225 check `currentRequestId !== activePlaybackRequestId`. Request #1 notices it is superseded and unloads the loaded ambient and wind sounds.
  However, inside `loadSoundWithFallback` (lines 107-110), there is ALSO a check:
  ```typescript
  if (requestId !== activePlaybackRequestId && soundInstance) {
    soundInstance.unloadAsync().catch(() => {});
  }
  ```
  If `loadSoundWithFallback` returns `soundInstance` to `ambientPromises`, both `loadSoundWithFallback`'s finally block AND lines 220–223 attempt to call `.unloadAsync()` on the SAME `Audio.Sound` instance concurrently. Calling `unloadAsync()` twice on an Expo Audio instance can produce internal native bridge log spam or warning exceptions.

---

## Domain 2: Audio Caching & LRU Eviction Flaws

### 2.1 Unhandled Async Download Completion & Partial File Cleanup Deadlock
- **File**: `mobile/lib/services/audio_caching_service.ts`
- **Lines**: 300–325 (`resolveAudioSource`)
- **Severity**: **MEDIUM-HIGH**
- **Description**:
  When `resolveAudioSource` experiences a cache miss and CDN is reachable, it starts a background download via `download.downloadAsync()` and IMMEDIATELY returns `{ uri: cdnUrl }` for direct HTTP streaming.
  Inside the un-awaited `.then(...)` handler of `download.downloadAsync()`:
  ```typescript
  const size = downloadResult.headers['Content-Length'] ? parseInt(downloadResult.headers['Content-Length']) : 5 * 1024 * 1024;
  await touchFile(filename, size);
  await enforceCacheLimits();
  ```
  1. `Content-Length` header in HTTP response headers is case-insensitive, but lower-case `content-length` is commonly normalized by `fetch`/Axios/Expo FileSystem. Checking only `downloadResult.headers['Content-Length']` (capitalized) results in `NaN` or fallback to 5MB even for 200KB audio files.
  2. If `enforceCacheLimits()` triggers while `playDynamicMix` is actively playing the audio streamed from `{ uri: cdnUrl }`, `activeSoundChecker(file)` is called. But `activeFiles` in `audio_engine_service.ts` only registers the file AFTER `loadSoundWithFallback` completes (line 239). During the initial streaming setup phase, the file is NOT yet in `activeFiles` or `pinnedFiles`! If another download completes concurrently, `enforceCacheLimits` could evict the file while it is currently being downloaded or loaded by `expo-av`.

### 2.2 Unhandled `prefetchAudioAssets` Error Cascade
- **File**: `mobile/lib/services/audio_caching_service.ts`
- **Lines**: 359–377 (`prefetchAudioAssets`)
- **Severity**: **MEDIUM**
- **Description**:
  In `prefetchAudioAssets`, downloads are executed in a loop. If a single download fails (e.g. network drops mid-batch), line 376 throws `err`, breaking the loop and leaving remaining assets un-prefetched. Furthermore, the caller of `prefetchAudioAssets` might not catch this error, leading to an unhandled promise rejection.

---

## Domain 3: Geofencing & Service Lifecycle Memory Leaks

### 3.1 `DeviceEventEmitter` Listener Leak & Memory Overhead
- **File**: `mobile/lib/services/geofencing_service.ts`
- **Lines**: 326, 335, 344, 353, 395
- **Severity**: **HIGH**
- **Description**:
  `geofencing_service.ts` emits events via `DeviceEventEmitter.emit(...)`:
  - `onSafetyDanger`
  - `onSafetySafe`
  - `onTrackingStateUpdate`
  While emitting is normal, React Native components listening to `DeviceEventEmitter.addListener(...)` will leak memory if subscribers do not remove subscriptions on unmount. More critically, `geofencing_service.ts` imports `DeviceEventEmitter` from `'react-native'`, which runs in a background TaskManager task context (`LOCATION_TRACKING_TASK`).
  When running in a headless Expo background task on Android/iOS, `DeviceEventEmitter` listeners attached in the React UI layer are NO LONGER ACTIVE (the JS root view is unmounted or detached). Calling `DeviceEventEmitter.emit` in a headless task context is harmless but can silently fail to update state until app foregrounding.

### 3.2 Race Condition in Static `taskQueue`
- **File**: `mobile/lib/services/geofencing_service.ts`
- **Lines**: 42, 409–417 (`taskQueue`)
- **Severity**: **MEDIUM**
- **Description**:
  To prevent `AsyncStorage` race conditions, `taskQueue` is implemented as:
  ```typescript
  let taskQueue = Promise.resolve();
  ...
  taskQueue = taskQueue.then(async () => {
    try {
      await processLocationUpdate(locations);
    } catch (queueErr) { ... }
  });
  await taskQueue;
  ```
  If `processLocationUpdate` throws or rejects, `taskQueue.then(...)` completes. However, because `taskQueue` becomes a rejected promise if the error isn't handled correctly in the promise chain, subsequent calls to `taskQueue = taskQueue.then(...)` will immediately execute the rejection handler or fail to queue properly. Fortunately, line 411 has a `try/catch` block inside `.then()`, but if an error occurs outside `processLocationUpdate` inside `.then()`, `taskQueue` will remain permanently rejected!

### 3.3 Hysteresis State Persistence Lockup
- **File**: `mobile/lib/services/geofencing_service.ts`
- **Lines**: 254–274 (`processLocationUpdate`)
- **Severity**: **MEDIUM**
- **Description**:
  When `state.activePlaceId` is locked, the code queries `getPlaceById(state.activePlaceId)`. If `lockedPlace` returns `null` (e.g. place master JSON was updated and place ID was removed), line 273 resets `state.activePlaceId = null;`. BUT in that same iteration of `processLocationUpdate`, lines 277–295 (`if (state.activePlaceId === null)`) are NOT in an `else` block! Instead, `if (state.activePlaceId === null)` was evaluated earlier (at line 277).
  Thus, when `state.activePlaceId` becomes `null` due to a missing place, location processing for that cycle terminates without identifying a replacement target place (`targetPlace` remains `null`), causing the update cycle to be skipped entirely until the next GPS tick.

---

## Domain 4: Core Engine Network & API Layers

### 4.1 Zero-Burden Interceptor Logic & Missing Cache Eviction Policy
- **File**: `mobile/core_engine/src/network/client.ts`
- **Lines**: 7–28, 36–42
- **Severity**: **HIGH**
- **Description**:
  1. `offlineStorage` uses `AsyncStorage` with key format `api_cache:${key}`. However, `axios-cache-interceptor` writes cache entries but `offlineStorage` provides NO method to purge or prune old keys! Over time, `AsyncStorage` will accumulate stale cache entries for every unique URL request, eventually hitting the 6MB `AsyncStorage` quota on Android/iOS.
  2. Line 20 catches quota errors: `console.warn('[client.ts] AsyncStorage write failed / quota exceeded', e);`, but does not attempt any cleanup. Once quota is reached, ALL API caching fails silently!
  3. In line 40, `ttl: 1000 * 60 * 5` (5 minutes) is set, but `staleIfError: true` allows serving stale cache indefinitely if offline. When online, Axios Cache Interceptor will still keep writing new keys.

### 4.2 `busan_api.ts`: NaN Parsing Flaws & Schema Inconsistencies
- **File**: `mobile/core_engine/src/network/busan_api.ts`
- **Lines**: 116–130 (`fetchRiverWaterLevel`), 164–186 (`fetchRiverWaterQuality`)
- **Severity**: **MEDIUM**
- **Description**:
  In `fetchRiverWaterLevel`:
  ```typescript
  if (rawVal !== undefined && rawVal !== null) {
    const parsed = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
    waterLevel = Number.isNaN(parsed) ? 0.0 : parsed;
  }
  ```
  If `rawVal` is an empty string `""` or non-numeric string (e.g. `"-"` or `"N/A"` returned by data.go.kr during maintenance), `parseFloat("-")` returns `NaN`, which gets defaulted to `0.0`.
  While converting `NaN` to `0.0` prevents application crashes, `0.0` meter water level represents a low water level rather than missing data. In `api.ts` (lines 130–136), `wl >= 1.5` for Danger, `wl >= 0.8` for Warning. If water level is 0.0 due to missing data, the system treats it as completely safe (`Safe`), masking potential hazards during data blackout periods.

### 4.3 `kma_api.ts` & `api.ts`: Timezone & KMA Base Time Calculation Bug
- **File**: `mobile/core_engine/src/api.ts`
- **Lines**: 49–77 (`getKMABaseTime`)
- **Severity**: **HIGH**
- **Description**:
  Look at lines 50–53 of `getKMABaseTime()`:
  ```typescript
  const now = new Date();
  const kstOffset = 9 * 60; // KST is UTC+9
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kst = new Date(utc + (kstOffset * 60 * 1000));
  ```
  `now.getTimezoneOffset()` returns the offset in minutes from UTC to local time.
  `now.getTime()` returns the UNIX timestamp in milliseconds (which is ALWAYS in UTC regardless of local timezone!).
  Adding `now.getTimezoneOffset() * 60 * 1000` to `now.getTime()` applies a double-offset if the device is already in KST (where `getTimezoneOffset()` is `-540`).
  Specifically:
  - `now.getTime()` = UTC timestamp
  - `now.getTimezoneOffset()` on KST device = `-540` minutes.
  - `utc = now.getTime() + (-540 * 60 * 1000)` -> This subtracts 9 hours from UTC!
  - `kst = new Date(utc + (540 * 60 * 1000))` -> This adds 9 hours, resulting in UTC time instead of KST time!
  As a result, on devices physically located in Korea (KST), `getKMABaseTime()` requests KMA forecasts for 9 hours in the PAST! This causes KMA Open API to return error codes or empty items because ultra-short forecasts older than 4 hours are purged by KMA servers.

---

## Domain 5: Data Pipeline Scripts (`scripts/pipeline/`)

### 5.1 `bake_places.js`: Missing Error Handling & Rate Limiting Leak
- **File**: `scripts/pipeline/bake_places.js`
- **Lines**: 151–188 (`fetchPlacesByType`)
- **Severity**: **MEDIUM**
- **Description**:
  1. `fetchPlacesByType` paginates through TourAPI results. If `fetchJson(url)` fails on page 2 (e.g. temporary network blip or HTTP 500 from data.go.kr), `fetchJson` rejects the promise. `fetchPlacesByType` has NO `try/catch` around `await fetchJson(url)`, causing the entire pre-baking pipeline to crash immediately (`process.exit(1)`).
  2. Line 183 uses `await new Promise((r) => setTimeout(r, 300));` inside the loop. If `items.length === 0` or error occurs, it breaks. But for large datasets (e.g. 500+ items across multiple content types), if `fetchJson` fails mid-way, all previously fetched data for that type is lost.

### 5.2 `bake_places.js`: File Stream & Cache Handle Leaks
- **File**: `scripts/pipeline/bake_places.js`
- **Lines**: 246–253, 343 (`diffWithCache`, `saveCache`)
- **Severity**: **LOW**
- **Description**:
  `fs.readFileSync` and `fs.writeFileSync` are used synchronously. While synchronous I/O is acceptable for build/pipeline scripts, `saveCache` does not wrap `fs.writeFileSync` in a `try/catch` block. If disk space is full or directory permissions fail, `saveCache` throws, causing `main()` to crash after spending time generating all place objects.

### 5.3 `check_grid.js`: Incorrect Import Path
- **File**: `scripts/pipeline/check_grid.js`
- **Line**: 5
- **Severity**: **HIGH** (Script Execution Failure)
- **Description**:
  In `check_grid.js`:
  ```javascript
  const { latLngToGrid } = require('./scripts/pipeline/utils/kma_grid');
  ```
  When executing `node scripts/pipeline/check_grid.js` from the project root, `./scripts/pipeline/utils/kma_grid` works, but if executed from inside `scripts/pipeline/` (`node check_grid.js`), `require('./scripts/pipeline/utils/kma_grid')` fails with `Cannot find module './scripts/pipeline/utils/kma_grid'`.
  The import path should be relative to the script file location: `require('./utils/kma_grid')`.

---

## Comprehensive Summary Table of Audit Findings

| Bug / Flaw ID | Location | Severity | Category | Description |
|---|---|---|---|---|
| **AUDIO-01** | `audio_engine_service.ts`:256-268 | **HIGH** | DSP Mixing | Volume envelope interval leak in `playDynamicMix` — interval ticks indefinitely after track cancellation. |
| **AUDIO-02** | `audio_engine_service.ts`:57-83 | **HIGH** | DSP Mixing | `Promise.race` timeout leak — late-rejecting `createAsync` triggers unhandled promise rejections. |
| **AUDIO-03** | `audio_engine_service.ts`:107-110 | **MEDIUM** | DSP Mixing | Race condition calling `.unloadAsync()` twice on superseded audio instances. |
| **CACHE-01** | `audio_caching_service.ts`:305 | **MEDIUM** | Audio Caching | Case-sensitive `Content-Length` header check causes file size to default to 5MB, breaking LRU stats. |
| **CACHE-02** | `audio_caching_service.ts`:227-230 | **MEDIUM** | Audio Caching | Streaming files evicted during initial load because active registration occurs post-download. |
| **GEO-01** | `geofencing_service.ts`:326,395 | **HIGH** | React Native Lifecycle | `DeviceEventEmitter` events emitted in headless task context without unmount cleanup safety. |
| **GEO-02** | `geofencing_service.ts`:273-277 | **MEDIUM** | State Management | Missing place lock release skips nearest place evaluation on the same update tick. |
| **NET-01** | `client.ts`:7-28 | **HIGH** | Network API | `offlineStorage` lacks eviction/pruning strategy; eventual `AsyncStorage` quota failure silently kills API caching. |
| **NET-02** | `busan_api.ts`:122,171 | **MEDIUM** | Network API | Parsing empty/dash strings converts missing data to `0.0`, masking dangerous water levels as `Safe`. |
| **NET-03** | `api.ts`:50-53 | **HIGH** | Core Logic | `getKMABaseTime` double-calculates UTC offset on KST devices, requesting KMA data 9 hours in the past! |
| **PIPE-01** | `check_grid.js`:5 | **HIGH** | Pipeline | Hardcoded relative path breaks execution when run inside `scripts/pipeline/`. |
| **PIPE-02** | `bake_places.js`:167-173 | **MEDIUM** | Pipeline | Unhandled HTTP error in TourAPI pagination loop aborts the entire baking process on minor network glitch. |

---

## Recommended Immediate Fixes

1. **Fix `getKMABaseTime` Timezone Calculation (`mobile/core_engine/src/api.ts`)**:
   Construct KST date using `Date.now()` without adding `getTimezoneOffset()` manually, or use standard ISO/UTC methods to convert to KST (`UTC+9`).

2. **Fix Wind Volume Envelope Interval Cleanup (`mobile/lib/services/audio_engine_service.ts`)**:
   Self-clear `clearInterval(windInterval)` inside the interval callback when `currentRequestId !== activePlaybackRequestId`.

3. **Fix `Content-Length` Header Handling (`mobile/lib/services/audio_caching_service.ts`)**:
   Check both `headers['content-length']` and `headers['Content-Length']` or convert header keys to lowercase.

4. **Fix `client.ts` Cache Pruning (`mobile/core_engine/src/network/client.ts`)**:
   Implement LRU size cap or periodic clearing for `api_cache:*` keys stored in `AsyncStorage`.

5. **Fix `check_grid.js` Require Path (`scripts/pipeline/check_grid.js`)**:
   Change `require('./scripts/pipeline/utils/kma_grid')` to `require('./utils/kma_grid')`.
