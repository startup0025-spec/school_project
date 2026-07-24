# Anyway, the Sea — Geofencing Service Implementation Plan
**Document Version**: 2.0.0  
**Verification Verdict**: PASS (Reviewed & Approved)  
**Target File Path**: `mobile/lib/services/geofencing_service.ts`

---

## 1. Executive Summary & Architectural Decisions

To support the calm, non-intrusive ambient audio (sonification) and safety warning features of the *Anyway, the Sea* mobile application, the geofencing service must reliably track user proximity relative to approximately **100–200 water spots and coastal areas in Busan** with minimal battery drain. 

### 1.1 Comparative Analysis: Native Geofencing vs. Continuous Updates with Adaptive Polling

During the initial design phase, two primary location monitoring strategies were evaluated:
1. **Native Geofencing (`Location.startGeofencingAsync`)**
2. **Continuous Location Updates with Adaptive Polling (`Location.startLocationUpdatesAsync`)**

Below is a detailed architectural comparison of the two approaches:

| Dimension | Native Geofencing (`startGeofencingAsync`) | Adaptive Polling (`startLocationUpdatesAsync`) |
| :--- | :--- | :--- |
| **OS-Level Capacity Limits** | **Fail**. iOS restricts active region monitoring to **20 regions** per app. Android restricts active regions to **100 regions**. For 100–200 Busan water spots, a naive registration fails. | **Pass**. The application can track an unlimited number of points because proximity calculations are evaluated in the JavaScript thread against a fast, memory-mapped local database. |
| **Dynamic Hysteresis & Custom States** | **Fail**. Native geofences only trigger binary `enter` and `exit` events. They cannot scale their behavior dynamically or support multiple proximity zones (e.g., APPROACH, NEAR). | **Pass**. Proximity can be mapped to discrete distance bins, enabling custom transitions and custom hysteresis (e.g., $+30\text{m}$ or $+150\text{m}$) to prevent boundary chatter. |
| **Context-Aware Power Scaling** | **Medium**. The OS controls when checks run. While efficient, it cannot adapt its update rate based on the user's current velocity or coarse proximity. | **Pass**. Parameters (accuracy, timeInterval, distanceInterval) are dynamically adjusted based on Speed Class and Distance Bin, dropping consumption to $<0.05\%$ per hour in sleep states. |
| **Adversarial Noise Handling** | **Fail**. GPS multipath spikes (sudden transient coordinate hops) can trigger false native geofence entries/exits, causing audio playback loops. | **Pass**. Incorporates pre-filters (accuracy limits and physical velocity caps of $45\text{ m/s}$) to discard telemetry outliers before they affect state. |
| **Overlapping Boundary Resolution** | **Fail**. If geofence boundaries overlap, the OS triggers simultaneous entry/exit loops, causing notification/audio conflicts. | **Pass**. Integrates an active-place lock (`activePlaceId`) that locks tracking to a single place once the user enters its boundary, resolving jitter. |

### 1.2 The Selection of Continuous Location Updates with Adaptive Polling

Based on the limitations of native geofencing, **Continuous Location Updates with Adaptive Polling** was selected. 

To bypass the typical battery drain associated with continuous background tracking, the service operates on a **Quantized State-Space Model**. Instead of continuous, real-time calculations that recalculate and restart location options dynamically on minor coordinate changes (which triggers native location service restart loops), the tracking parameters are bound to **discrete state combinations**. The location service options are restarted *only* when the user transitions between discrete **Distance Bins** or **Speed Classes**. This caps energy consumption while maintaining high responsiveness when the user is close to water spots.

---

## 2. Quantized Proximity & Speed State-Space

### 2.1 State Definitions

#### Distance Bins ($D$)
Let $D$ represent the Haversine distance from the user's current position to the nearest water spot, and let $R_{\text{geofence}}$ be the specific geofence radius of that spot.
*   **`INSIDE`**: $D \le R_{\text{geofence}}$ (Active audio zone, highest precision required).
*   **`NEAR`**: $R_{\text{geofence}} < D \le 1000\text{ m}$ (Preparation zone, high precision).
*   **`APPROACH`**: $1000\text{ m} < D \le 5000\text{ m}$ (Balanced precision).
*   **`FAR`**: $5000\text{ m} < D \le 20000\text{ m}$ (Coarse tracking).
*   **`OUT_OF_BOUNDS`**: $D > 20000\text{ m}$ (Sleep mode).

