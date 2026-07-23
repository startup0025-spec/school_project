# Handoff Report — reviewer_cycle3

## 1. Observation

During the architectural and adversarial review of the design document at `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_cycle2/adaptive_design.md`, the following details were observed:

1.  **Restart Storm Vulnerability**:
    The `configKey` includes the variable `timeInterval` calculated from a continuous formula:
    *   Line 254: `const configKey = `${zone}_${accuracy}_${timeInterval}_${distanceInterval}_${deferredInterval}_${deferredDistance}`;`
    *   Line 358: `if (newOptions.configKey !== state.configKey) { ... await Location.startLocationUpdatesAsync(...) }`
    Any change in distance or velocity alters `timeInterval` and triggers `startLocationUpdatesAsync` on every location update, starting an infinite loop of task restarts.

2.  **Concurrency Race Conditions**:
    State management uses asynchronous reads/writes to `AsyncStorage` without locks or serialization:
    *   Line 296: `const savedStateRaw = await AsyncStorage.getItem(STORAGE_STATE_KEY);`
    *   Line 375: `await AsyncStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));`
    If location updates trigger the task concurrently, they will read stale states and overwrite each other's writes.

3.  **Place Flipping Jitter**:
    Closest place evaluation is computed globally on every update:
    *   Lines 305-320: The system loops through all places to find the closest, and immediately evaluates `evaluateNextZone` on that place. If the user is situated between two nearby places, GPS jitter will cause the closest place to oscillate, starting and stopping the ambient sound repeatedly.

4.  **GPS Spike Vulnerability**:
    Raw GPS coordinates are used directly without verification:
    *   Lines 290-291: `const { latitude, longitude } = latestLocation.coords;`
    A 10km GPS multipath spike will trigger a zone transition to `far` (stopping audio) and transition back on the next update (spamming notifications).

5.  **Android 14 Compliance Gap**:
    The permission list in Section 5.1 includes:
    *   `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`
    However, the type `location` is not declared for the foreground service in the manifest settings, which causes a `SecurityException` crash on Android 14+.

6.  **TypeScript Compilation Failure**:
    Running `npm run typecheck` in the `mobile/` directory yielded the following:
    *   `tsconfig.json(19,5): error TS6053: File 'C:/Users/user/Desktop/school_contest/lib/api-client-react' not found.`

---

## 2. Logic Chain

From these observations, we reasoned as follows:

1.  **Continuous Formula + Exact Change Check = Restart Storm**: Because `timeInterval` depends directly on $D/V$, it will change on almost every location update. Since the update threshold checks for exact inequality (`configKey !== state.configKey`), the app will constantly call `Location.startLocationUpdatesAsync`, generating a CPU and battery-draining loop.
2.  **JS Async Interleaving + No Locks = State Corruption**: Async tasks in React Native interleave. Concurrent location updates will result in overlapping read/write windows on `AsyncStorage`, leading to state corruption and duplicate welcome notifications.
3.  **Global Minimum Check + Adjacent Radii = Flip-Flops**: In the absence of an active-place lock, the closest place evaluation will change with GPS jitter, causing audio dropouts when standing between overlapping or close-proximity geofence ranges.
4.  **No Accuracy check = Multipath Failure**: Failing to filter updates by `coords.accuracy` or checking for physical velocity limits allows GPS jumps to trigger false zone transitions.
5.  **Android 14 strict rules = App crash**: Failing to declare `android:foregroundServiceType="location"` in the manifest causes the Android OS to block foreground location updates with a `SecurityException` at runtime on Android 14+.

---

## 3. Caveats

*   **Compiler Errors**: The TypeScript compilation error is due to a missing sibling directory `lib/api-client-react` which is outside our repository scope. It does not affect the correctness of the TypeScript code structure within `mobile/lib/services`.
*   **iOS Simulator Limits**: Simulating routes on iOS might not replicate the background suspension behavior of iOS core-location. Native devices must be used to test the suspension of the JS thread when stationary.

---

## 4. Conclusion

The design report for **Adaptive Background Location Updates** is **REJECTED** with a **REQUEST_CHANGES** verdict. The implementer must not proceed with this design until:
1.  `timeInterval` calculations and change detection are quantized to discrete bins or Speed Classes to avoid restart loops.
2.  An execution lock/queue is introduced to serialize background task executions.
3.  An active-place state lock is added to prevent place flip-flopping.
4.  A filter is added to discard GPS multipath outliers using `accuracy` and velocity limits.
5.  The app.json configuration is updated to declare `foregroundServiceType: "location"` in compliance with Android 14+.

---

## 5. Verification Method

Once changes are applied, verify by:
1.  **Restart Storm Check**: Log every call to `Location.startLocationUpdatesAsync`. Ensure it is NOT called repeatedly while moving or at rest inside a single zone.
2.  **Concurrency Stress Test**: Trigger rapid location updates (e.g. 5 updates per second) using a simulated route. Confirm that the background state remains consistent and no duplicate audio triggers occur.
3.  **Hysteresis & Jitter Test**: Simulate coordinates fluctuating around a boundary (e.g., $995\text{m} \leftrightarrow 1005\text{m}$). Confirm that the active configuration is stable.
4.  **Android 14 Build Test**: Run `eas build` or build locally for Android 14 (API 34) and confirm that starting tracking does not throw `SecurityException`.
