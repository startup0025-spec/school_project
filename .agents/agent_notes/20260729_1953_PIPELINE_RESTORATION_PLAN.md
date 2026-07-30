# Absolute Unified Record Schema

## 1. Context & State
- User requested a robust, production-ready fix for the data pipeline, avoiding "band-aid" patches.
- The pipeline connects Kakao Map coordinates, KMA Weather API (requires `kmaNx`, `kmaNy`), and Busan Water API (requires exact `waterStationName`).
- I am entering Planning Mode to define exactly how I will populate `busan_places_master.json` and fix `mockData.ts`.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will create `implementation_plan.md` to show the exact JSON structure and real-world locations (matching the API responses) that will be used to restore the system.
- This ensures the user is aware of the changes and can approve the new robust dataset.

## 3. Execution Log
- Wrote log.
- Triggering `write_to_file` to create `implementation_plan.md` with `RequestFeedback=true`.
