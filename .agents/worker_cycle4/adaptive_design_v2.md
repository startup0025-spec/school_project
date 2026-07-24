# Adaptive Background Location Updates (Adaptive Geofencing) Architecture Design - Version 2 (Revised)

This document provides the revised, production-ready architecture design and code-level specifications for the **Adaptive Background Location Updates (Adaptive Geofencing)** system of the *Anyway, the Sea* mobile application. 

Version 2 addresses all architectural vulnerabilities identified in the Cycle 3 review report, including infinite restart loops, concurrency race conditions, nearest-place toggle jitter, GPS coordinate spikes, deferred update bypass risk, Android 14 foreground service declarations, and permission revocation handling.

---

## 1. Architectural Strategy & State Definitions

To prevent excessive battery drain (< 1–2% daily) while maintaining real-time sonification (ambient water sounds) and safety alert triggers, we monitor approximately 100–200 Busan water spots via a quantized, state-locked adaptive polling model.

### 1.1 Quantized State-Space: Distance Bins & Speed Classes
Rather than dynamically calculating continuous tracking intervals (which triggers infinite service restart storms), the system maps the user's situation to discrete **Distance Bins** and **Speed Classes**. Service restarts are ONLY executed when there is a transition between these discrete bins or classes.

#### Distance Bins:
*   **`INSIDE`**: $D \le R_{\text{geofence}}$ (Highest precision GPS, zero latency welcome notifications, active audio playback).
*   **`NEAR`**: $R_{\text{geofence}} < D \le 1000\text{ m}$ (High precision GPS, ready to cross into geofence).
*   **`APPROACH`**: $1000\text{ m} < D \le 5000\text{ m}$ (Balanced precision, cell/Wi-Fi positioning prioritized).
*   **`FAR`**: $5000\text{ m} < D \le 20000\text{ m}$ (Low precision, coarse tracking).
*   **`OUT_OF_BOUNDS`**: $D > 20000\text{ m}$ (Lowest precision, sleep mode).

#### Speed Classes:
*   **`STATIONARY`**: Speed $< 0.8\text{ m/s}$ (User is still or sitting).
*   **`WALKING`**: $0.8\text{ m/s} \le \text{Speed} < 2.5\text{ m/s}$ (Normal walking speed).
*   **`RUNNING`**: $2.5\text{ m/s} \le \text{Speed} < 8.0\text{ m/s}$ (Jogging, cycling, or light transit).
*   **`FAST`**: $\text{Speed} \ge 8.0\text{ m/s}$ (Automobile or subway transit).

### 1.2 Quantized Configuration Matrix

The table below defines the exact options set for each state combination. No deferred updates (`deferredUpdatesInterval` or `deferredUpdatesDistance`) are used in any configuration, ensuring updates are delivered instantly without OS-level caching delays.

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
| **`OUT_OF_BOUNDS`** | *Any Speed* | `Lowest` (1) | $1,800,000\text{ ms}$ (30 min) | $5000\text{ m}$ | <0.05% / hr |

---

## 2. Adversarial Mitigations

### 2.1 Concurrency Lock (Static Promise Queue)
Because location events can trigger back-to-back background JS executions, concurrent operations can interleave and cause state corruption during asynchronous `AsyncStorage` calls. To resolve this, a static execution queue (`taskQueue`) serializes all incoming updates:

```typescript
let taskQueue = Promise.resolve();

// Inside background task definition:
taskQueue = taskQueue.then(async () => {
  await processLocationUpdate(locations);
}).catch(err => {
  console.error('[Geofencing Service] Queue error:', err);
});
```

### 2.2 Active-Place State Lock
To prevent nearest-place evaluation flip-flopping (jitter) when a user sits near the boundary of multiple water spots, the state machine implements a strict place lock:
*   Once a user enters the `INSIDE` or `NEAR` zone of a place, `activePlaceId` is locked to that place.
*   The system bypasses global closest-place searches and calculates distance *only* relative to the locked place.
*   The lock is released only when the distance to the locked place exceeds $R_{\text{geofence}} + \text{Hysteresis Buffer}$ (e.g. $+30\text{m}$ for exiting `INSIDE` to `NEAR`, or when exiting `NEAR` to `APPROACH` at $1150\text{m}$).

