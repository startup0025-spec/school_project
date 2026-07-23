# Adaptive Background Location Updates (Adaptive Geofencing) Architecture Design

This report outlines the detailed, code-level design and logic flow for the **Adaptive Background Location Updates (Adaptive Geofencing)** system, serving as the main driver for the *Anyway, the Sea* mobile application.

---

## 1. Design Context & Architectural Challenge

*Anyway, the Sea* monitors approximately **100–200 quiet water spots** (coasts, rivers, and streams in Busan). The system must trigger sonification (ambient water audio) and safety alerts in the background.

There are two traditional approaches, both of which are unsuitable on their own:
1. **Continuous High-Frequency Background Location Updates**: Drains **5% to 20% battery hourly** because it keeps the high-precision GPS receiver active and wakes the Javascript thread constantly.
2. **Native Geofencing (`Location.startGeofencingAsync`)**: Highly battery efficient, but iOS limits apps to **20 active regions**, and Android limits them to **100**. This makes monitoring 200 points impossible without dynamic updates, and native geofencing suffers from significant trigger latency.

### The Solution: Adaptive Background Location Polling
By dynamically tuning the tracking parameters of `Location.startLocationUpdatesAsync` based on:
1. **Coarse Distance ($D$)** to the nearest water spot.
2. **User Velocity ($V$)** (speed).

We achieve the battery efficiency of native geofencing (under 1–2% battery daily when far or stationary) while maintaining high-accuracy, real-time audio and safety updates when the user approaches or enters a water spot.

---

## 2. Dynamic Options Tuning & Mathematical Model

The Expo Location service (`Location.startLocationUpdatesAsync`) accepts several options to configure the underlying OS tracking daemon. We tune these options dynamically:

*   **`accuracy`**: `Location.Accuracy` (Lowest=1, Low=2, Balanced=3, High=4, Highest=5). Higher accuracy powers on GNSS/GPS chips; lower accuracy utilizes cell tower and Wi-Fi triangulation.
*   **`timeInterval`**: The minimum time interval (ms) between location updates.
*   **`distanceInterval`**: The minimum distance (meters) the user must travel before a new update is sent.
*   **`deferredUpdatesInterval`**: The minimum time (ms) the OS waits before delivering a batch of cached location updates.
*   **`deferredUpdatesDistance`**: The minimum distance (meters) the user must travel before a batch is delivered.

### Velocity-Adaptive Scaling (The $T_{\text{eta}}$ Model)

Relying solely on distance is dangerous if the user is traveling at high speed. For example, a user driving at $22\text{ m/s}$ (80 km/h) in the *Approach Zone* ($D = 3000\text{ m}$) has an estimated time-to-arrival (ETA) of:
$$T_{\text{eta}} = \frac{D}{V} = \frac{3000\text{ m}}{22\text{ m/s}} \approx 136\text{ seconds (2.26 minutes)}$$

If our polling interval is static at 5 minutes ($300,000\text{ ms}$), the user will drive past the water spot before the next location update triggers.

To prevent this, the active polling interval $I_{\text{active}}$ is computed dynamically:
$$I_{\text{active}} = \max\left(I_{\text{min\_zone}}, \min\left(I_{\text{base\_zone}}, \alpha \cdot \frac{D}{V} \cdot 1000\right)\right) \text{ ms}$$

Where:
*   $I_{\text{base\_zone}}$: The default, battery-optimized time interval for the current zone.
*   $I_{\text{min\_zone}}$: The absolute minimum interval allowed in the zone (to prevent GPS spamming).
*   $\alpha$: A safety scaling multiplier, set to **$0.5$**, ensuring the system polls at least **twice** during the user's transit through the zone.
*   $V$: The user's speed in m/s. If $V < 0.8\text{ m/s}$ (stationary or slow walking), $V$ is clamped to $0.8\text{ m/s}$ to avoid division by zero and unnecessary polling.

---

## 3. Zone Partitioning & Hysteresis Rules

We partition the physical space into 4 discrete zones. The parameters for each zone are detailed in the table below:

