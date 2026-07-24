# Handoff Report — Explorer M1_2 (Haversine & Distance Sorting Analysis)

## 1. Observation
- **`map.tsx`**: Located at `app/(tabs)/map.tsx`.
  - Lines 11–14 import `QUIET_SPOTS` from `@/constants/mockData`, `getPlaces` / `subscribeToPlacesCache` from `@/core_engine/src/database/local_places`, and `Place` from `@/core_engine/src/models/place_model`.
  - Lines 290–308 define an inline `getHaversineDistance(lat1, lon1, lat2, lon2)` function.
  - Line 294 contains a typo in input validation: `isNaN(lat1)` is checked twice instead of checking `isNaN(lon1)`.
  - Lines 351–356 define state `places` and `userLocation`.
  - `places` is loaded into state via `getPlaces()` or fallback `QUIET_SPOTS`, but is **never sorted** by distance relative to `userLocation`.
- **`place_model.ts`**: Located at `core_engine/src/models/place_model.ts`.
  - Lines 36–133 define interface `Place` with `latitude: number` and `longitude: number`.
- **`mockData.ts`**: Located at `constants/mockData.ts`.
  - Lines 43–85 define `QuietSpot` interface extending `Place` and `QUIET_SPOTS` fallback array.
- **`api.ts`**: Located at `core_engine/src/api.ts`.
  - Lines 13–34 define an unexported `haversineDistance(lat1, lng1, lat2, lng2)` helper using $R = 6,371,000$ meters and `clampedA = Math.max(0, Math.min(1, a))`.

## 2. Logic Chain
1. *Observation*: `map.tsx` renders `currentPlace = places[activeIndex]`, where `activeIndex` defaults to `0`. `places` is set from `getPlaces()` without distance sorting.
2. *Deduction*: When a user opens the map tab, the first spot shown at index 0 is determined by database insertion order or static JSON order, not by spatial proximity to the user's GPS coordinates.
3. *Requirement Alignment*: Requirement R2 specifies that `places` in `map.tsx` must be sorted by Haversine distance from the user location so the closest place is positioned at index 0.
4. *Deduction*: Adding a derived `sortedPlaces` computation via `useMemo` when `userLocation` is present ensures index 0 always contains the nearest spot while preserving reactivity and avoiding unnecessary state re-renders.
5. *Observation*: Math logic is currently duplicated between `map.tsx` and `api.ts`, with `map.tsx` containing an input validation typo.
6. *Deduction*: Extracting a pure, edge-case-safe Haversine utility to `core_engine/src/utils/haversine.ts` provides a single source of truth for both `map.tsx` sorting and `api.ts` geofencing.

## 3. Caveats
- **Offline / Null Location State**: When GPS location permission is denied or location fix has not yet completed (`userLocation === null`), `sortedPlaces` must fallback gracefully to default `places` order without raising runtime errors.
- **Location Drift**: Fast walking or driving causes frequent `userLocation` state updates. Using `useMemo` prevents unnecessary DOM/WebView re-mounting while keeping index 0 aligned to the nearest place.
- **Source Code Integrity**: As an Explorer agent, no modifications were made to project source files (`app/(tabs)/map.tsx`, `core_engine/src/api.ts`). Code proposals are documented in `analysis.md`.

## 4. Conclusion
- A standalone Haversine utility should be created at `core_engine/src/utils/haversine.ts` with strict coordinate validation and domain clamping.
- In `app/(tabs)/map.tsx`, `sortedPlaces` should be computed via `useMemo([places, userLocation])`. The UI card (`renderCard`), WebView marker updates, and spot focusing should consume `sortedPlaces` to fulfill Requirement R2.

## 5. Verification Method
- **File Inspection**:
  - Inspect `app/(tabs)/map.tsx` lines 290–308 to verify existing inline helper.
  - Inspect `core_engine/src/api.ts` lines 13–34 to verify existing geofence distance logic.
  - Inspect `analysis.md` in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\explorer_m1_2\analysis.md` for full implementation design.
- **Verification Criteria for Implementer**:
  - Verify `sortedPlaces[0]` equals the place with minimum Haversine distance from `userLocation`.
  - Verify index resets to `0` when user location first resolves.
