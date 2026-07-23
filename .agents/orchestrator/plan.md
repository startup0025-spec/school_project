# plan.md — Dynamic Multi-Track DSP Mixing Engine Implementation Plan

## 1. Objectives
- Refactor `mobile/lib/services/audio_engine_service.ts`:
  - Permanently remove legacy single-instance playback and `playEmergencySiren`.
  - Implement `playDynamicMix(waterType: string | undefined)`:
    - Layered multi-track ambient playback: select 3 random assets out of 5 (`sea_1.mp3`..`sea_5.mp3` or `river_1.mp3`..`river_5.mp3`).
    - Apply Chorus Effect: multi-instance playback with pitch/rate (e.g., 0.92-1.08) and time position offset variations.
    - 1 wind sound track (`wind_1.mp3`..`wind_5.mp3`) with real-time `setInterval` volume envelope animation (simulating gusts).
  - Ensure `stopAmbientSound()` clears all intervals/timers, unpins all active files, and unloads 100% of active `Audio.Sound` instances (`unloadAsync`).
- Update `mobile/lib/services/audio_caching_service.ts`:
  - Update `BUNDLED_SOUNDS` map to include fallback definitions for all 15 CDN sound assets (`sea_1..5`, `river_1..5`, `wind_1..5`).
- Refactor `mobile/app/(tabs)/sound.tsx`:
  - Bridge UI chip button click & mount/toggle events to `playDynamicMix`.
- Update `mobile/lib/services/geofencing_service.ts`:
  - Replace legacy `playEmergencySiren` and `playAmbientSound` calls with `playDynamicMix`.
- Verification & Audit:
  - Run `tsc --noEmit` in `mobile/` directory to ensure 0 compilation errors.
  - Reviewer verification for memory leak prevention, offline CDN fallback defense, and chorus DSP mixing logic.
  - Forensic integrity audit to ensure clean, authentic implementation.

## 2. Work Breakdown & Milestones
- **Milestone 1: Audio Service & Fallback Refactoring**
  - Worker updates `audio_caching_service.ts` to map all 15 CDN assets to local bundled fallbacks.
  - Worker refactors `audio_engine_service.ts` implementing `playDynamicMix` multi-instance layering, chorus pitch/offset variations, wind volume envelope interval, and leak-free `stopAmbientSound`.
- **Milestone 2: UI Bridge & Consumer Integration**
  - Worker updates `mobile/app/(tabs)/sound.tsx` to connect `playDynamicMix`.
  - Worker updates `mobile/lib/services/geofencing_service.ts` to replace `playEmergencySiren` / `playAmbientSound` with `playDynamicMix`.
- **Milestone 3: Compilation & Type Verification**
  - Worker executes `npx tsc --noEmit` in `mobile/` workspace to verify 0 TypeScript errors.
- **Milestone 4: Independent Review & Forensic Integrity Audit**
  - Reviewer subagent tests and verifies memory leak prevention, offline fallback, and chorus DSP logic.
  - Forensic Auditor subagent audits codebase for integrity violations.

## 3. Execution Constraints
- All code changes executed strictly via worker subagent.
- Full verification of build, types, memory safety, and integrity.