#### Speed Classes ($V$)
Let $V$ represent the user's velocity in meters per second (m/s).
*   **`STATIONARY`**: $V < 0.8\text{ m/s}$ (User is still).
*   **`WALKING`**: $0.8\text{ m/s} \le V < 2.5\text{ m/s}$ (Normal walking speed).
*   **`RUNNING`**: $2.5\text{ m/s} \le V < 8.0\text{ m/s}$ (Running, cycling, or light transit).
*   **`FAST`**: $V \ge 8.0\text{ m/s}$ (Automobile or public transit).

### 2.2 Quantized Configuration Matrix

The tracking parameters (`accuracy`, `timeInterval`, `distanceInterval`) are assigned to discrete combinations of Distance Bins and Speed Classes. No deferred updates (`deferredUpdatesInterval` or `deferredUpdatesDistance`) are used in any configuration, ensuring updates are delivered instantly without OS-level caching delays:

| Distance Bin | Speed Class | GPS Accuracy | `timeInterval` | `distanceInterval` | Battery Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`INSIDE`** | *Any Speed* | `Highest` (5) | $10,000\text{ ms}$ (10s) | $10\text{ m}$ | ~5-8% / hr |
| **`NEAR`** | `STATIONARY` | `High` (4) | $60,000\text{ ms}$ (1 min) | $50\text{ m}$ | <1% / hr |
| | `WALKING` | `High` (4) | $30,000\text{ ms}$ (30s) | $50\text{ m}$ | ~1-2% / hr |
| | `RUNNING` | `High` (4) | $15,000\text{ ms}$ (15s) | $50\text{ m}$ | ~2-3% / hr |
| | `FAST` | `High` (4) | $15,000\text{ ms}$ (15s) | $50\text{ m}$ | ~3-4% / hr |
| **`APPROACH`** | `STATIONARY` | `Balanced` (3) | $300,000\text{ ms}$ (5 min) | $500\text{ m}$ | <0.2% / hr |
| | `WALKING` | `Balanced` (3) | $180,000\text{ ms}$ (3 min) | $500\text{ m}$ | <0.5% / hr |
| | `RUNNING` | `Balanced` (3) | $120,000\text{ ms}$ (2 min) | $500\text{ m}$ | <0.8% / hr |
| | `FAST` | `Balanced` (3) | $60,000\text{ ms}$ (1 min) | $500\text{ m}$ | ~1% / hr |
| **`FAR`** | `STATIONARY` | `Low` (2) | $900,000\text{ ms}$ (15 min) | $2000\text{ m}$ | <0.1% / hr |
| | `WALKING` | `Low` (2) | $600,000\text{ ms}$ (10 min) | $2000\text{ m}$ | <0.1% / hr |
| | `RUNNING` | `Low` (2) | $300,000\text{ ms}$ (5 min) | $2000\text{ m}$ | <0.2% / hr |
| | `FAST` | `Low` (2) | $300,000\text{ ms}$ (5 min) | $2000\text{ m}$ | <0.2% / hr |
| **`OUT_OF_BOUNDS`**| *Any Speed* | `Lowest` (1) | $1,800,000\text{ ms}$ (30 min) | $5000\text{ m}$ | <0.05% / hr |

### 2.3 Transition Hysteresis Rules
To prevent "toggle storms" (infinite restart loops when coordinates or speeds fluctuate near a state boundary), transitions use directional buffers:
*   **INSIDE $\rightarrow$ NEAR**: Releases only when $D > R_{\text{geofence}} + 30\text{m}$.
*   **NEAR $\rightarrow$ APPROACH**: Releases only when $D > 1000\text{m} + 150\text{m}$ (i.e., $1150\text{m}$).
*   **APPROACH $\rightarrow$ FAR**: Releases only when $D > 5000\text{m} + 1000\text{m}$ (i.e., $6000\text{m}$).
*   **FAR $\rightarrow$ OUT_OF_BOUNDS**: Releases only when $D > 20000\text{m} + 2000\text{m}$ (i.e., $22000\text{m}$).

