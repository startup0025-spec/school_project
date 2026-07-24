## 2026-07-23T20:42:24+09:00
<USER_REQUEST>
You are the Worker subagent for Anyway_the_Sea audio mixing engine refactoring.
Working Directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea
Your Agent Working Directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\worker_dsp_mix

Task Requirements:
1. Refactor `mobile/lib/services/audio_caching_service.ts`:
   - Update `BUNDLED_SOUNDS` to map all 15 CDN sound assets (`sea_1.mp3`..`sea_5.mp3`, `river_1.mp3`..`river_5.mp3`, `wind_1.mp3`..`wind_5.mp3`) to local bundled fallbacks (`ambient_sea.mp3`, `ambient_river.mp3`, `white_noise_wind.mp3`).
   - Ensure `resolveAudioSource` and `loadSoundWithFallback` can reliably fallback to bundled assets if CDN loads fail or time out.

2. Refactor `mobile/lib/services/audio_engine_service.ts`:
   - Permanently remove `playEmergencySiren` and single instance playback logic (`ambientSound`, `windSound`, `sirenSound`).
   - Implement `playDynamicMix(waterType: string | undefined)`:
     - Select 3 random distinct sound assets out of 5 (`sea_1.mp3`..`sea_5.mp3` if waterType === 'sea', else `river_1.mp3`..`river_5.mp3`).
     - Load all 3 ambient sound instances and play them overlaid with pitch/rate variation (e.g. 0.95, 1.0, 1.05 or random rate in 0.92-1.08) and random time position offset variation (`setPositionAsync`) for a organic chorus effect.
     - Select 1 random wind asset out of 5 (`wind_1.mp3`..`wind_5.mp3`).
     - Load the wind sound instance, play it looping, and launch a real-time `setInterval` volume envelope animation (fluctuating volume e.g. every 500-1000ms to simulate wind gusts).
     - Maintain an array/set of all active sound instances (`Audio.Sound[]`), active filenames, and interval IDs.
     - Implement `stopAmbientSound()`: clear volume envelope `setInterval`, unpin active files, and call `stopAsync()` + `unloadAsync()` on 100% of active sound instances.
     - Export `playAmbientSound` as an alias to `playDynamicMix` for backward compatibility.

3. Update `mobile/app/(tabs)/sound.tsx`:
   - Bridge UI ambient chip buttons and toggle state to call `playDynamicMix`.

4. Update `mobile/lib/services/geofencing_service.ts`:
   - Update imports and replace legacy `playEmergencySiren` and `playAmbientSound` calls with `playDynamicMix(targetPlace.waterType)`.

5. Verification:
   - Execute `npx tsc --noEmit` inside `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile` to verify there are 0 TypeScript compilation errors.
   - Record exact build and test command results in your handoff report.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please write your findings and progress report to `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\worker_dsp_mix\handoff.md`.

</USER_REQUEST>