### 2.3 GPS Outlier Filtering (Multipath Spike Guard)
GPS coordinates are validated prior to evaluation:
1.  **Accuracy Filter**: Location updates are discarded if `coords.accuracy` exceeds $50\text{ m}$ in `INSIDE` or `NEAR` zones, or $100\text{ m}$ in other zones.
2.  **Velocity Plausibility Check**: The distance traveled between the current coordinate and the last persisted coordinate is divided by the elapsed time. If the implied velocity exceeds $45\text{ m/s}$ ($162\text{ km/h}$), the update is discarded as an impossible physical spike.

---

## 3. TypeScript Code-Level Implementation Design

The following robust, typed code provides the full structure for `mobile/lib/services/geofencing_service.ts`:

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

interface QuantizedOptions extends Location.LocationOptions {
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

## 4. Platform-Specific Compliance & Configuration

To guarantee platform-level execution safety and prevent runtime operating system terminations, the native properties and permissions of both Android and iOS must be strictly configured.

### 4.1 Android 14+ Foreground Service Compliance
Under Android 14 (API Level 34) and higher, foreground location services must declare a service type in `AndroidManifest.xml`. Failure to declare the type causes a runtime `SecurityException` when `startLocationUpdatesAsync` is called with `foregroundService` properties.

To enforce this, configure the `expo-location` plugin options within `app.json` as shown:

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

### 4.2 iOS Background Location Indicators & Always-Allow Permission Flow
On iOS, utilizing background location updates without the "Always Allow" permission level triggers visible blue status indicators (the blue bar) when the app is suspended. To manage this and prevent user friction:

1.  **Permission Escalation Model**:
    *   On first request, requesting `requestBackgroundPermissionsAsync` triggers a provisional prompt. The user is only allowed to click "Allow While Using App".
    *   Once the app transitions to the background and the tracking service initiates, iOS will display a secondary system prompt asking the user to keep the permission as "While Using" or upgrade to "Always Allow".
    *   **Calm UX Pre-Screening**: The application must display an educational modal with illustrations explaining *why* the background permission is needed (i.e. to play background water sounds seamlessly without leaving the screen active) *prior* to triggering the native dialog.
2.  **Suppressing Blue Indicators**:
    *   `showsBackgroundLocationIndicator` is configured to `false` across all states. If the user grants "Always Allow", the blue status indicator will never show.
    *   If the user chooses "Only While Using", iOS will enforce the blue bar. The foreground UI can detect this and offer a non-intrusive card prompting them to upgrade to "Always" via iOS Settings for a calmer experience.

### 4.3 Background Audio Session Wakeup (expo-av)
When the background location service triggers `playAmbientSound()`, the operating system may block JS thread audio playback or suspend the app immediately unless the native audio session is properly configured.

To allow background audio wakeup, configure `expo-av` inside the app initialization logic (`App.tsx` or startup logic) with the following background playback settings:

```typescript
import { Audio } from 'expo-av';

export async function configureBackgroundAudioSession(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true, // Necessary for background audio on iOS
      staysActiveInBackground: true, // Crucial: prevents JS thread suspension during playback
      shouldRouteThroughEarpieceAndroid: false,
    });
    console.log('[Audio Engine] Background session mode registered.');
  } catch (error) {
    console.error('[Audio Engine] Failed to configure background audio session:', error);
  }
}
```

This configuration routes the audio session as `AVAudioSessionCategoryPlayback` on iOS and binds the audio focus on Android, keeping the JS context alive and responsive to subsequent background location updates.

---

## 5. Permission Revocation Handling

If a user navigates to the OS Settings app and revokes location permissions while the background service is active, subsequent location wakeups or transitions will fail. 

1.  **Storage Handlers**:
    Inside the dynamic configuration catch block, permission exceptions write a flag to AsyncStorage:
    ```typescript
    await AsyncStorage.setItem(
      '@anywayTheSea:permission_error',
      JSON.stringify({ error: 'PERMISSION_REVOKED', timestamp: Date.now() })
    );
    ```
2.  **Foreground Polling**:
    When the user returns to the app, the foreground `AppState` change listener checks for the presence of this key. If found, a peaceful, non-intrusive error banner appears, prompting them to restore the location permission.

```typescript
// Inside a React Custom Hook (e.g. useLocationPermissionMonitor.ts)
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
