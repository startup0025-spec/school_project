## 2026-07-15T20:28:07Z

You are the Lead Architect for the Anyway the Sea project.
Your task is to draft the INITIAL architecture proposal (Cycle 1 Draft) for two major overhauls:
1. Map Projection overhaul: How to convert WGS84 coordinates (lat/lng) of places/user to screen relative coordinates (x, y) on the static map `quiet-map.png`.
2. Audio CDN Streaming: How to migrate local audio files to a CDN, stream them using `expo-av`, pre-fetch/cache them using `expo-file-system` to support offline playback with fallbacks.

Read the blueprint: `C:/Users/user/Desktop/school_contest/blueprints/교육청 대회용 앱 간단 설계서.txt`
Read existing code:
- `mobile/app/(tabs)/map.tsx`
- `mobile/lib/services/audio_engine_service.ts`
- `mobile/core_engine/src/database/local_places.ts`
- `mobile/core_engine/src/models/place_model.ts`

Write your Cycle 1 Draft architecture proposal in markdown to `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_architect/cycle1_draft.md`.
Do NOT write or edit any source files in app directories.
When done, reply with a handoff message summarizing your findings and proposal.

## 2026-07-15T20:32:58Z

Context: Urgent pivot to Audio CDN Overhaul only.
Content: Under parent directives, all map projection tasks are halted immediately. Please discard all coordinate mapping and affine transformation math. Focus 100% of your work on the Audio CDN Streaming and Offline Cache Manager. Write the refined proposal containing ONLY the audio CDN caching and offline fallbacks design, including package setup and offline logic.
Action: Pivot and write the refined proposal to `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_architect/cycle2_refined.md`.

## 2026-07-15T20:36:31Z (Orchestrator Directive)

All work towards the final implementation plan is paused as BERRY has extended the discussion to 10 cycles. Please write the Cycle 3 Refined Design incorporating:
1. Exact import fix for the TS compile error in `mobile/app/notifications.tsx`.
2. LRU Eviction & Active Playback Deadlock Prevention: Mark playing files as pinned (non-evictable) in the LRU cache, and ensure files are fully unloaded in `expo-av` BEFORE their cached copies are deleted from disk.
3. Headless Background Cache Pre-fetching: Analyze OS background execution limits (10-30s) and design the geofencing service to only download the immediate 1-2 assets needed for the entered geofence, deferring bulk pre-fetching to foreground idle states.
Action: Write this refined proposal to `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_architect/cycle3_refined.md`.

## 2026-07-16T05:36:26+09:00 (User Request)

You are the Lead Architect for the Anyway the Sea project.
Your task is to write the FINAL SYNTHESIZED ARCHITECTURE & IMPLEMENTATION PLAN (Cycle 5 Final Plan) for the Audio CDN Streaming and Caching overhaul.

Read the Critic's Cycle 3 Critique: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/critic_reviewer/cycle2_critique.md`.

Your final plan must contain the verified production-grade designs for:
1. Target Dependency Changes: Adding `"expo-file-system": "~18.0.8"` and `"expo-network": "~18.0.8"` to `mobile/package.json`. Detailed installation commands.
2. Audio Caching Service (`mobile/lib/services/audio_caching_service.ts`):
   - Cache-first prioritization check.
   - Sequential download queue to prevent startup bandwidth saturation.
   - Map of active Resumable Downloads (`FileSystem.DownloadResumable`) and `.cancelAsync()` execution on aborts to prevent bandwidth waste.
   - Storage Limit & LRU Eviction Manager: Size monitoring, evicting oldest used files when cache footprint exceeds 50MB down to 30MB, tracking metadata in `sounds_metadata.json`.
3. Concurrency-Safe Playback Service (`mobile/lib/services/audio_engine_service.ts`):
   - Auto-incrementing `activePlaybackRequestId` concurrency token lock checking.
   - Explicitly stopping and unloading `ambientSound`, `windSound`, and `sirenSound` channels.
   - Bypassing network check for the bundled `emergency_siren.wav` file.
4. Stabilized SWR Sync Hook (`mobile/hooks/useSpots.ts`):
   - React hook mapping SWR `spots` updates.
   - Stabilized dependency string to prevent redundant re-fetching disk reads.
5. Pre-existing Compile Error Remediation:
   - Document the missing imports (`useState`, `useEffect`) from `'react'` in `mobile/app/notifications.tsx` and provide the exact import replacement code.
6. Detailed Step-by-Step Implementation Sequence:
   - Command sequences.
   - Testing/validation checklist for post-integration verification.

Write your final plan in markdown to `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_architect/final_implementation_plan.md`.
Do NOT write or edit any source files in app directories.
When done, reply with a handoff message summarizing the final plan.

## 2026-07-15T20:41:06Z

You are the Lead Architect for the Anyway the Sea project.
Your task is to write the REFINED CACHING MANAGER & BACKGROUND TASK SKETCHES (Cycle 7 Refined Design) incorporating the Critic's Cycle 6 Critique and BERRY's directives.