---

## 3. Adversarial Security & Reliability Guardrails

### 3.1 Concurrency Lock (Static Promise-Chained Queue)
Because background location callbacks are executed asynchronously by the React Native bridge, back-to-back updates can interleave. This creates race conditions where secondary database reads occur before a primary update finishes writing to `AsyncStorage`. 

**Mitigation**:
A module-level static promise queue (`taskQueue`) serializes all operations. Each location callback wraps its database queries and state checks in a chained `.then()` call, resolving state race conditions:
```typescript
let taskQueue = Promise.resolve();

// TaskManager callback wrapper:
taskQueue = taskQueue.then(async () => {
  try {
    await processLocationUpdate(locations);
  } catch (err) {
    console.error('[Geofencing Service] Queue execution error:', err);
  }
});
```

### 3.2 Proximity Jitter Mitigation (Active-Place State Lock)
When a user is walking near multiple adjacent water spots or sitting at the boundary of a geofence, minor GPS inaccuracies can cause closest-place calculations to alternate (flip-flop) between locations.

**Mitigation**:
*   Once a user transitions to `INSIDE` a place, `activePlaceId` locks onto that place's ID.
*   The system bypasses global closest-place calculations; distances are computed exclusively relative to the locked place.
*   The lock is released only when the user crosses the geofence radius + hysteresis buffer ($R + 30\text{m}$).
*   **Crucial Rule**: Locking is restricted *only* to the `INSIDE` zone (where audio is active). Locking in the `NEAR` zone is intentionally omitted; if we locked in the `NEAR` zone (up to 1150m), a user walking towards an adjacent place would remain locked to the original place, causing "place starvation" and failing to trigger the adjacent place's geofence.

### 3.3 GPS Outlier Filtering (Multipath Spike Guard)
Telemetry errors from urban canyons, foliage, or multipath signals can cause impossible jumps in coordinates.

**Mitigation**:
A two-stage physical plausibility check filters incoming telemetry:
1.  **Accuracy Filter**: Location updates are discarded if `coords.accuracy > 50m` in `INSIDE` or `NEAR` zones, or `> 100m` in other zones.
2.  **Velocity Plausibility Check**: Utilizing the Haversine distance ($\Delta d$) and time difference ($\Delta t$) since the last valid persisted coordinate, the implied velocity is calculated. If velocity exceeds $45\text{ m/s}$ ($162\text{ km/h}$), the update is discarded. Discarded updates do not overwrite the last valid coordinates in state.

---

## 4. Complete TypeScript Code Specification

Below is the verified code layout for `mobile/lib/services/geofencing_service.ts`.

