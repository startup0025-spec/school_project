## 2026-07-23T14:30:45Z
<USER_REQUEST>
You are a worker agent assigned to fix all identified bugs, memory leaks, React hook dependency flaws, string escaping vulnerabilities, timezone calculation errors, and type safety issues across the 'Anyway_the_Sea' repository, and verify type safety with `npx tsc --noEmit` inside `mobile/`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Working directory for metadata: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_worker_audit_fix`

Scope of fixes to implement:

1. **`mobile/app/(tabs)/map.tsx`**:
   - Fix Location Watcher cleanup race condition: Track `isMounted`/`active` flag and ensure `subscription` is immediately removed if component unmounted or lost focus before `watchPositionAsync` promise resolved.
   - Fix WebView IPC string escaping in `updateSpots`: Use `JSON.stringify(activeSpotId)` instead of raw single-quoted interpolation `'${activeSpotId}'`.
   - Fix Kakao Map HTML bridgePoller interval: Add max iterations counter (e.g. max 200 iterations = 10s) and clear interval on max retries.
   - Fix camera focus hook dependency: Add `places` to dependency array of camera focus effect.

2. **`mobile/app/(tabs)/sound.tsx`**:
   - Fix React hook dependencies: Include `waterSource` in playing state effect and cleanup stale closure warnings without breaking auto-play / source switching semantics.

3. **`mobile/core_engine/src/api.ts`**:
   - Fix `getKMABaseTime` KST timezone calculation bug: `now.getTime()` is already UTC ms. To get KST date/time, add KST offset (+9 hours) to UTC timestamp. Fix:
     `const utcMs = Date.now() + (now.getTimezoneOffset() * 60 * 1000);` -- NO! `Date.now()` is UTC epoch. `getTimezoneOffset()` returns local offset from UTC in minutes.
     Correct UTC to KST conversion:
     `const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);` (Wait, Date object uses local getters like `.getFullYear()`! The cleanest cross-platform way to get KST Date object in JS):
     ```typescript
     const now = new Date();
     // Convert current time to KST time milliseconds
     const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
     const kst = new Date(utc + (9 * 60 * 60 * 1000));
     ```
     Inspect existing code carefully and fix the double subtraction bug!

4. **`mobile/lib/services/audio_engine_service.ts`**:
   - Fix Volume Envelope Interval Leak: In `windInterval` callback, if `currentRequestId !== activePlaybackRequestId`, call `clearInterval(windInterval)` and exit immediately.
   - Fix `loadSoundWithFallback` timeout/race handling: Ensure defensive optional chaining `result?.sound?.unloadAsync().catch(() => {})` when handling timed out sound instances.

5. **`mobile/lib/services/audio_caching_service.ts`**:
   - Fix `Content-Length` header check: Check both `headers['content-length']` and `headers['Content-Length']` or lowercase header keys before parsing integer.

6. **`mobile/core_engine/src/network/client.ts`**:
   - Fix `offlineStorage` unbounded cache growth: Add periodic pruning / error recovery if `AsyncStorage` write fails or key count exceeds threshold.

7. **`scripts/pipeline/check_grid.js`**:
   - Fix require path: Change `require('./scripts/pipeline/utils/kma_grid')` to `require('./utils/kma_grid')`.

8. **Type Safety Verification**:
   - Run `npx tsc --noEmit` inside `mobile/` using `run_command` and ensure 0 errors.

Write a detailed handoff report in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_worker_audit_fix\handoff.md` with exact changes, test execution commands, and output logs.
Send a message back to the orchestrator when finished.
</USER_REQUEST>
