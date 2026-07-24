# Review Report — Milestone 1 (Reviewer 2)

**Verdict**: REQUEST_CHANGES

## Executive Summary
Milestone 1 introduced reusable Haversine distance utilities (`core_engine/src/utils/haversine.ts`), background location re-sorting, a 3-minute re-sorting cooldown (`SORT_COOLDOWN_MS = 180000`), and unit test coverage. Both type checking (`npm run typecheck`) and test suite execution (`npm test`) passed cleanly with 0 errors.

However, critical and major findings were identified in React state synchronization (calling state setter inside state updater), out-of-bounds negative index protection, unhandled null element sorting exceptions, and SWR listener subscription churn.

---

## Findings

### [Major] Finding 1: React State Updater Side Effects (`setIndex` called inside `setPlaces`)
- **What**: `setIndex(...)` is invoked directly inside the functional updater passed to `setPlaces((prevPlaces) => ...)` during both SWR cache updates and location watch callbacks.
- **Where**: `app/(tabs)/map.tsx`, lines 399 and 449.
- **Why**: React state updater functions must be pure and free of side-effects. Calling `setIndex` inside `setPlaces`:
  1. Enqueues an asynchronous `setIndex` state update while `places` updates immediately, causing `places[index]` in the current render frame to point to an unexpected item until the `index` update settles.
  2. In React 18 Concurrent Mode or Strict Mode, double execution of state updaters will trigger duplicate `setIndex` calls during the render phase.
- **Suggestion**: Compute sorted places and the target index together outside state updaters, or manage `places` and `index` in a synchronized pattern.

### [Major] Finding 2: Out-of-Bounds Negative Index Vulnerability (`index < 0`)
- **What**: `const activeIndex = index < places.length ? index : 0;` does not guard against negative indices.
- **Where**: `app/(tabs)/map.tsx`, line 412.
- **Why**: If `index` is negative (e.g. `-1`), `-1 < places.length` evaluates to `true`, setting `activeIndex = -1` and evaluating `places[-1]`, which is `undefined`.
- **Suggestion**: Update boundary check to `const activeIndex = index >= 0 && index < places.length ? index : 0;`.

### [Major] Finding 3: `sortPlacesByDistance` Unhandled Null/Undefined Element Exception
- **What**: `sortPlacesByDistance` assumes every element in `placesList` is a valid non-null object with `latitude` and `longitude`.
- **Where**: `core_engine/src/utils/haversine.ts`, lines 77-88.
- **Why**: If `placesList` contains `null`, `undefined`, or malformed elements, accessing `a.latitude` throws an unhandled `TypeError` (`Cannot read properties of null`), crashing the application.
- **Suggestion**: Filter out null/undefined or malformed elements before sorting or add null-checks in `sortPlacesByDistance`.

### [Minor] Finding 4: SWR Subscription Churn via `[userLocation]` Dependency
- **What**: `subscribeToPlacesCache` effect includes `[userLocation]` in its dependency array.
- **Where**: `app/(tabs)/map.tsx`, line 410.
- **Why**: Every location update (e.g. every 10 seconds) tears down and re-establishes the SWR cache subscription.
- **Suggestion**: Reference `userLocation` via a `useRef` so the subscription lifecycle is independent of location update frequency.

---

## Verified Claims

- `npm run typecheck` (`tsc -p tsconfig.json --noEmit`) → executed via `cmd /c npm run typecheck` → **PASS** (Exit Code 0)
- `npm test` (`node --experimental-strip-types --test core_engine/src/utils/__tests__/*.test.ts`) → executed via `cmd /c npm test` → **PASS** (13 tests in 4 suites passed)
- Haversine calculation accuracy (`getHaversineDistance`) → verified via `haversine.test.ts` (~850m distance assertion between Sebyeonggyo and Oncheoncheon Park) → **PASS**
- Cooldown logic gate test (180,000ms) → verified via `map_recommendation.test.ts` → **PASS**
- Integrity Violation Check → verified source code and test suite for hardcoded results/facades → **PASS** (No integrity violations detected)

---

## Adversarial Challenge & Stress-Test Results

1. **Scenario 1: `placesList` contains malformed/null element**
   - *Input*: `sortPlacesByDistance([ { id: 'a', latitude: 35.1, longitude: 129.1 }, null ], userLoc)`
   - *Predicted Result*: Throws `TypeError: Cannot read properties of null (reading 'latitude')`.
   - *Verdict*: **FAIL** (Requires null guard in `haversine.ts`).

2. **Scenario 2: Negative `index` state (`index = -1`)**
   - *Input*: `index = -1`, `places = [spot1, spot2]`
   - *Predicted Result*: `activeIndex = -1 < 2 ? -1 : 0` -> `activeIndex = -1`. `places[-1]` is `undefined`.
   - *Verdict*: **FAIL** (Requires `index >= 0` check in `map.tsx`).

3. **Scenario 3: Rapid location updates triggering SWR re-subscriptions**
   - *Input*: Location watcher updates every 10s.
   - *Predicted Result*: `subscribeToPlacesCache` continuously cleans up and re-attaches listener.
   - *Verdict*: **WARN / MEDIUM RISK**.

---

## Coverage Gaps

- Component-level UI integration testing for Kakao WebView message passing (currently tested at unit logic level; UI testing requires Expo/React Native testing framework).