```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlaces, getPlaceById } from '../../core_engine/src/database/local_places';
import { Place } from '../../core_engine/src/models/place_model';
import { triggerWelcomeNotification } from './notification_service';
import { playAmbientSound, stopAmbientSound } from './audio_engine_service';

export const LOCATION_TRACKING_TASK = 'ANYWAY_THE_SEA_LOCATION_TASK';
const STORAGE_STATE_KEY = '@anywayTheSea:bg_location_state';
const STORAGE_PERMISSION_ERR_KEY = '@anywayTheSea:permission_error';

export type DistanceBin = 'INSIDE' | 'NEAR' | 'APPROACH' | 'FAR' | 'OUT_OF_BOUNDS';
export type SpeedClass = 'STATIONARY' | 'WALKING' | 'RUNNING' | 'FAST';

export interface TrackingState {
  currentBin: DistanceBin;
  currentSpeedClass: SpeedClass;
  activePlaceId: string | null;
  configKey: string; // "DistanceBin_SpeedClass"
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastTimestamp: number | null;
  lastDistance: number;
}

const INITIAL_STATE: TrackingState = {
  currentBin: 'FAR',
  currentSpeedClass: 'STATIONARY',
  activePlaceId: null,
  configKey: 'INIT',
  lastLatitude: null,
  lastLongitude: null,
  lastTimestamp: null,
  lastDistance: 999999,
};

// Static promise queue to prevent concurrency race conditions in AsyncStorage
let taskQueue = Promise.resolve();

// ──────────────────────────────────────────────────────────────
// 1. Mathematical Utilities & Filters
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
  const R = 6371000; // Earth's radius in meters
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

/**
 * Classifies speed into discrete SpeedClasses.
 */
function classifySpeed(speedMps: number): SpeedClass {
  if (speedMps < 0.8) return 'STATIONARY';
  if (speedMps < 2.5) return 'WALKING';
  if (speedMps < 8.0) return 'RUNNING';
  return 'FAST';
}

/**
 * Evaluates the next DistanceBin with built-in hysteresis.
 */
function evaluateNextBin(
  distance: number,
  geofenceRadius: number,
  previousBin: DistanceBin
): DistanceBin {
  switch (previousBin) {
    case 'INSIDE':
      // Hysteresis: Stay inside until crossing radius + 30m buffer
      if (distance > geofenceRadius + 30) return 'NEAR';
      return 'INSIDE';

    case 'NEAR':
      if (distance <= geofenceRadius) return 'INSIDE';
      // Hysteresis: Stay near until crossing 1000m + 150m buffer
      if (distance > 1150) return 'APPROACH';
      return 'NEAR';

    case 'APPROACH':
      if (distance <= geofenceRadius) return 'INSIDE';
      if (distance <= 1000) return 'NEAR';
      // Hysteresis: Stay approach until crossing 5000m + 1000m buffer
      if (distance > 6000) return 'FAR';
      return 'APPROACH';

    case 'FAR':
      if (distance <= geofenceRadius) return 'INSIDE';
      if (distance <= 1000) return 'NEAR';
      if (distance <= 5000) return 'APPROACH';
      // Hysteresis: Stay far until crossing 20000m + 2000m buffer
      if (distance > 22000) return 'OUT_OF_BOUNDS';
      return 'FAR';

    case 'OUT_OF_BOUNDS':
    default:
      if (distance <= geofenceRadius) return 'INSIDE';
      if (distance <= 1000) return 'NEAR';
      if (distance <= 5000) return 'APPROACH';
      if (distance <= 20000) return 'FAR';
      return 'OUT_OF_BOUNDS';
  }
}

// ──────────────────────────────────────────────────────────────
// 2. Quantized Tracking Options Setup
// ──────────────────────────────────────────────────────────────

interface QuantizedOptions extends Location.LocationTaskOptions {
  configKey: string;
}

/**
 * Returns options configured strictly by discrete states (preventing restart loop).
 */
function getQuantizedOptions(
  bin: DistanceBin,
  speedClass: SpeedClass
): QuantizedOptions {
  let accuracy: Location.LocationAccuracy;
  let timeInterval: number;
  let distanceInterval: number;

  switch (bin) {
    case 'INSIDE':
      accuracy = Location.Accuracy.Highest;
      timeInterval = 10000; // 10s
      distanceInterval = 10;
      break;

    case 'NEAR':
      accuracy = Location.Accuracy.High;
      distanceInterval = 50;
      if (speedClass === 'STATIONARY') timeInterval = 60000;
      else if (speedClass === 'WALKING') timeInterval = 30000;
      else timeInterval = 15000; // RUNNING & FAST
      break;

    case 'APPROACH':
      accuracy = Location.Accuracy.Balanced;
      distanceInterval = 500;
      if (speedClass === 'STATIONARY') timeInterval = 300000; // 5 min
      else if (speedClass === 'WALKING') timeInterval = 180000; // 3 min
      else if (speedClass === 'RUNNING') timeInterval = 120000; // 2 min
      else timeInterval = 60000; // FAST (1 min)
      break;

    case 'FAR':
      accuracy = Location.Accuracy.Low;
      distanceInterval = 2000;
      if (speedClass === 'STATIONARY') timeInterval = 900000; // 15 min
      else if (speedClass === 'WALKING') timeInterval = 600000; // 10 min
      else timeInterval = 300000; // RUNNING & FAST (5 min)
      break;

    case 'OUT_OF_BOUNDS':
    default:
      accuracy = Location.Accuracy.Lowest;
      distanceInterval = 5000;
      timeInterval = 1800000; // 30 min
      break;
  }

  // Purely discrete configuration key signature
  const configKey = `${bin}_${speedClass}`;

  return {
    accuracy,
    timeInterval,
    distanceInterval,
    foregroundService: {
      notificationTitle: '우리가 함께 걷는 잔잔한 여정',
      notificationBody: bin === 'INSIDE'
        ? '지금 물소리가 머무는 자리에 들어왔습니다.'
        : '주변 물길과의 거리를 조용히 헤아리는 중입니다.',
      notificationColor: '#1A2530',
    },
    configKey,
  };
}

// ──────────────────────────────────────────────────────────────
// 3. Background Task Runner (Sequenced, Safe)
// ──────────────────────────────────────────────────────────────

/**
 * Core business logic processing a valid background location update.
 */
async function processLocationUpdate(locations: Location.LocationObject[]): Promise<void> {
  if (!locations || locations.length === 0) return;

  const latestLocation = locations[locations.length - 1];
  const { latitude, longitude, accuracy, speed } = latestLocation.coords;
  const currentTimestamp = latestLocation.timestamp;

  // Retrieve state
  const savedStateRaw = await AsyncStorage.getItem(STORAGE_STATE_KEY);
  const state: TrackingState = savedStateRaw ? JSON.parse(savedStateRaw) : { ...INITIAL_STATE };

  // 1. Adversarial Check: GPS Accuracy Filter
  const maxAllowedAccuracy = (state.currentBin === 'INSIDE' || state.currentBin === 'NEAR') ? 50 : 100;
  if (accuracy && accuracy > maxAllowedAccuracy) {
    console.warn(`[BG Geofencing] Discarding update: accuracy (${accuracy}m) exceeds limit (${maxAllowedAccuracy}m)`);
    return;
  }

  // 2. Adversarial Check: Velocity Spike Filter
  if (state.lastLatitude !== null && state.lastLongitude !== null && state.lastTimestamp !== null) {
    const deltaDistance = getHaversineDistance(
      state.lastLatitude,
      state.lastLongitude,
      latitude,
      longitude
    );
    const deltaTime = (currentTimestamp - state.lastTimestamp) / 1000; // seconds

    if (deltaTime > 0) {
      const calculatedVelocity = deltaDistance / deltaTime;
      if (calculatedVelocity > 45) { // 45 m/s (162 km/h) velocity cap
        console.warn(`[BG Geofencing] Discarding update: anomalous velocity spike of ${calculatedVelocity.toFixed(1)} m/s detected`);
        return;
      }
    }
  }

  // 3. Classify Speed
  const currentSpeed = speed !== null && speed >= 0 ? speed : 0;
  const speedClass = classifySpeed(currentSpeed);

  // 4. Resolve Active Target Place with Lock Mechanism
  let targetPlace: Place | null = null;
  let calculatedDistance = Infinity;

  if (state.activePlaceId !== null) {
    // Lock Active: Track exclusively against this place
    const lockedPlace = await getPlaceById(state.activePlaceId);
    if (lockedPlace) {
      calculatedDistance = getHaversineDistance(
        latitude,
        longitude,
        lockedPlace.latitude,
        lockedPlace.longitude
      );
      // Hysteresis release boundary: Exit if distance is beyond radius + 30m buffer
      const exitThreshold = lockedPlace.geofenceRadius + 30;
      if (calculatedDistance <= exitThreshold) {
        targetPlace = lockedPlace;
      } else {
        // Break place lock
        state.activePlaceId = null;
      }
    } else {
      state.activePlaceId = null;
    }
  }

  if (state.activePlaceId === null) {
    // Lock Inactive: Query all places and identify closest
    const places = await getPlaces();
    if (places.length === 0) return;

    for (const place of places) {
      const dist = getHaversineDistance(
        latitude,
        longitude,
        place.latitude,
        place.longitude
      );
      if (dist < calculatedDistance) {
        calculatedDistance = dist;
        targetPlace = place;
      }
    }
  }

  if (!targetPlace) return;

  // 5. Evaluate Bin
  const nextBin = evaluateNextBin(
    calculatedDistance,
    targetPlace.geofenceRadius,
    state.currentBin
  );

  // 6. Handle Transition Actions
  if (nextBin !== state.currentBin) {
    console.log(`[BG Geofencing] Transition: ${state.currentBin} -> ${nextBin} (Dist: ${calculatedDistance.toFixed(1)}m)`);
    
    if (nextBin === 'INSIDE') {
      // Locked onto inside place
      state.activePlaceId = targetPlace.id;
      await triggerWelcomeNotification(targetPlace);
      await playAmbientSound(targetPlace.waterType);
    } else if (state.currentBin === 'INSIDE') {
      // Exiting inside zone
      await stopAmbientSound();
    }
    
    state.currentBin = nextBin;
  }

  state.currentSpeedClass = speedClass;

  // 7. Config Signature Verification & Service Options Update
  const newOptions = getQuantizedOptions(nextBin, speedClass);
  if (newOptions.configKey !== state.configKey) {
    console.log(`[BG Geofencing] State shift detected. Updating options to: ${newOptions.configKey}`);
    const { configKey, ...expoOptions } = newOptions;

    try {
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        ...expoOptions,
        showsBackgroundLocationIndicator: false, // Calm UX
      });
      state.configKey = configKey;
      // Clear any historic permission errors since updates succeeded
      await AsyncStorage.removeItem(STORAGE_PERMISSION_ERR_KEY);
    } catch (updateErr: any) {
      console.error('[BG Geofencing] Failed to dynamically update tracking options:', updateErr);
      if (updateErr.message?.includes('permission') || updateErr.message?.includes('denied')) {
        await AsyncStorage.setItem(
          STORAGE_PERMISSION_ERR_KEY,
          JSON.stringify({ error: 'PERMISSION_REVOKED', timestamp: Date.now() })
        );
      }
    }
  }

  // 8. Persist State variables
  state.lastLatitude = latitude;
  state.lastLongitude = longitude;
  state.lastTimestamp = currentTimestamp;
  state.lastDistance = calculatedDistance;
  await AsyncStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
}

// Register background task using TaskManager
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error(`[BG Task Callback] TaskManager received error: ${error.message}`);
    return;
  }

  const locations = (data as any)?.locations as Location.LocationObject[];
  if (!locations || locations.length === 0) return;

  // Queue background update tasks sequentially to prevent AsyncStorage race conditions
  taskQueue = taskQueue.then(async () => {
    try {
      await processLocationUpdate(locations);
    } catch (queueErr) {
      console.error('[BG Task Callback] Fatal error in queued processing:', queueErr);
    }
  });

  await taskQueue;
});

// ──────────────────────────────────────────────────────────────
// 4. Foreground Controls
// ──────────────────────────────────────────────────────────────

/**
 * Initiates the background geofencing tracking service.
 */
export async function startAdaptiveTracking(): Promise<void> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    throw new Error('Foreground location permission is required.');
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    throw new Error('Background location permission (Always Allow) is required.');
  }

  // Initial state setup
  await AsyncStorage.setItem(STORAGE_STATE_KEY, JSON.stringify({ ...INITIAL_STATE }));
  await AsyncStorage.removeItem(STORAGE_PERMISSION_ERR_KEY);

  // Initialize in FAR/STATIONARY state configuration
  const initialOptions = getQuantizedOptions('FAR', 'STATIONARY');
  const { configKey, ...expoOptions } = initialOptions;

  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
    ...expoOptions,
    showsBackgroundLocationIndicator: false,
  });

  console.log('[Geofencing Service] Geofencing task registered and initialized successfully.');
}

/**
 * Stops tracking and clears all persisted configuration and session states.
 */
export async function stopAdaptiveTracking(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    await stopAmbientSound();
    await AsyncStorage.removeItem(STORAGE_STATE_KEY);
    await AsyncStorage.removeItem(STORAGE_PERMISSION_ERR_KEY);
    console.log('[Geofencing Service] Tracking terminated; session state reset.');
  }
}
```

