# Handoff Report — explorer_cycle2

## 1. Observation

During the read-only investigation, the following files and details were observed:

*   **Repository Structure & File Paths**:
    *   `Anyway_the_Sea/mobile/core_engine/src/database/local_places.ts`: Contains the database client of 200 quiet water spots. It exposes the async function `getPlaces(): Promise<Place[]>` to fetch place coordinates, tags, and geofence radii.
    *   `Anyway_the_Sea/mobile/lib/services/geofencing_service.ts`: Currently empty, containing only a single comment: `// TODO: Initialize`.
    *   `Anyway_the_Sea/mobile/lib/services/audio_engine_service.ts`: Currently empty: `// TODO: Initialize`.
    *   `Anyway_the_Sea/mobile/lib/services/notification_service.ts`: Currently empty: `// TODO: Initialize`.
    *   `Anyway_the_Sea/mobile/package.json`: Specifying `"expo-location": "~19.0.8"` and `"expo": "~54.0.27"`.
*   **Design Blueprint Specifications**:
    *   `C:\Users\user\Desktop\school_contest\blueprints\교육청 대회용 앱 간단 설계서.txt`: Details the integration of geofencing triggers with the audio engine (`audio_engine_service.ts`) and notifications (`notification_service.ts`).
    *   `C:\Users\user\Desktop\school_contest\blueprints\앱 UI, UX 설명서.txt`: Focuses on the "non-pressuring, calm, and responsive" UX design philosophy, requiring seamless audio loops, non-alarmist notifications, and low visual/auditory friction.

---

## 2. Logic Chain

From these observations, we established the following step-by-step reasoning:

1.  **OS Geofencing Limitations**: Native geofencing in `expo-location` cannot register all 200 points due to hard OS limits (20 on iOS, 100 on Android).
2.  **Continuous Updates Battery Overhead**: Continuous high-frequency GPS tracking is disqualified as it consumes 5–20% battery per hour, which directly violates the quiet/calm background operation requirement.
3.  **Adaptive Background updates**: By running `Location.startLocationUpdatesAsync` but dynamically reconfiguring its options, we can poll location at coarse intervals (e.g., 15 minutes, lowest accuracy) when far from any water spot, and ramp it up to high-frequency GPS tracking (e.g., 10 seconds, highest accuracy) only when inside a water spot.
4.  **Velocity-Aware Polling ($T_{\text{eta}}$)**: High-speed transit (e.g. in vehicles) can bypass zones entirely if polling is static. Scaling the polling interval dynamically to half of the estimated ETA ($T_{\text{eta}} = D / V$) guarantees that the device triggers boundary updates before entering the next zone.
5.  **Hysteresis Implementation**: GPS noise at boundaries will trigger "toggle storms" (redundant stopping and restarting of the location service, causing battery spikes). Introducing a Hysteresis Buffer ($\beta$) where exit boundaries are extended (e.g. $1000\text{m} \rightarrow 1150\text{m}$) prevents this oscillation.
6.  **State Persistence via AsyncStorage**: Since background tasks run in headless JS execution contexts, in-memory global variables are periodically swept by the OS. Storing the tracking state (`currentZone`, `configKey`, etc.) in `AsyncStorage` ensures persistence across wakeups.

---

## 3. Caveats

*   **Simulator Accuracy**: The velocity-based task reconfiguring relies on `coords.speed` provided by the OS. In simulators, simulated routes must include speed values; otherwise, the fallback clamp ($0.8\text{ m/s}$) will govern the interval calculations.
*   **Android Foreground Notification**: The persistent notification is mandatory on Android. Although we styled it to be calm and non-intrusive, it cannot be fully hidden from the user due to Android security constraints.

---

## 4. Conclusion

We have completed the architectural design for **Adaptive Background Location Updates (Adaptive Geofencing)**. The design document includes:
1.  **Mathematical formulas** for speed-scaled dynamic time intervals to prevent zone-skipping.
2.  **Zone parameters** (Far, Approach, Near, Inside) mapping out accuracy and interval settings to optimize battery power.
3.  **Hysteresis buffers** preventing toggle storm oscillations.
4.  **A complete TypeScript code-level blueprint** for `geofencing_service.ts` using Expo Location and TaskManager.
5.  **Platform configurations** for `app.json` for both Android and iOS background execution permissions.

---

## 5. Verification Method

Once the implementer codes the design, the architecture can be verified as follows:

1.  **Type Check**: Run the TypeScript compilation in the mobile folder to verify syntax correctness:
    ```powershell
    cd mobile
    npm run typecheck
    ```
2.  **Location Transition Verification**:
    *   Verify that `Location.startLocationUpdatesAsync` is called with the correct parameters for each zone by logging the `configKey` transitions.
    *   Inspect `AsyncStorage` values under the `@anywayTheSea:bg_location_state` key to confirm the state is updated correctly on location updates.
3.  **Boundary Hysteresis Verification**:
    *   Move the simulator coordinate back and forth around the boundary (e.g., $995\text{m} \leftrightarrow 1005\text{m}$).
    *   Confirm that the active configuration is NOT restarted repeatedly, confirming the hysteresis buffer works.
4.  **Notification & Audio Integration**:
    *   Trigger an `inside` zone entry and verify that the audio engine cross-fades into the correct water ambient sound, and a welcome notification is sent once.