Read the Critic's Critique: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/critic_reviewer/cycle3_critique.md`.

You must implement and detail:
1. **`loadSoundWithFallback`**:
   - Write a helper loading function inside `audio_engine_service.ts` that loads network resources with a 5000ms timeout (`Promise.race` between the loading promise and a reject timeout).
   - If loading fails or times out, immediately catch the error and fallback to loading the corresponding bundled require asset from `BUNDLED_SOUNDS` to prevent silent freezes.
2. **`loadingFiles` Lock Pool**:
   - Implement a temporary lock set `loadingFiles` in `audio_caching_service.ts`.
   - Provide `lockFileForLoading(filename)` and `unlockFileForLoading(filename)`.
   - Update `enforceCacheLimits` to skip files in `loadingFiles` or `pinnedFiles`.
   - In `audio_engine_service.ts`, acquire the lock before resolving and loading, and release/unlock it after loading completes (or in a finally block if loading fails).
3. **8-Second Background Timeout**:
   - Refine sequential pre-fetching for background geofencing transitions in `geofencing_service.ts` and `audio_caching_service.ts` to enforce a hard 8-second limit.
   - If the pre-fetching times out or fail, abort active download tasks using the resumable downloads map (`activeDownloads`) and fall back immediately to bundled assets to prevent OS watchdog termination.
4. **Complete Unified TypeScript Sketches**:
   - Update your code sketches for `audio_caching_service.ts` and `audio_engine_service.ts` with these features.

Write your refined design in markdown to `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_architect/cycle4_refined.md`.
Do NOT modify any actual source files in the app directories.
When done, reply with a handoff message summarizing your solutions.

## 2026-07-15T20:45:46Z (Orchestrator Directive - Cycle 9 Final plan)

Context: Compiling the final verified architecture and implementation plan (Cycle 9).
Content: Please write the FINAL SYNTHESIZED ARCHITECTURE & IMPLEMENTATION PLAN incorporating the Critic's Cycle 8 Critique.
Your code sketches must be fully production-ready and compile-clean, containing:
1. `notifications.tsx` TS Compile import fix.
2. `audio_caching_service.ts`:
   - Reference counting Map `loadingFiles` for locks instead of Set (`lockFileForLoading`, `unlockFileForLoading`).
   - Cache-first check, sequential downloads, and active downloads map tracking (`activeDownloads`).
   - `.downloadAsync()` promise chain for download results (fixing the progress callback type error).
   - Catch block deletes partial temporary files on error/cancel.
   - LRU cache eviction (50MB max, prune to 30MB) skipping pinned/loading files.
   - Reachability check (`isCdnReachable`) with memory cache (10s TTL), 1.5s timeout, and `finally` block timer clear.
   - If pre-fetching fails/times out, cached reachability is immediately set to `false`.
3. `audio_engine_service.ts`:
   - Concurrency request lock `activePlaybackRequestId`.
   - `loadSoundWithFallback` using `Promise.race` with 5s timeout and `didTimeout` state checks to unload late-resolved sounds and suppress late rejection errors.
   - Checks/unloader callbacks registered with caching service.
   - Safety siren network check bypass.
4. geofencing background sequential download abort limits (8s hard timeout) in `geofencing_service.ts`.
Write this complete document to `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_architect/final_implementation_plan.md`.
Action: Compile and write the final implementation plan to the specified path.

## 2026-07-15T20:51:35Z

You are the Lead Architect for the Anyway the Sea project.
Your task is to fix the three critical issues identified by the Victory Auditor inside `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_architect/final_implementation_plan.md`:

1. **Concurrency Leak in `loadSoundWithFallback` (Section 4.2 sketch)**:
   - Chain `.then` and `.catch` handlers directly onto `loadPromise` BEFORE passing it to `Promise.race([wrappedLoadPromise, timeoutPromise])` to form `wrappedLoadPromise`.
   - In the `.then` handler: if `didTimeout` is true, unload the sound immediately.
   - In the `.catch` handler: if `didTimeout` is true, catch and log/suppress the late rejection error to prevent `Unhandled Promise Rejection` warning/crashes, and return `undefined as any` so it resolves cleanly.
   - Remove the duplicate `Audio.Sound.createAsync(source, ...)` background loader call from the catch block when `didTimeout` is true.

2. **Unhandled Rejection in Geofence prefetching (Section 5.1 sketch)**:
   - In `geofencing_service.ts` sketch, attach a `.catch(...)` block to `prefetchPromise` to handle/suppress late cancellation errors when downloads are aborted via `cancelActiveDownloads()`.

3. **Missing `'swr'` Library Dependency (Section 2.1 & 2.2)**:
   - Add `"swr": "^2.2.5"` to the dependencies JSON list in Section 2.1.
   - Include `swr` in the CLI install commands in Section 2.2 (`npx expo install expo-file-system expo-network swr` or `npm install swr`).

Ensure all modifications are fully updated inside `final_implementation_plan.md`. Do not write or edit any source files in app directories.
When done, reply with a handoff message summarizing the changes.