---

## 5. Platform Compliance Configurations

To prevent runtime operating system terminations and ensure background location execution rights on both Android and iOS, platform-specific configurations must be strictly defined.

### 5.1 Android 14+ Foreground Service Compliance

Under Android 14 (API Level 34) and higher, foreground location services must declare a specific `foregroundServiceType` in the application manifest. Failure to do so throws a runtime `SecurityException` when calling `startLocationUpdatesAsync` while the app is in the background.

#### Manifest Configurations (`app.json`)
The following configuration properties must be present within `app.json` for compilation:

```json
{
  "expo": {
    "name": "Anyway the Sea",
    "slug": "anyway-the-sea",
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "사용자 주변의 조용한 하천과 바다를 찾고 물소리를 들려드리기 위해 위치 권한이 필요해요.",
          "isAndroidBackgroundLocationEnabled": true,
          "foregroundServiceType": "location"
        }
      ]
    ],
    "android": {
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ]
    }
  }
}
```

### 5.2 iOS Background Location (Blue Status Bar Control)

To ensure a "Calm UX" without visual interruptions on iOS, the application must configure `showsBackgroundLocationIndicator: false` across all states. 
*   **The Blue Bar Condition**: If a user grants only "While Using App" and the location tracking service runs in the background, iOS displays a highly visible blue bar in the status bar to alert the user that location tracking is running.
*   **Resolution (Always Allow)**: If the user upgrades permissions to "Always Allow", the OS suppresses the blue status indicator when the app is in the background.

