# Review Report: Milestone 1 Location & Sorting Refactor

**Verdict**: APPROVE

## Executive Summary
The implementation for Milestone 1 across `app/(tabs)/map.tsx`, `core_engine/src/utils/haversine.ts`, and `core_engine/src/api.ts` meets all required specifications (R1, R2, R3).
No integrity violations or facade implementations were detected. All verification commands (`npm run typecheck` and `npm test`) passed cleanly with 0 type errors and 13/13 passing tests.

## Findings by Requirement

### R1: AsyncStorage Retrieval of `@anywayTheSea:bg_location_state` on Mount
- **Location**: `app/(tabs)/map.tsx` (Lines 351–387)
- **Status**: PASSED
- **Details**:
  - The mount `useEffect` retrieves the stored location state key `@anywayTheSea:bg_location_state` via `AsyncStorage.getItem`.
  - JSON payload is safely parsed and validated using `isValidCoordinate(storedState.lastLatitude, storedState.lastLongitude)`.
  - Initial places are immediately sorted by distance with the closest spot placed at index 0 (`setIndex(0)`).
  - Exceptions during AsyncStorage access or JSON parsing are caught and gracefully fallback to default places.

### R2: Haversine Distance-Based Sorting (Closest Place at Index 0)
- **Location**: `core_engine/src/utils/haversine.ts` (Lines 34–96) & `app/(tabs)/map.tsx` (Lines 368–374, 442–457)
- **Status**: PASSED
- **Details**:
  - `getHaversineDistance` uses the standard Earth radius (6,371,000 meters) with robust coordinate validation and trigonometric clamping (`Math.max(0, Math.min(1, a))`) to avoid domain errors.
  - `sortPlacesByDistance` sorts array elements in ascending order of Haversine distance, placing the closest spot at index 0.
  - Invalid user coordinates leave array order unchanged without throwing exceptions.

### R3: Strict 3-Minute (180,000 ms) Cooldown Throttle for Re-sorting
- **Location**: `app/(tabs)/map.tsx` (Lines 345, 439–459)
- **Status**: PASSED
- **Details**:
  - `SORT_COOLDOWN_MS` is set to `180000` (3 minutes).
  - In `Location.watchPositionAsync`, re-sorting is gated by `lastSortTimeRef.current === 0 || now - lastSortTimeRef.current >= SORT_COOLDOWN_MS`.
  - When re-sorting occurs, `lastSortTimeRef.current` is updated to `now`.
  - Currently selected place ID is tracked via `indexRef` and mapped to its new index in the sorted list to prevent UI selection jumps or index out-of-bounds errors.

## Integrity Violation Check
- **Hardcoded Test Outputs**: None found.
- **Dummy/Facade Logic**: None found. Real Haversine math and location subscriptions are implemented.
- **Bypassed Core Logic**: None found.
- **Self-Certifying Work**: None found. Verified independently via `cmd /c npm run typecheck` and `cmd /c npm test`.

## Command Execution & Verification

### 1. Typecheck Command
- **Command**: `cmd /c npm run typecheck`
- **Result**: PASSED (Exit Code: 0)
- **Output**:
  ```
  > @workspace/mobile@0.0.0 typecheck
  > tsc -p tsconfig.json --noEmit
  ```

### 2. Test Execution Command
- **Command**: `cmd /c npm test`
- **Result**: PASSED (Exit Code: 0)
- **Output**:
  ```
  ▶ isValidCoordinate
    ✔ valid coordinates return true
    ✔ invalid latitude returns false
    ✔ invalid longitude returns false
  ✔ isValidCoordinate

  ▶ getHaversineDistance
    ✔ identical points return 0
    ✔ known distance between two points in Busan
    ✔ returns NaN for invalid coordinates
    ✔ floating point precision clamping safeguard
  ✔ getHaversineDistance

  ▶ sortPlacesByDistance
    ✔ sorts places so closest is at index 0
    ✔ preserves order if user coordinates are invalid
    ✔ handles empty array
  ✔ sortPlacesByDistance

  ▶ Milestone 1 Recommendation & Cooldown Verification
    ✔ R1 & R2: Background location sorting places closest spot at index 0
    ✔ R3: Safe activeIndex preservation when places array order changes
    ✔ R3: Cooldown logic gate test (180,000 ms)
  ✔ Milestone 1 Recommendation & Cooldown Verification

  ℹ tests 13
  ℹ pass 13
  ℹ fail 0
  ```

## Verified Claims
- R1: AsyncStorage `@anywayTheSea:bg_location_state` read on mount -> Verified in `map.tsx:358` -> PASS
- R2: Haversine distance sorting closest at index 0 -> Verified in `haversine.ts:70-96` & `haversine.test.ts:70-75` -> PASS
- R3: 3-minute (180,000 ms) cooldown gate -> Verified in `map.tsx:345,441` & `map_recommendation.test.ts:44-63` -> PASS
