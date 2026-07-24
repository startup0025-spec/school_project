## 2026-07-16T00:17:26Z

You are teamwork_preview_explorer. Your working directory is C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle4\.
Your task is to analyze and formulate the Data Clean-up & Migration Plan for the Kakao Map API Integration in Anyway, the Sea.
Your objective for Cycle 4:
1. Design the cleanup of the dummy rendering data. Explain how we will remove the relative coordinate projection system (e.g. `pin: { x, y }` in `mockData.ts` and its mapping inside `map.tsx`).
2. Update the `QuietSpot` interface and the hardcoded `QUIET_SPOTS` array in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\constants\mockData.ts` to include real `latitude` and `longitude` fields based on actual Busan coordinates (e.g., using coordinates close to the real water stations in `water_stations.js` like 부곡교, 세병교, 이섭교, 동천교, 세월교).
3. Align the spots data structure inside `map.tsx` to utilize the core engine's `Place` model from `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\core_engine\src\models\place_model.ts`. Detail how `local_places.ts`'s SWR strategy will feed data to `map.tsx` at runtime (if `getPlaces()` returns data, we load those markers; otherwise, we fall back to the updated `QUIET_SPOTS` mock data with real coordinates).
4. Write your detailed findings and migration checklist to C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle4\analysis.md.
Report back with send_message once done.
