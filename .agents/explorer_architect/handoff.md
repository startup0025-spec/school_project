# Handoff Report — Caching Locks, Timeout Fallbacks & Watchdog Limits (Cycle 7 & 9 Final Plan Revision)

**Author**: Lead Architect (explorer_architect / BERRY 🍎)  
**Date**: 2026-07-16T05:51:35+09:00  

---

## 1. Observation

During my investigation and the Victory Audit review, I made the following direct observations:

*   **Concurrency Leak in `loadSoundWithFallback`**: In Section 4.2 sketch, the function ran `Promise.race` between `loadPromise` and `timeoutPromise`. If the timeout fired first, the promise rejected and was caught. In the outer `catch` block, if `didTimeout` was true, the function initiated a duplicate `Audio.Sound.createAsync(source, ...)` loader to handle unloading when it late-resolved. This caused a concurrency leak/double download. Additionally, the original `loadPromise` had no `.catch` handler attached to it directly, causing `Unhandled Promise Rejection` warnings/crashes when the late load eventually failed.
*   **Unhandled Rejection in Background Prefetching**: In Section 5.1 sketch for `geofencing_service.ts`, `Promise.race` was run between `prefetchPromise` and `timeoutPromise`. If the timeout fired first, the race rejected. When `cancelActiveDownloads()` was called, it aborted active downloads. However, the background `prefetchPromise` was left dangling without a `.catch(...)` block to catch the cancellation error, causing an `Unhandled Promise Rejection` error after the timeout handler had exited.
*   **Missing `'swr'` Library Dependency**: The customized React hook `useSpots.ts` (Section 6) relies on `useSWR` from `'swr'`. However, `'swr'` was missing from the `dependencies` list in `mobile/package.json` (Section 2.1) and was not included in the installation command list in Section 2.2 and Section 7.

---

## 2. Logic Chain

1.  **Resolving Concurrency Leak and Suppressing Late Errors**:
    - By chaining `.then` and `.catch` handlers directly onto `loadPromise` *before* passing it to `Promise.race` to form `wrappedLoadPromise`, we ensure the single original download promise itself handles its cleanup and errors.
    - If a timeout occurs (`didTimeout` is true), the wrapped `.then` handler automatically catches the late resolution and unloads the sound instance immediately.
    - The wrapped `.catch` handler automatically catches the late rejection, logs/suppresses the error, and returns `undefined as any` so it resolves cleanly.
    - This eliminates the need for the duplicate `Audio.Sound.createAsync` background loader call inside the outer catch block.
2.  **Resolving Unhandled Rejection in Geofencing Prefetching**:
    - Attaching a `.catch(...)` block directly to `prefetchPromise` right after its declaration ensures that when downloads are aborted via `cancelActiveDownloads()`, any late rejection from `prefetchAudioAssets` is caught and suppressed.
    - If the prefetch completes or fails prior to the 8-second timeout, `Promise.race` behaves normally since the race uses the original `prefetchPromise`.
3.  **Correcting Package Dependencies**:
    - Adding `"swr": "^2.2.5"` to the `dependencies` JSON block in Section 2.1 and updating the Expo/npm install commands in Sections 2.2 and 7 ensures SWR is properly installed and cached in node_modules, ensuring successful compilation.

---

## 3. Caveats

*   **Mock Verification Only**: Since I am restricted by the read-only investigation constraint, these fixes were implemented as sketches inside the markdown document `final_implementation_plan.md`. The actual codebase source files (`audio_engine_service.ts`, `geofencing_service.ts`, `package.json`) were not modified.
*   **Asset Consistency**: The offline fallback requires `BUNDLED_SOUNDS` to contain matching keys for all files. If keys in `resolveAudioSource` do not map to `BUNDLED_SOUNDS`, the engine will fail to resolve the asset.

---

## 4. Conclusion

I have successfully updated `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_architect/final_implementation_plan.md` to resolve all three critical issues identified by the Victory Auditor:
1.  **Concurrency Leak Fixed**: Chained `.then` and `.catch` onto `loadPromise` directly before `Promise.race` and removed the duplicate background loader call from the outer catch block.
2.  **Unhandled Rejection in Geofencing Fixed**: Attached `.catch(...)` to `prefetchPromise` inside `processLocationUpdate` to handle late cancellation rejections.
3.  **Missing Dependency Added**: Added `"swr": "^2.2.5"` to package dependencies and installation commands in Sections 2.1, 2.2, and 7.

---

## 5. Verification Method

To independently verify the changes:
1.  **Inspect `final_implementation_plan.md`**:
    - Locate the `loadSoundWithFallback` function in Section 4.2. Verify the `wrappedLoadPromise` declaration and the removal of the duplicate background loader call.
    - Locate `processLocationUpdate` in Section 5.1. Verify that `prefetchPromise.catch(...)` is attached to suppress late rejections.
    - Check Section 2.1, 2.2, and 7 to verify the presence of `"swr": "^2.2.5"` and its installation command.
2.  **Compilation & Testing**:
    - Once the sketches are applied to the source code, verify compilation by running `npm run typecheck` inside `mobile`.
