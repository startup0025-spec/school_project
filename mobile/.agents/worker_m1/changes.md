# Milestone 1 Code Modifications Summary

## Overview
Implemented Milestone 1 requirements: Location Recommendation, Haversine Distance Sorting, 3-Minute Throttle, and Safe activeIndex Management.

## Modified & Added Files

### 1. `core_engine/src/utils/haversine.ts` (New File)
- Created reusable math utility `getHaversineDistance(lat1, lng1, lat2, lng2)`.
- Exported `isValidCoordinate(lat, lng)` enforcing strict latitude [-90, 90] and longitude [-180, 180] checks, `typeof === 'number'`, non-NaN, and finite checks.
- Clamped atan2 input range $a \in [0, 1]$ to prevent floating-point precision domain errors.
- Exported `sortPlacesByDistance(placesList, userCoords)` which returns a new sorted array with closest place at index 0.

### 2. `core_engine/src/utils/__tests__/haversine.test.ts` & `map_recommendation.test.ts` (New Files)
- Added 10 unit tests for coordinate validation, Haversine distance, and distance sorting.
- Added 3 integration unit tests for R1/R2 background location recommendation, R3 safe activeIndex mapping, and 3-minute cooldown throttling logic.

### 3. `core_engine/src/api.ts` (Refactored)
- Replaced duplicate internal `haversineDistance` function with imported `getHaversineDistance` from `./utils/haversine`.

### 4. `app/(tabs)/map.tsx` (Refactored)
- **R1 (Instant Initial Recommendation on Mount)**: Added initial load step reading `@anywayTheSea:bg_location_state` from `AsyncStorage`. If `lastLatitude` and `lastLongitude` exist, populates `userLocation`, sorts `places` by proximity, and sets `index = 0` (closest spot).
- **R2 (Distance Sorting)**: Uses `sortPlacesByDistance` to position the nearest spot at index 0.
- **R3 (3-Minute Cooldown & Safe activeIndex)**:
  - Added `SORT_COOLDOWN_MS = 180000` (3 minutes) and `lastSortTimeRef` (`useRef<number>(0)`).
  - In `Location.watchPositionAsync` callback, checks 3-minute cooldown before re-sorting.
  - Preserves selected place ID (`currentSelectedId`) across re-sorts and updates `index` to `newIdx !== -1 ? newIdx : 0` to eliminate UI jumps and out-of-bounds errors.
- Removed buggy inline `getHaversineDistance` helper.

### 5. `package.json` & `tsconfig.json` (Configuration)
- Updated `package.json` with `"test"` script (`node --experimental-strip-types --test core_engine/src/utils/__tests__/*.test.ts`).
- Updated `tsconfig.json` with `"allowImportingTsExtensions": true` and `"noEmit": true`.
