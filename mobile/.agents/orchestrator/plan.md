# Orchestration Plan: Mobile Map Location Recommendation Refactor

## Objective
Implement distance-based sorting for places in `map.tsx` with:
- Initial location load from `AsyncStorage` (`@anywayTheSea:bg_location_state`)
- Haversine formula sorting (closest place at index 0)
- 3-minute (180,000 ms) strict cooldown throttle between re-sorts
- Safe `activeIndex` tracking to avoid crash or out-of-bounds errors

## Iteration Loop Plan (Milestone 1)

### Phase 1: Exploration
- Dispatch 3 `teamwork_preview_explorer` instances to investigate:
  1. `Explorer 1`: Map component location lifecycle, AsyncStorage state parsing (`@anywayTheSea:bg_location_state`), and existing location state hooks.
  2. `Explorer 2`: Place array data structure, Haversine formula implementation/helper, and distance sorting mechanism.
  3. `Explorer 3`: Real-time foreground location update triggers, 3-minute cooldown throttle implementation strategy, and safe `activeIndex` synchronization during re-sorting.

### Phase 2: Implementation & Verification
- Aggregate Explorer findings.
- Dispatch 1 `teamwork_preview_worker` to:
  - Implement Haversine distance calculator.
  - Integrate AsyncStorage location fetch on mount.
  - Implement 3-minute throttled re-sorting on foreground location updates.
  - Ensure safe `activeIndex` tracking when order changes.
  - Run type checks, linters, unit tests, and build checks.

### Phase 3: Review & Challenge
- Dispatch 2 `teamwork_preview_reviewer` instances to evaluate:
  - Reviewer 1: Correctness of Haversine formula, AsyncStorage key, and 3-minute cooldown logic.
  - Reviewer 2: Index stability (`activeIndex` boundary protection), edge cases (null location, empty places array, identical distances).
- Dispatch 2 `teamwork_preview_challenger` instances to run adversarial checks:
  - Rapid simulated location updates within 3-minute window (verify no re-sort occurs).
  - Location update after >3 minutes (verify re-sort occurs).
  - Selected place index stability when place shifts position in sorted array.

### Phase 4: Forensic Audit & Gating
- Dispatch 1 `teamwork_preview_auditor` to audit code integrity (no dummy/facade mocks, no fake timer circumvention, authentic Haversine calculation).
- Evaluate gate criteria. If all pass, finalize milestone.