| Zone | Distance Range ($D$) | Accuracy Level | Base `timeInterval` | Base `distanceInterval` | Batching (Deferred Options) | Target Battery Drain |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Far Zone** | $D > 5000\text{ m}$ | `Lowest` (1) | $900,000\text{ ms}$ (15 min) | $2000\text{ m}$ | Int: 900k ms, Dist: 2000m | **< 0.1% per hour** (No GPS) |
| **Approach Zone** | $1000\text{ m} < D \le 5000\text{ m}$ | `Low` (2) or `Balanced` (3) | $300,000\text{ ms}$ (5 min) | $500\text{ m}$ | Int: 300k ms, Dist: 500m | **< 0.5% per hour** (Wi-Fi/Cell) |
| **Near Zone** | $R_{\text{geofence}} < D \le 1000\text{ m}$ | `High` (4) | $60,000\text{ ms}$ (1 min) | $50\text{ m}$ | Disabled (0) | **~ 1-2% per hour** (Coarse GPS) |
| **Inside Zone** | $D \le R_{\text{geofence}}$ | `Highest` (5) | $10,000\text{ ms}$ (10 sec) | $10\text{ m}$ | Disabled (0) | **~ 5-8% per hour** (Highest GPS) |

*Note: $R_{\text{geofence}}$ represents the place-specific radius (e.g., 500m for big beaches, 100m for narrow streams) loaded dynamically from `Place.geofenceRadius`.*

### Boundary Hysteresis to Avoid Toggle Storms

When a user sits or walks directly on a zone boundary (e.g., at $995\text{m} \leftrightarrow 1005\text{m}$), GPS noise and coordinate fluctuation can trigger rapid, battery-draining task restarts. To prevent this, we enforce a **Hysteresis Distance Buffer ($\beta$)**:

*   **Entering (Closer Zone)**: Triggered immediately when $D \le \text{Threshold}$.
*   **Exiting (Farther Zone)**: Triggered only when $D > \text{Threshold} + \beta$.

```
Zone Transition Boundary Map:
                         [ Entering: D <= 1000m ]
   Approach Zone ───────────────────────────────────────► Near Zone
                 ◄───────────────────────────────────────
                      [ Exiting: D > 1000m + 150m (Hysteresis) ]
```

#### Defined Buffers ($\beta$):
*   **Inside ➔ Near Boundary**: $\beta = 30\text{ m}$ (Exit threshold = $R_{\text{geofence}} + 30\text{m}$)
*   **Near ➔ Approach Boundary**: $\beta = 150\text{ m}$ (Exit threshold = $1150\text{m}$)
*   **Approach ➔ Far Boundary**: $\beta = 1000\text{ m}$ (Exit threshold = $6000\text{m}$)

---

## 4. Adaptive Polling Logic Flow

### State Persistence
Because React Native's background task runner may spawn in a separate headless JS engine context, in-memory global variables can be wiped. We store the current configuration signature and tracking state in `AsyncStorage` to guarantee persistence across OS wakeups.

### TypeScript Code-Level Implementation Design

The following code-level architecture represents the implementation structure for `mobile/lib/services/geofencing_service.ts`:

