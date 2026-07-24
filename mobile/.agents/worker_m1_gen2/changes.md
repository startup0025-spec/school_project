# Milestone 1 Remediation Pass Changes

## Summary of Fixes

### 1. Fix React State Updater Side Effect (`app/(tabs)/map.tsx`)
- **Issue**: Calling `setIndex(...)` inside the `setPlaces((prevPlaces) => ...)` functional state updater callback in `Location.watchPositionAsync` was causing nested state update side-effects during render/state calculations.
- **Fix**: Replaced nested state update by maintaining `placesRef` (and `indexRef`). Accessed `placesRef.current` and `indexRef.current` outside `setPlaces`, performed sorting using `sortPlacesByDistance`, computed `newIdx`, and called `setPlaces(sorted)` and `setIndex(newIdx !== -1 ? newIdx : 0)` independently.

### 2. Fix `activeIndex` Boundary Guard (`app/(tabs)/map.tsx`)
- **Issue**: `activeIndex` check only guarded upper bound (`index < places.length`).
- **Fix**: Updated boundary guard from `const activeIndex = index < places.length ? index : 0;` to `const activeIndex = index >= 0 && index < places.length ? index : 0;` to guarantee lower bound protection against negative indices.

### 3. Fix Null Element Handling in `sortPlacesByDistance` (`core_engine/src/utils/haversine.ts`)
- **Issue**: Accessing `a.latitude` or `b.latitude` when array contained `null` or `undefined` elements could cause runtime `TypeError`.
- **Fix**: Added null/undefined element checks at start of comparator function:
  ```typescript
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  ```
  Updated parameter type signature to `(T | null | undefined)[]` and added `.filter((p): p is T => p != null)` to clean return values.
- **Tests Added**: Added `handles null or undefined elements in array` test to `core_engine/src/utils/__tests__/haversine.test.ts`.

### 4. SWR Subscription Dependency Fix (`app/(tabs)/map.tsx`)
- **Issue**: The SWR cache subscription `useEffect` included `[userLocation]` in its dependency array, causing the effect to unsubscribe and re-subscribe on every location update.
- **Fix**: Introduced `userLocationRef` (`userLocationRef.current = userLocation`), extracted current location from `userLocationRef.current` inside the subscription callback, and changed `useEffect` dependency array to `[]`.

## Verification Command Results
- `cmd /c npm run typecheck`: 0 errors.
- `cmd /c npm test`: 19 tests passed, 0 failed.
