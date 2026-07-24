# BRIEFING — 2026-07-24T11:16:30Z

## Mission
Implement Milestone 1: Location Recommendation, Haversine Distance Sorting, 3-Minute Throttle, and Safe activeIndex Management.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\worker_m1
- Original parent: a41a2087-8fa1-431b-8a3e-c9955d6cf3d5
- Milestone: Milestone 1

## 🔒 Key Constraints
- Reusable Haversine distance utility in `core_engine/src/utils/haversine.ts` with validation and clamped atan2 math.
- Map screen R1: On mount, read `@anywayTheSea:bg_location_state` from AsyncStorage. If `lastLatitude` & `lastLongitude` exist, set `userLocation`, sort `places` array by Haversine distance, and set `index = 0` (closest place). Fallback to normal load if not found.
- Map screen R2: Sort places array by Haversine distance so closest place is index 0.
- Map screen R3: In `watchPositionAsync`, enforce 3-minute (180,000 ms) cooldown via `lastSortTimeRef`. Preserve selected place ID during re-sort to update `index` safely.
- Run build/tsc checks & unit tests. Write `changes.md` and `handoff.md`.

## Current Parent
- Conversation ID: a41a2087-8fa1-431b-8a3e-c9955d6cf3d5
- Updated: 2026-07-24T11:16:30Z

## Task Summary
- **What to build**: Haversine utility + tests, map.tsx refactoring for R1, R2, R3.
- **Success criteria**: All requirements implemented genuinely, tsc passes, tests pass, handoff documented.

## Key Decisions Made
- Create `core_engine/src/utils/haversine.ts` for clean shared math.
- Update `core_engine/src/api.ts` to use `getHaversineDistance`.
- Update `app/(tabs)/map.tsx` to handle background location reading, distance sorting, 3-min cooldown, safe index preservation.

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: Pending
- **Tests added/modified**: Pending

## Loaded Skills
- None

## Artifact Index
- `.agents/worker_m1/ORIGINAL_REQUEST.md` — Original request
- `.agents/worker_m1/BRIEFING.md` — Agent briefing