```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlaces } from '../../core_engine/src/database/local_places';
import { Place } from '../../core_engine/src/models/place_model';
import { triggerWelcomeNotification, triggerDangerAlert } from './notification_service';
import { playAmbientSound, stopAmbientSound } from './audio_engine_service';

export const LOCATION_TRACKING_TASK = 'ANYWAY_THE_SEA_LOCATION_TASK';
const STORAGE_STATE_KEY = '@anywayTheSea:bg_location_state';

export type TrackingZone = 'far' | 'approach' | 'near' | 'inside';

export interface TrackingState {
  currentZone: TrackingZone;
  activePlaceId: string | null;
  configKey: string; // Signature of options to detect changes
  lastDistance: number;
}

const INITIAL_STATE: TrackingState = {
  currentZone: 'far',
  activePlaceId: null,
  configKey: 'INIT',
  lastDistance: 999999,
};

// ──────────────────────────────────────────────────────────────
// 1. Math Utils
// ──────────────────────────────────────────────────────────────

/**
 * Calculates Haversine distance in meters between two coordinates.
 */
function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ──────────────────────────────────────────────────────────────
// 2. Zone Evaluation & Hysteresis Logic
// ──────────────────────────────────────────────────────────────

/**
 * Evaluates the next zone based on distance and previous zone to apply hysteresis.
 */
function evaluateNextZone(
  distance: number,
  geofenceRadius: number,
  previousZone: TrackingZone
): TrackingZone {
  switch (previousZone) {
    case 'inside':
      // Exit inside zone only if we exceed geofenceRadius + 30m buffer
      if (distance > geofenceRadius + 30) return 'near';
      return 'inside';

    case 'near':
      if (distance <= geofenceRadius) return 'inside';
      // Exit near zone only if we exceed 1000m + 150m buffer
      if (distance > 1150) return 'approach';
      return 'near';

    case 'approach':
      if (distance <= geofenceRadius) return 'inside';
      if (distance <= 1000) return 'near';
      // Exit approach zone only if we exceed 5000m + 1000m buffer
      if (distance > 6000) return 'far';
      return 'approach';

    case 'far':
    default:
      if (distance <= geofenceRadius) return 'inside';
      if (distance <= 1000) return 'near';
      if (distance <= 5000) return 'approach';
      return 'far';
  }
}

// ──────────────────────────────────────────────────────────────
// 3. Location Option Generator
// ──────────────────────────────────────────────────────────────

interface AdjustedOptions extends Location.LocationOptions {
  configKey: string;
}

/**
 * Computes optimal LocationOptions based on distance, speed, and active zone.
 */
function getOptionsForZone(
  zone: TrackingZone,
  distance: number,
  speed: number, // in m/s
  geofenceRadius: number
): AdjustedOptions {
  // Clamp speed to prevent division by zero or negative speed errors
  const clampedSpeed = Math.max(0.8, speed);
  const etaSeconds = distance / clampedSpeed;
  
  // Safety factor: poll at least twice during the ETA window (alpha = 0.5)
  const safetyInterval = Math.round(etaSeconds * 0.5 * 1000);

  let accuracy: Location.LocationAccuracy;
  let timeInterval: number;
  let distanceInterval: number;
  let deferredInterval = 0;
  let deferredDistance = 0;

  switch (zone) {
    case 'inside':
      accuracy = Location.Accuracy.Highest;
      timeInterval = 10000; // 10s base
      distanceInterval = 10;
      break;

    case 'near':
      accuracy = Location.Accuracy.High;
      timeInterval = Math.max(15000, Math.min(60000, safetyInterval)); // 15s - 60s
      distanceInterval = 50;
      break;

    case 'approach':
      accuracy = Location.Accuracy.Balanced;
      timeInterval = Math.max(60000, Math.min(300000, safetyInterval)); // 1 min - 5 min
      distanceInterval = 500;
      deferredInterval = timeInterval;
      deferredDistance = distanceInterval;
      break;

    case 'far':
    default:
      accuracy = Location.Accuracy.Lowest;
      // If speed is high (e.g. driving at 20m/s), poll every 5 min, else 15 min
      const baseFarTime = clampedSpeed > 15 ? 300000 : 900000;
      timeInterval = Math.max(300000, Math.min(baseFarTime, safetyInterval));
      distanceInterval = 2000;
      deferredInterval = timeInterval;
      deferredDistance = distanceInterval;
      break;
  }

  // Create a configuration signature to detect changes and prevent redundant restarts
  const configKey = `${zone}_${accuracy}_${timeInterval}_${distanceInterval}_${deferredInterval}_${deferredDistance}`;

  return {
    accuracy,
    timeInterval,
    distanceInterval,
    deferredUpdatesInterval: deferredInterval > 0 ? deferredInterval : undefined,
    deferredUpdatesDistance: deferredDistance > 0 ? deferredDistance : undefined,
    foregroundService: {
      notificationTitle: '우리가 함께 걷는 잔잔한 여정',
      notificationBody: zone === 'inside'
        ? '지금 물소리가 머무는 자리에 들어왔습니다.'
        : '주변 물길과의 거리를 조용히 헤아리는 중입니다.',
      notificationColor: '#1A2530',
    },
    configKey,
  };
}

// ──────────────────────────────────────────────────────────────
// 4. Background Task Registration
// ──────────────────────────────────────────────────────────────

/**
 * Main location tracking background task.
 * Called by OS via TaskManager.
 */
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error(`[BG Task] Location error: ${error.message}`);
    return;
  }

  const locations = (data as any)?.locations as Location.LocationObject[];
  if (!locations || locations.length === 0) return;

  const latestLocation = locations[locations.length - 1];
  const { latitude, longitude, speed } = latestLocation.coords;
  const currentSpeed = speed !== null && speed >= 0 ? speed : 0;

  try {
    // 1. Fetch persistent state
    const savedStateRaw = await AsyncStorage.getItem(STORAGE_STATE_KEY);
    const state: TrackingState = savedStateRaw
      ? JSON.parse(savedStateRaw)
      : { ...INITIAL_STATE };

    // 2. Fetch master places
    const places = await getPlaces();
    if (places.length === 0) return;

    // 3. Find closest place using Haversine
    let closestPlace: Place | null = null;
    let minDistance = Infinity;

    for (const place of places) {
      const dist = getHaversineDistance(
        latitude,
        longitude,
        place.latitude,
        place.longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        closestPlace = place;
      }
    }

    if (!closestPlace) return;

    // 4. Evaluate new zone with hysteresis
    const nextZone = evaluateNextZone(
      minDistance,
      closestPlace.geofenceRadius,
      state.currentZone
    );

    // 5. Handle Transition Side-Effects
    if (nextZone !== state.currentZone) {
      console.log(`[BG Task] Transition: ${state.currentZone} -> ${nextZone} (Distance: ${minDistance}m)`);
      
      if (nextZone === 'inside') {
        // Entered water spot: Trigger welcome notification and start audio cross-fade
        state.activePlaceId = closestPlace.id;
        await triggerWelcomeNotification(closestPlace);
        await playAmbientSound(closestPlace.waterType); // Fades in ambient file
      } else if (state.currentZone === 'inside') {
        // Exited water spot: Stop audio
        state.activePlaceId = null;
        await stopAmbientSound();
      }
      
      state.currentZone = nextZone;
    }

    // 6. Generate configuration options
    const newOptions = getOptionsForZone(
      nextZone,
      minDistance,
      currentSpeed,
      closestPlace.geofenceRadius
    );

    // 7. Update options dynamically if signature changed
    if (newOptions.configKey !== state.configKey) {
      console.log(`[BG Task] Updating configuration. New signature: ${newOptions.configKey}`);
      
      // Exclude configKey custom field before calling expo API
      const { configKey, ...expoOptions } = newOptions;

      // Update location task options in place
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        ...expoOptions,
        showsBackgroundLocationIndicator: false, // Prevent OS blue bar icon to remain calm
      });

      state.configKey = configKey;
    }

    // 8. Persist updated tracking state
    state.lastDistance = minDistance;
    await AsyncStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));

  } catch (err) {
    console.error('[BG Task] Critical failure during execution:', err);
  }
});

// ──────────────────────────────────────────────────────────────
// 5. Service Controls (Start & Stop)
// ──────────────────────────────────────────────────────────────

/**
 * Initializes and starts the background tracking service.
 */
export async function startAdaptiveTracking(): Promise<void> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    throw new Error('Location permissions are required for tracking.');
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    throw new Error('Background location permission is required.');
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
  
  // Clear persistent state on clean start
  await AsyncStorage.setItem(STORAGE_STATE_KEY, JSON.stringify({ ...INITIAL_STATE }));

  // Start task with low precision Far Zone options to begin
  const initialFarOptions = getOptionsForZone('far', 999999, 0, 100);
  const { configKey, ...expoOptions } = initialFarOptions;

  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
    ...expoOptions,
    showsBackgroundLocationIndicator: false,
  });

  console.log(`[Geofencing Service] Dynamic Tracking started successfully.`);
}

/**
 * Stops the background tracking service completely.
 */
export async function stopAdaptiveTracking(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    await stopAmbientSound();
    await AsyncStorage.removeItem(STORAGE_STATE_KEY);
    console.log(`[Geofencing Service] Dynamic Tracking stopped and state cleared.`);
  }
}
```

