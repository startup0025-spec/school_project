# Original User Request

## Initial Request — 2026-07-24T02:14:45Z

<USER_REQUEST>
You are the Project Orchestrator for the project defined in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\ORIGINAL_REQUEST.md`.

Working directory for your coordination files: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\orchestrator`.
Project root directory: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile`.

Your mission:
Decompose and orchestrate the implementation of the following requirements:
1. R1: Retrieve last known location (`lastLatitude`, `lastLongitude`) from `AsyncStorage` (`@anywayTheSea:bg_location_state`) on component mount in `map.tsx` for instant initial recommendation.
2. R2: Implement Haversine distance-based sorting for places array, making the closest place index 0.
3. R3: Implement continuous real-time distance-based sorting with a strict 3-minute (180,000 ms) cooldown/throttle to prevent UI flickering, while safely updating `activeIndex` so no out-of-bounds or invalid state crashes occur.

Execute the standard Teamwork workflow:
- Decompose into milestones/tasks.
- Write your `plan.md` and keep `progress.md` updated continuously.
- Dispatch implementation/review specialists as appropriate.
- Verify all acceptance criteria with unit/integration tests and type checks.
- When all work is complete and verified, report completion to the Sentinel.
</USER_REQUEST>