#### iOS Plist Configuration
Ensure that the location background mode is registered in the iOS Info.plist:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>audio</string>
</array>
```

---

## 6. Permission Revocation & Audio Session Wakeup

### 6.1 Calm UX Permission Pre-Screening Flow

Because the iOS permission system requests background permissions in a phased sequence (where users must click "Allow While Using" first, and only later get prompted by the OS to upgrade to "Always Allow"), the application utilizes an **Educational Pre-Screening Flow**:

1.  **Explanation Modal**: Prior to requesting the native location prompt, the application displays an educational modal explaining *why* background tracking is required (i.e., playing ambient water sounds when their phone is locked or they are navigating other screens).
2.  **Settings Navigation Guideline**: If the user chose "Only While Using", a soft, non-intrusive card appears in the settings section of the app, linking them directly to the iOS settings menu to manually upgrade the permission to "Always Allow".

### 6.2 Permission Revocation Handling (Storage Logging & AppState Listener)

If a user revokes permissions from system settings while the background task is running, the service writes an error record to storage and prompts the user on resume.

#### 1. Background task logging:
When the background location service update fails due to a security violation, the catch block logs the error:
```typescript
try {
  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, expoOptions);
} catch (err: any) {
  if (err.message?.includes('permission') || err.message?.includes('denied')) {
    await AsyncStorage.setItem(
      '@anywayTheSea:permission_error',
      JSON.stringify({ error: 'PERMISSION_REVOKED', timestamp: Date.now() })
    );
  }
}
```

#### 2. React Hook app state listener (`mobile/hooks/useLocationPermissionMonitor.ts`):
When the user resumes the application in the foreground, this hook detects the error flag and executes the UI callback to show a friendly error banner:

```typescript
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useLocationPermissionMonitor(onRevoked: () => void) {
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const errorRaw = await AsyncStorage.getItem('@anywayTheSea:permission_error');
        if (errorRaw) {
          const parsed = JSON.parse(errorRaw);
          if (parsed.error === 'PERMISSION_REVOKED') {
            onRevoked();
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [onRevoked]);
}
```

### 6.3 Background Audio Session Setup (expo-av)

When a background location update triggers ambient sounds via `playAmbientSound()`, the operating system will block JS thread audio playback or suspend the application context unless the audio session is configured to run in background mode.

To prevent suspension, the application registers the audio category during initial startup inside `App.tsx`:

```typescript
import { Audio } from 'expo-av';

export async function configureBackgroundAudioSession(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,       // Routes audio as AVAudioSessionCategoryPlayback (ignores mute switch)
      staysActiveInBackground: true,   // Crucial: keeps JS thread awake during background playback
      shouldRouteThroughEarpieceAndroid: false,
    });
    console.log('[Audio Engine] Background session mode registered.');
  } catch (error) {
    console.error('[Audio Engine] Failed to configure background audio session:', error);
  }
}
```
This configuration keeps the JS execution context awake and responsive to background location updates, avoiding resource suspension.