---

## 5. Platform-Specific Considerations & UX Optimization

To uphold the app’s **non-pressuring, calm UX philosophy** (as specified in *앱 UI, UX 설명서.txt*), the implementation must minimize OS-level UI intrusion and auditory friction.

### 5.1 Android Foreground Service Notification
Since Android 8.0, background location tracking requires a persistent notification. 
*   **Non-Intrusive Writing Style**: Avoid alarming phrases like *"위치 추적 중"* (Location is being tracked) or *"GPS 수신 중"* (GPS active). Instead, use poetic, calm phrases aligned with the branding:
    *   **Title**: `우리가 함께 걷는 잔잔한 여정` (Our quiet journey walking together)
    *   **Body**: `주변 물길과의 거리를 조용히 헤아리는 중입니다.` (Quietly measuring the distance to nearby waterways.)
*   **Theme Integration**: Set `notificationColor` to a dark deep-ocean/teal matching the app’s glassmorphism style (`#1A2530`).
*   **Icon Customization**: Use a tiny custom monochrome icon (a simple wave/ripple symbol) rather than the default Android app icon to reduce status bar clutter.
*   **App.json Configuration**:
    Android requires the following permissions in `app.json` (under `expo.android.permissions`):
    ```json
    "permissions": [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION"
    ]
    ```

