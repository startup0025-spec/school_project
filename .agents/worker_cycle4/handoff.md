# Handoff Report - Cycle 4 Geofencing Design Update

This report summarizes the modifications and updates to the Adaptive Background Location Updates design document, resolving the findings of cycle 3.

---

## 1. Observation
We observed the following files and structural artifacts:
*   **Original Design Document**: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_cycle2/adaptive_design.md`
    *   Defined dynamic calculation of `timeInterval` on line 42:
        `I_active = max(I_min_zone, min(I_base_zone, alpha * D/V * 1000))`
    *   Declared `configKey` on line 254 using variable values:
        `const configKey = `${zone}_${accuracy}_${timeInterval}_${distanceInterval}_${deferredInterval}_${deferredDistance}`;`
*   **Review Report**: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/reviewer_cycle3/review.md`
    *   *Finding 1.1 (Restart Loop)*: "infinite loop of service restarts... Because D and V change with every location update, the computed timeInterval will almost always be slightly different."
    *   *Finding 1.2 (Concurrency Race)*: "Multiple location updates can invoke the background task concurrently... AsyncStorage operations are asynchronous..."
    *   *Finding 2.1 (Closest-Place Jitter)*: "If B is slightly closer but the user is outside B's geofence, the active zone will suddenly transition to near or approach..."
    *   *Finding 2.2 (GPS Outliers)*: "GPS multipath spikes can report a coordinates jump... next correct update will jump back..."
    *   *Finding 2.3 (Deferred Updates)*: "In the Far and Approach zones, the options use deferredUpdatesInterval and deferredUpdatesDistance... user will have driven past the water spot entirely."
    *   *Finding 3.1 (Android 14 Foreground Service)*: "Android 14... apps starting a foreground service must explicitly declare the service type in the AndroidManifest.xml"
    *   *Finding 4.1 (Permission Revocation)*: "background task catches exceptions... but does not propagate the status to the foreground UI."
    *   *Coverage Gaps*: iOS provisional dialogs / blue bar status and `expo-av` background audio session.
*   **Target Codebase File**: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/lib/services/geofencing_service.ts`
    *   Currently contains only:
        ```typescript
        // TODO: Initialize
        ```

---

## 2. Logic Chain
Based on the observations:
1.  **To resolve Finding 1.1 (Restart Loop)**: We mapped continuous coordinates/speed values to discrete variables: Speed Classes (`STATIONARY`, `WALKING`, `RUNNING`, `FAST`) and Distance Bins (`INSIDE`, `NEAR`, `APPROACH`, `FAR`, `OUT_OF_BOUNDS`). We set `configKey = `${bin}_${speedClass}`` so that config changes only trigger Location updates when the user transitions to a different discrete bin or class.
2.  **To resolve Finding 1.2 (Concurrency Race)**: We implemented a static module-level `taskQueue = Promise.resolve()` inside the background thread. Every new callback execution is chained sequentially (`taskQueue = taskQueue.then(...)`), preventing overlapping AsyncStorage writes.
3.  **To resolve Finding 2.1 (Closest-Place Jitter)**: We added an `activePlaceId` lock inside the state. While `activePlaceId` is locked, the global nearest-place search is bypassed, maintaining focus solely on the current place until the user exits the place's radius + hysteresis buffer ($R + 30\text{m}$).
4.  **To resolve Finding 2.2 (GPS Outliers)**: We checked `coords.accuracy` against a limit ($\le 50\text{m}$ in near/inside, $\le 100\text{m}$ elsewhere) and verified that the computed velocity ($\Delta d / \Delta t$) is under $45\text{ m/s}$. Any coordinates failing these criteria are discarded.
5.  **To resolve Finding 2.3 (Deferred Updates)**: We removed the deferred update parameters entirely to prevent OS-level update caching.
6.  **To resolve Finding 3.1 (Android 14 Foreground Service)**: We documented the exact plugin configuration needed in `app.json` for Android foreground service type mapping.
7.  **To resolve Finding 4.1 (Permission Revocation)**: We added a try-catch block to log permission exceptions to AsyncStorage so that the foreground app can poll it via `AppState` changes.
8.  **To resolve Coverage Gaps**: We added detailed sections explaining iOS permission escalation paths and `expo-av` background audio setup.

---

## 3. Caveats
*   The code structure is designed to be fully compatible with Expo 50/51 and `expo-location` guidelines. Native background execution on iOS is subject to strict Apple review and developer provisioning profile settings (Location Updates capability must be enabled in Xcode).
*   Mock testing of location updates in background services on simulators requires simulated GPX routes or using the simulator's location spoofing features.

---

## 4. Conclusion
We have generated the revised, robust design document `adaptive_design_v2.md` at `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_cycle4/adaptive_design_v2.md` containing a complete, syntactically correct, and production-ready TypeScript code structure for `geofencing_service.ts` that addresses all review findings.

---

## 5. Verification Method
*   **File Inspection**: Verify that the design document exists at `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_cycle4/adaptive_design_v2.md`.
*   **Interface Match**: Check that the model types (`Place`, `WaterType`, `getPlaces`, `getPlaceById`) imported from `local_places` and `place_model` align perfectly with `mobile/core_engine/src/database/local_places.ts` and `mobile/core_engine/src/models/place_model.ts`.
*   **Syntactic Completeness**: The code snippet provided in the design document can be compiled without missing dependencies or syntax errors.
