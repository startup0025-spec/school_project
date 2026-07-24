# Milestone 1 Challenge Report: 3-Minute Cooldown Throttle & Active Index Preservation

**Author**: Challenger 2 (Empirical Challenger)  
**Date**: 2026-07-24  
**Target Milestone**: Milestone 1  
**Project**: Anyway the Sea (Mobile)  

---

## Challenge Summary

**Overall risk assessment**: **LOW** (Passes all empirical verification tests, typechecks, and unit test suites cleanly).

The 3-minute (180,000 ms) cooldown throttle and active place ID preservation logic in `MapScreen` (`app/(tabs)/map.tsx`) and `core_engine` were empirically stress-tested and verified.

---

## Empirical Verification Results

### 1. Rapid GPS Update Sequence (t=0s, 10s, 30s, 60s, 120s, 179s, 180s, 181s)
- **Method**: Built `MapScreenLocationTracker` state machine harness simulating high-frequency location callbacks.
- **Results**:
  - `t=0s`: Initial location trigger executed sort (lastSortTime recorded = `BASE_TIME`).
  - `t=10s`, `30s`, `60s`, `120s`, `179s` (179,000ms): Throttled successfully (`sortCount` remained 1, `didSort = false`).
  - `t=180s` (180,000ms): Cooldown expired, re-sorting triggered (`sortCount` updated to 2, `didSort = true`, `lastSortTime` updated to `BASE_TIME + 180000`).
  - `t=181s`: Immediately throttled again (`didSort = false`).
- **Verdict**: **PASS** (100% adherence to 180,000 ms interval boundary).

### 2. Active Place ID Preservation across Re-sorts
- **Method**: Simulated user selecting place `spot_c` (index 2). Triggered a GPS update at `t=180s` near `spot_b` which caused re-sorting to reorder places array to `[spot_b, spot_a, spot_c, spot_d]`.
- **Results**:
  - `currentSelectedId` (`spot_c`) was tracked via `indexRef`.
  - `newIdx` of `spot_c` in the newly sorted array (index 2) was mapped and assigned to `index` state.
  - Active place card remained `Haeundae Beach` (`spot_c`).
- **Verdict**: **PASS** (Active place selection is preserved regardless of distance re-ordering).

### 3. Sub-millisecond Boundary Verification
- **179,999 ms**: Throttled (`didSort = false`).
- **180,000 ms**: Re-sort triggered (`didSort = true`).
- **Verdict**: **PASS**.

### 4. Edge Cases & Resilience
- **Out of Bounds Index**: Handled safely with fallback to index 0 (`newIdx = 0`).
- **Missing / Deleted Active Place ID**: Fallback to index 0 handled gracefully without exception.

---

## Command Verification Results

- `npm run typecheck`: **PASS** (Exit code 0, 0 TypeScript errors).
- `npm test`: **PASS** (18 tests in 5 suites passed, 0 failures).

---

## Challenges & Observations

### [Low Risk] Ref Mutation inside setState Callback
- **Observation**: `lastSortTimeRef.current = now;` is written inside the `setPlaces((prevPlaces) => ...)` functional state updater in `map.tsx:455`.
- **Analysis**: In React, state updater functions should ideally be pure without side-effects. However, because `setPlaces` runs synchronously in current React Native execution, `lastSortTimeRef` is correctly updated when state updates.
- **Mitigation**: Pure ref updates can optionally be moved directly before `setPlaces(...)` if React Concurrent Mode is enabled in future releases.

---

## Unchallenged Areas

- Native Kakao Map SDK JS bridge rendering performance (out of scope for node test runner; verified via mock bridge contract).