### 5.2 iOS Background Location Indicators
On iOS, active background tracking can cause the system status bar to turn blue (indicating active GPS usage). 
*   To prevent this from stressing the user, set `showsBackgroundLocationIndicator: false` in the `LocationOptions`.
*   The iOS system will only show the indicator if accuracy is set to `Highest` or `BestForNavigation` while the app is in the background. Since the app stays in `Lowest` or `Low` accuracy in the *Far Zone*, the blue bar will not appear during daily commutes.
*   **App.json Configuration**:
    Configure the Plist descriptions inside `app.json` (under `expo.ios.infoPlist`):
    ```json
    "infoPlist": {
      "UIBackgroundModes": ["location"],
      "NSLocationWhenInUseUsageDescription": "사용자 주변의 조용한 하천과 바다를 찾고 물소리를 들려드리기 위해 위치 권한이 필요해요.",
      "NSLocationAlwaysAndWhenInUseUsageDescription": "화면이 꺼져 있거나 백그라운드에서도 물길 근처에 다다랐을 때 조용히 앰비언트 오디오를 재생하기 위해 항상 권한이 필요해요."
    }
    ```

### 5.3 Minimizing Auditory Friction (Sonification Triggers)
*   **Cross-Fade Transition (Volume Ramp)**: When transitioning to the `Inside Zone`, the audio engine (`audio_engine_service.ts`) must never play the sound file abruptly. It must start the player at volume `0.0` and linearly ramp up to `0.8` (or the speed-scaled volume) over **3.0 seconds**.
*   **Glitch-Free Loop**: Ambient files (`ambient_sea.mp3` or `ambient_river.mp3`) must loop seamlessly using native OS audio player threads (not Javascript timers).
*   **Welcome Notification Cooldown**: To prevent the phone from repeatedly vibrating when crossing the `Inside ➔ Near ➔ Inside` boundary during a walk, a **1-hour cooldown timer** is enforced per place. A second "Welcome" notification is blocked unless the user has spent at least 60 minutes outside that specific geofence or has visited a different place first.
