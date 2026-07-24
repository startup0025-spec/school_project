# Handoff Report: Backend Services, Audio DSP Mixing, Network APIs & Data Pipeline Audit

**Role**: Explorer Agent (Backend & DSP Audit Specialist)  
**Target Project**: `Anyway_the_Sea`  
**Working Directory**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_audit_backend`

---

## 1. Observation

Direct code examination was conducted using `view_file` across all files in the assigned scope:
- `mobile/lib/services/audio_engine_service.ts` (282 lines)
- `mobile/lib/services/audio_caching_service.ts` (390 lines)
- `mobile/lib/services/geofencing_service.ts` (467 lines)
- `mobile/lib/services/notification_service.ts` (92 lines)
- `mobile/core_engine/src/network/client.ts` (71 lines)
- `mobile/core_engine/src/network/busan_api.ts` (188 lines)
- `mobile/core_engine/src/network/kma_api.ts` (97 lines)
- `mobile/core_engine/src/api.ts` (257 lines)
- `scripts/pipeline/bake_places.js` (416 lines)
- `scripts/pipeline/check_grid.js` (18 lines)
- `scripts/pipeline/test_pipeline.js` (146 lines)
- `scripts/pipeline/utils/haversine.js` (69 lines)
- `scripts/pipeline/utils/kma_grid.js` (65 lines)
- `scripts/pipeline/data/water_stations.js` (66 lines)

### Key Verbatim Findings & Line Numbers:

1. **KMA Base Time Calculation Bug**:
   - `mobile/core_engine/src/api.ts:50-53`:
     ```typescript
     const now = new Date();
     const kstOffset = 9 * 60; // KST is UTC+9
     const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
     const kst = new Date(utc + (kstOffset * 60 * 1000));
     ```
     `now.getTime()` returns milliseconds since UNIX epoch in UTC. `now.getTimezoneOffset()` on a KST system returns `-540`. Adding `-540 * 60 * 1000` to `now.getTime()` subtracts 9 hours from UTC before adding 9 hours back, resulting in UTC time instead of KST (+9 hours). On Korean devices, KMA forecast requests are sent with base times 9 hours in the past, returning empty or error payloads.

2. **Volume Envelope Interval Leak**:
   - `mobile/lib/services/audio_engine_service.ts:256-265`:
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
     The timer interval never calls `clearInterval(windInterval)` when `currentRequestId !== activePlaybackRequestId`. Stale interval callbacks continue executing in the background infinitely.

3. **Case-Sensitive Header Bug in Audio Cache**:
   - `mobile/lib/services/audio_caching_service.ts:305`:
     ```typescript
     const size = downloadResult.headers['Content-Length'] ? parseInt(downloadResult.headers['Content-Length']) : 5 * 1024 * 1024;
     ```
     HTTP headers in Expo FileSystem / fetch results normalize header names to lower-case (`content-length`). `downloadResult.headers['Content-Length']` evaluates to `undefined`, defaulting all cached audio files to 5MB (5,242,880 bytes) regardless of real size, breaking LRU quota calculations.

4. **AsyncStorage Cache Accumulation (No Eviction)**:
   - `mobile/core_engine/src/network/client.ts:7-28`:
     `offlineStorage` wraps `AsyncStorage` with key format `api_cache:${key}` but provides no mechanism to clean up or limit key count. Over time, `AsyncStorage` hits the 6MB storage ceiling.

5. **`check_grid.js` Broken Require Path**:
   - `scripts/pipeline/check_grid.js:5`:
     ```javascript
     const { latLngToGrid } = require('./scripts/pipeline/utils/kma_grid');
     ```
     Running `node check_grid.js` inside `scripts/pipeline/` throws `MODULE_NOT_FOUND`.

---

## 2. Logic Chain

1. **Timezone Bug in `api.ts`**:
   - `now.getTime()` is already timezone-agnostic epoch UTC milliseconds.
   - `now.getTimezoneOffset()` returns `-540` for KST.
   - `utc = now.getTime() + (-540 * 60000)` subtracts 9 hours from UTC.
   - `kst = utc + (540 * 60000)` returns UTC.
   - `getKMABaseTime()` uses UTC hours. For example, at 15:00 KST (06:00 UTC), KMA is queried for 06:00 base time instead of 15:00 base time. KMA Ultra-Short forecast API discards queries older than 4 hours, causing forecast lookup failures.

2. **DSP Mixing Volume Envelope Leak**:
   - `playDynamicMix` creates a `windInterval` for each mixing request.
   - When a new audio mix request arrives, `stopAmbientSound()` clears `activeIntervals`.
   - However, if `currentRequestId !== activePlaybackRequestId` occurs *during* an ongoing playback lifecycle, the interval block skips `setVolumeAsync`, but does NOT clear itself. The JS runtime keeps the interval active, leading to memory leaks and unnecessary CPU tick overhead.

3. **Audio Cache Footprint Distortions**:
   - HTTP response header maps from fetch/axios use lower-case keys (`content-length`).
   - Checking `'Content-Length'` returns `undefined`.
   - `parseInt(undefined)` -> `NaN` -> defaults to `5 * 1024 * 1024` (5MB).
   - A 200KB sound file is counted as 5MB in `touchFile`. After downloading 10 small sound files (actual size ~2MB), total cached size is computed as 50MB, triggering aggressive LRU eviction prematurely.

---

## 3. Caveats

1. **Code Modification Constraint**:
   - As an explorer agent operating under read-only guidelines, no project source code files were edited. All proposed fixes are documented in `analysis.md` and this handoff report.
2. **OpenAI Logic Excluded as Instructed**:
   - `bake_places.js` local fallback logic was audited. Missing OpenAI API calls were NOT flagged as errors per prompt instructions.
3. **Expo Native Audio Limitations**:
   - `expo-av` native audio behavior (e.g. underlying Android SoundPool / iOS AVAudioPlayer behavior on rapid `stopAsync`/`unloadAsync`) was inferred from TypeScript definitions and standard Expo SDK contracts.

---

## 4. Conclusion

The backend services, audio DSP engine, network layers, and pre-baking data pipeline are architecturally solid and well-designed (employing reference counting, hysteresis, and offline fallback mechanisms). However, **5 critical/high-severity issues** were identified that impair production stability:
1. `getKMABaseTime()` timezone calculation bug causing total failure of live KMA weather forecast fetching on KST devices.
2. DSP volume envelope timer leaks in `audio_engine_service.ts`.
3. Lowercase HTTP header mismatch (`Content-Length` vs `content-length`) causing premature cache eviction in `audio_caching_service.ts`.
4. `AsyncStorage` API cache quota bloat in `client.ts`.
5. Broken require path in `scripts/pipeline/check_grid.js`.

Detailed descriptions and code patches for all findings have been written to `analysis.md`.

---

## 5. Verification Method

To verify the findings independently:

1. **Verify KMA Timezone Bug**:
   Inspect `mobile/core_engine/src/api.ts` lines 50–75.
   Run node in KST environment and evaluate `getKMABaseTime()`. Compare returned `baseTime` against current KST hour. Notice it returns UTC hour (9 hours behind).

2. **Verify `test_pipeline.js` Execution**:
   Run command: `node scripts/pipeline/test_pipeline.js`
   Confirm that existing unit tests pass, but `node scripts/pipeline/check_grid.js` fails due to module import path.

3. **Verify Audio Header Inspection**:
   Inspect `mobile/lib/services/audio_caching_service.ts` line 305. Note case sensitivity of `downloadResult.headers['Content-Length']`.

4. **Verify Analysis Artifact**:
   Read `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_audit_backend\analysis.md`.
