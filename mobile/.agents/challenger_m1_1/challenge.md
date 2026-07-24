# Adversarial Challenge Report — Milestone 1 (Haversine & Distance Sorting)

**Working Directory**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\challenger_m1_1`  
**Target Module**: `core_engine/src/utils/haversine.ts`  
**Timestamp**: 2026-07-24T11:21:00Z  

---

## Challenge Summary

**Overall risk assessment**: **LOW**

The Haversine math implementation and distance sorting utilities in `core_engine/src/utils/haversine.ts` are robust, mathematically sound, and well-safeguarded against common numerical pitfalls (e.g. domain overflow in `asin`/`acos`, out-of-bound coordinates, `NaN` propagation). 

Empirical stress testing (including a 10,000 random-pair Monte Carlo stress test, anti-meridian wrap-around tests, antipodal point evaluation, and invalid coordinate sorting tests) confirmed that:
1. `npm run typecheck` passes with **0 errors**.
2. `npm test` passes **13/13 unit tests**.
3. Custom empirical harness tests pass **15/15 edge-case scenarios**.

---

## Challenges

### [Low] Challenge 1: Pole Longitude IEEE 754 Floating-Point Residual

- **Assumption challenged**: At latitude ±90° (North/South Pole), any two longitudes represent the exact same geographic point and should yield a distance of exactly `0` meters.
- **Attack scenario**: Call `getHaversineDistance(90, -180, 90, 180)` where `lat1 === lat2` (90) but `lng1 !== lng2` (-180 vs 180).
- **Observed behavior**: The strict equality shortcut `if (lat1 === lat2 && lng1 === lng2)` evaluates to `false`. Floating-point evaluation of `Math.cos(90°)` in JS returns `6.123233995736766e-17` rather than exact `0`. The calculated distance is `9.554969575338695e-26` meters instead of `0.0`.
- **Blast radius**: Negligible (`9.55e-26` meters is sub-atomic). Will not impact any user-facing sorting or distance display (e.g., `Math.round()` or `toFixed()` produce `0`).
- **Mitigation**: Optionally normalize latitude at ±90° (if `Math.abs(lat) === 90`, treat all longitudes as 0) or use an epsilon comparison for distance equality if exact zero is required.

### [Low] Challenge 2: Non-Array or Non-Object Elements in `sortPlacesByDistance`

- **Assumption challenged**: Input `placesList` is always a valid array of objects containing numeric `latitude` and `longitude` properties.
- **Attack scenario**: Passing an array containing `null`, `undefined`, or non-object elements to `sortPlacesByDistance`.
- **Observed behavior**: Calling `sortPlacesByDistance([null as any], userCoords)` will throw a `TypeError: Cannot read properties of null (reading 'latitude')`.
- **Blast radius**: Low, assuming upstream callers pass typed data objects.
- **Mitigation**: Add element-level null/object checks inside the comparator or filter invalid entries before sorting.

---

## Stress Test Results

| Scenario | Attack Input | Expected Behavior | Actual Behavior | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Poles Boundary** | `(90, 180)`, `(-90, -180)` | `isValidCoordinate` returns `true` | Returned `true` | **PASS** |
| **Out of Bounds** | `lat = 90.0000001` | `isValidCoordinate` returns `false` | Returned `false` | **PASS** |
| **Anti-Meridian Shortest Path** | Equator `(0, 179.9999)` to `(0, -179.9999)` | Shortest path (~22.2m) across 180° meridian | Calculated `22.23m` | **PASS** |
| **Anti-Meridian 10° Gap** | `(0, 175)` to `(0, -175)` | ~1,111,949m | Calculated `1,111,949m` | **PASS** |
| **Pole to Pole** | `(90, 0)` to `(-90, 0)` | Half circumference (~20,015,086.79m) | Calculated `20,015,086.79m` | **PASS** |
| **Antipodal Equator** | `(0, 0)` to `(0, 180)` | Half circumference (~20,015,086.79m) | Calculated `20,015,086.79m` | **PASS** |
| **Exact Co-location** | `(35.1796, 129.0756)` to `(35.1796, 129.0756)` | Exactly `0` meters | Returned `0` meters | **PASS** |
| **Micro-Distance** | `1e-7` deg (~1.1 cm apart) | ~0.011 meters | Calculated `0.0111m` | **PASS** |
| **Pole Longitudes** | `(90, -180)` to `(90, 180)` | Near 0 meters (< 1e-15m) | Calculated `9.55e-26m` | **PASS** |
| **Monte Carlo 10k Pairs** | 10,000 random global coordinate pairs | No `NaN`, distance in `[0, 20015097m]` | 10,000/10,000 valid | **PASS** |
| **Invalid Place Coords in Sort** | Places with `latitude: 999` or `NaN` | Pushed to end of sorted array | Pushed to end (`Number.MAX_VALUE`) | **PASS** |
| **Invalid User Coords in Sort** | `userCoords = { latitude: NaN, longitude: 129.0 }` | Returns original array copy unchanged | Returned copy unchanged | **PASS** |
| **Empty Places List** | `placesList = []` | Returns `[]` | Returned `[]` | **PASS** |

---

## Unchallenged Areas

- **UI Integration & Rendering performance**: Render performance with 10,000+ places on a React Native map component was not stress-tested, as `sortPlacesByDistance` operates synchronously in memory and mobile dataset size in `busan_places_master.json` is small (< 1,000 places).
