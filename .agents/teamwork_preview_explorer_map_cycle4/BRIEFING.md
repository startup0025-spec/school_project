# BRIEFING — 2026-07-16T09:20:00+09:00

## Mission
Design the clean-up of relative rendering coordinates, update mock data with real coordinates, and align map.tsx with the SWR places engine.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Explorer, Planner, Auditor
- Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle4\
- Original parent: c962bb36-f85e-4209-b770-96ed50d997f4
- Milestone: Cycle 4 Map Integration Planning

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Write files only to own folder
- Align with the `Place` model and SWR strategy
- Do not look at the `A_T_I` folder

## Current Parent
- Conversation ID: c962bb36-f85e-4209-b770-96ed50d997f4
- Updated: 2026-07-16T09:20:00+09:00

## Investigation State
- **Explored paths**:
  - `mobile/constants/mockData.ts` (QuietSpot interface & QUIET_SPOTS array)
  - `mobile/app/(tabs)/map.tsx` (screen rendering and coordinate overlay layout)
  - `scripts/pipeline/data/water_stations.js` (Busan coordinates source database)
  - `mobile/core_engine/src/models/place_model.ts` (Place interface)
  - `mobile/core_engine/src/database/local_places.ts` (SWR getPlaces database method)
- **Key findings**:
  - Legacy `pin: { x, y }` coordinates can be safely removed and replaced with real coordinates.
  - QuietSpot can extend Place and rename `note` to `description` to align with the core engine.
  - SWR data fetch `getPlaces()` inside `map.tsx` can be set up to gracefully fallback to `QUIET_SPOTS` with real coordinates when offline or empty.
- **Unexplored areas**:
  - WebView load optimization and API quota monitoring (handled in Cycle 3/5).

## Key Decisions Made
- Extends `Place` interface inside `QuietSpot` to keep compatibility while maintaining core engine structure.
- Removed pin overlays in the offline fallback layout to avoid alignment distortion.

## Artifact Index
- C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle4\analysis.md — Migration plan and proposed code snippets
- C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle4\handoff.md — Five-part handoff report
