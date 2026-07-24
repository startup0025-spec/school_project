# Absolute Unified Record Schema - BERRY 🍎
Timestamp: 2026-07-23T20:43:50+09:00
Agent: BERRY 🍎 (worker_dsp_mix)
Task: Audio Mixing Engine Refactoring for Anyway_the_Sea

## Execution Summary
1. `mobile/lib/services/audio_caching_service.ts`:
   - Updated `BUNDLED_SOUNDS` to map all 15 CDN assets (`sea_1.mp3`..`sea_5.mp3`, `river_1.mp3`..`river_5.mp3`, `wind_1.mp3`..`wind_5.mp3`) to local bundled fallback assets (`ambient_sea.mp3`, `ambient_river.mp3`, `white_noise_wind.mp3`).
   - Verified `resolveAudioSource` and `loadSoundWithFallback` fallback behavior.

2. `mobile/lib/services/audio_engine_service.ts`:
   - Permanently removed `playEmergencySiren` and single instance playback logic (`ambientSound`, `windSound`, `sirenSound`).
   - Implemented `playDynamicMix(waterType: string | undefined)`:
     - Selects 3 random distinct ambient sound assets out of 5 (`sea_1`..`sea_5` or `river_1`..`river_5`).
     - Plays all 3 ambient instances overlaid with pitch/rate variation (0.95, 1.0, 1.05) and random time position offset (`setPositionAsync`) for organic chorus effect.
     - Selects 1 random wind asset out of 5 (`wind_1`..`wind_5`), plays looping, and launches real-time `setInterval` volume envelope animation (fluctuating every 500-1000ms).
     - Maintains active sound instances (`Audio.Sound[]`), active filenames, and interval IDs.
   - Implemented `stopAmbientSound()` clearing volume envelope intervals, unpinning active files, and calling `stopAsync()` + `unloadAsync()` on 100% of active sound instances.
   - Exported `playAmbientSound` as backward compatibility alias to `playDynamicMix`.

3. `mobile/app/(tabs)/sound.tsx`:
   - Bridged UI ambient chip buttons and toggle state to call `playDynamicMix`.

4. `mobile/lib/services/geofencing_service.ts`:
   - Updated imports and replaced `playEmergencySiren` and `playAmbientSound` calls with `playDynamicMix(targetPlace.waterType)`.

5. Verification:
   - Command: `cmd /c "npx tsc --noEmit"` in `mobile/`
   - Result: Exit code 0, 0 compilation errors.
