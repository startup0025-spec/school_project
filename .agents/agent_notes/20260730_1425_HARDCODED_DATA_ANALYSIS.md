# Absolute Unified Record Schema

## 1. Context & State
- User suspects the locations are hardcoded after I explained that there are only 5 river/stream spots in the database.
- They asked "Are the places hardcoded? ....?"
- My investigation of `local_places.ts` and `mockData.ts` reveals that the "API" is actually a static JSON file on GitHub Pages, and there are multiple layers of hardcoded mock data (e.g., `QUIET_SPOTS` containing 3 stream spots).

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will explain the bitter truth to the user: their "API" is just a static JSON file with 5 places, and there's a hardcoded mock array (`QUIET_SPOTS`) with 3 places.
- There is no dynamic database pulling all of Busan's locations. It's all statically defined, and all of them are rivers/streams.

## 3. Execution Log
- (Pending) Explain the hardcoded nature of the data to the user.
