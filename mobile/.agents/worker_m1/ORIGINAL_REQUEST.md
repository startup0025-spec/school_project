## 2026-07-24T11:16:24Z
<USER_REQUEST>
You are the Worker agent implementing Milestone 1 (Location Recommendation, Haversine Distance Sorting, 3-Minute Throttle, and Safe activeIndex Management).

Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\worker_m1
Project root: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile
Parent Conversation ID: a41a2087-8fa1-431b-8a3e-c9955d6cf3d5

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your instructions:
1. Review the Explorer analysis reports:
   - C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\explorer_m1_1\analysis.md
   - C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\explorer_m1_2\analysis.md
   - C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\explorer_m1_3\analysis.md

2. Create a reusable Haversine distance utility (e.g. in `core_engine/src/utils/haversine.ts`) with robust coordinate validation, lat [-90, 90] / lng [-180, 180] checks, and clamped atan2 math. Write unit tests for this utility if test runner exists.

3. Refactor `app/(tabs)/map.tsx`:
   - R1: On mount, read `@anywayTheSea:bg_location_state` from AsyncStorage. If `lastLatitude` & `lastLongitude` exist, set `userLocation`, sort `places` array by Haversine distance, and set `index = 0` (closest place). If not available, fall back to initial load and wait for foreground update.
   - R2: Sort places array by Haversine distance so the closest place becomes index 0.
   - R3: In the foreground `Location.watchPositionAsync` callback, enforce a strict 3-minute (180,000 ms) cooldown between re-sorts using a `lastSortTimeRef` (`useRef<number>(0)`).
     - When re-sorting, preserve the currently selected place by finding its ID (`currentSelectedId`) in the newly sorted array and updating `index` to the new position (`newIdx !== -1 ? newIdx : 0`), preventing UI jumps and out-of-bounds crashes.

4. Run build commands, TypeScript checks (`npx tsc --noEmit` or equivalent), and unit/integration tests in the project. Verify everything passes.

5. Document changes in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\worker_m1\changes.md` and create a Handoff report `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\worker_m1\handoff.md` with:
   - Observation & Logic Chain
   - File changes made
   - Commands executed and build/test outputs
   - Verification results

6. Send a summary message to parent (ID: a41a2087-8fa1-431b-8a3e-c9955d6cf3d5) via send_message when complete.
</USER_REQUEST>
