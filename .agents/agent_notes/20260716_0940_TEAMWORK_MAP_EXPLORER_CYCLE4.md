---
RECORD_ID: "20260716_0940_TEAMWORK_MAP_EXPLORER_CYCLE4"
RECORD_TYPE: "[LOG]"
TARGET: "Kakao Map Data Cleanup & SWR Migration Plan for Cycle 4"
---
[1_WHAT] (State & Context):
> We analyzed the cleanup of relative coordinates projection in `mockData.ts` and `map.tsx` and aligned the spots data structure with the core engine's `Place` model.

[2_HOW] (Action & Details):
- We designed the removal of the relative projection `pin` coordinates and absolute positioning wrapper `pinWrap` from `map.tsx`.
- We updated the `QuietSpot` interface and `QUIET_SPOTS` in `mockData.ts` to include real Busan coordinates from `water_stations.js` (세월교, 세병교, 부곡교).
- We formulated the SWR loading strategy in `map.tsx` leveraging `getPlaces()` and setting up fallback to `QUIET_SPOTS`.
- We detailed the integration of WebView script and React Native postMessage events.

[3_WHY] (Reasoning & Dependency):
- Eliminating relative pin overlays prevents layout scaling distortion across varying screen resolutions and aligns with physical coordinates.
- SWR strategy ensures data freshing from GitHub Pages CDN without blocking critical path UI rendering.

[4_NEXT] (Status & Follow-up):
- Save detailed plan to `analysis.md` and `handoff.md`.
- Report completion to the main agent.
