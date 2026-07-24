## 2026-07-24T02:21:29Z
You are Worker 2 (remediation pass) for Milestone 1.

Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\worker_m1_gen2
Project root: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile
Parent Conversation ID: a41a2087-8fa1-431b-8a3e-c9955d6cf3d5

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work.

Your task:
Resolve the review findings from Reviewer 2 and Challenger 1:

1. **Fix React State Updater Side Effect (`app/(tabs)/map.tsx`)**:
   In `Location.watchPositionAsync` callback: Do NOT call `setIndex(...)` inside the `setPlaces((prevPlaces) => ...)` functional state updater callback!
   Instead:
   - Access current places and current index.
   - Sort places copy using `sortPlacesByDistance`.
   - Calculate `newIdx` by finding `currentSelectedId` in sorted array.
   - Call `setPlaces(sorted);` and `setIndex(newIdx !== -1 ? newIdx : 0);` separately without nesting state updates.

2. **Fix `activeIndex` Boundary Guard (`app/(tabs)/map.tsx`)**:
   Ensure `index >= 0` check is included:
   Change `const activeIndex = index < places.length ? index : 0;`
   To `const activeIndex = index >= 0 && index < places.length ? index : 0;`.

3. **Fix Null Element Handling in `sortPlacesByDistance` (`core_engine/src/utils/haversine.ts`)**:
   Add null/undefined element checks before accessing `a.latitude` or `b.latitude`:
   ```typescript
   if (!a && !b) return 0;
   if (!a) return 1;
   if (!b) return -1;
   ```

4. **SWR Subscription Dependency Fix (`app/(tabs)/map.tsx`)**:
   Optimize SWR `useEffect` subscription so it does not re-subscribe on every `userLocation` change.

5. **Verification**:
   Run `npm run typecheck` and `npm test` to verify 0 type errors and 100% passing tests.

6. Document changes in C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\worker_m1_gen2\changes.md and create handoff.md.
7. Send summary message to parent (ID: a41a2087-8fa1-431b-8a3e-c9955d6cf3d5) when complete.
