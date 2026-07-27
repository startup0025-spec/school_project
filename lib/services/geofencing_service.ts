import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlaces, getPlaceById } from '../../core_engine/src/database/local_places';
import { Place } from '../../core_engine/src/models/place_model';
import { SafetyLevel } from '../../core_engine/src/models/safety_status';
import { checkGeofenceAndSafety } from '../../core_engine/src/api';
import { triggerWelcomeNotification, triggerDangerNotification } from './notification_service';
import { playDynamicMix, stopAmbientSound } from './audio_engine_service';
import { DeviceEventEmitter } from 'react-native';

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
      // 수변 반경 진입 — 안전 판정 후 오디오/알림 분기
      state.activePlaceId = targetPlace.id;

      // [Step 2] checkGeofenceAndSafety 연동: 기상청(풍속/특보) + 부산시(수위/탁도) 실시간 판정
      // ※ MP3 파일 추후 추가 시 실가동 예정 — 현재 CDN 부재 시 464B 폴백 파일로 폴백
      let safetyLevel: SafetyLevel = SafetyLevel.Safe;
      try {
        safetyLevel = await checkGeofenceAndSafety(latitude, longitude);
      } catch (safetyErr) {
        console.warn('[BG Geofencing] Safety check failed, defaulting to Safe:', safetyErr);
      }

      if (safetyLevel === SafetyLevel.Danger) {
        // 위험: 다이나믹 믹스 + 긴급 푸시 + UI 위험 신호 발신
        await playDynamicMix(targetPlace.waterType);
        await triggerDangerNotification(targetPlace);
        DeviceEventEmitter.emit('onSafetyDanger', {
          level: 'DANGER',
          message: `거기 소리가 별로네요. 오늘은 위험하니까 다른 데로 가요.`,
        });
        console.log(`[BG Geofencing] DANGER triggered at ${targetPlace.name}`);
      } else if (safetyLevel === SafetyLevel.Warning) {
        // 경고: 다이나믹 믹스 + UI 경고 신호 발신
        await playDynamicMix(targetPlace.waterType);
        await triggerWelcomeNotification(targetPlace);
        DeviceEventEmitter.emit('onSafetyDanger', {
          level: 'WARNING',
          message: `수위가 상승 중입니다. 하천 접근에 각별히 주의하세요.`,
        });
        console.log(`[BG Geofencing] WARNING triggered at ${targetPlace.name}`);
      } else {
        // 안전: 평상 다이나믹 믹스 + 환영 알림
        await playDynamicMix(targetPlace.waterType);
        await triggerWelcomeNotification(targetPlace);
        DeviceEventEmitter.emit('onSafetySafe', {
          message: null,
        });
        console.log(`[BG Geofencing] SAFE — dynamic mix started at ${targetPlace.name}`);
      }

    } else if (state.currentBin === 'INSIDE') {
      // 수변 반경 탈출 — 오디오 정지 + UI 안전 복구 신호
      await stopAmbientSound();
      DeviceEventEmitter.emit('onSafetySafe', { message: null });
      console.log('[BG Geofencing] Exited INSIDE zone. Audio stopped.');
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

  // [Zero-Burden] Broadcast state update to foreground UI without polling
  DeviceEventEmitter.emit('onTrackingStateUpdate', { 
    isTracking: true, 
    state,
    waterType: targetPlace.waterType 
  });
}

// Register background task using TaskManager
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }: { data: any; error: any }) => {
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

  DeviceEventEmitter.emit('onTrackingStateUpdate', { isTracking: true, state: INITIAL_STATE });
  console.log('[Geofencing Service] Geofencing task registered and initialized successfully.');
}

/**
 * Stops tracking and clears all persisted configuration and session states.
 */
export async function stopAdaptiveTracking(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
  if (isRegistered) {
    taskQueue = taskQueue.then(async () => {
      try {
        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        await stopAmbientSound();
        await AsyncStorage.removeItem(STORAGE_STATE_KEY);
        await AsyncStorage.removeItem(STORAGE_PERMISSION_ERR_KEY);
        DeviceEventEmitter.emit('onTrackingStateUpdate', { isTracking: false });
        console.log('[Geofencing Service] Tracking terminated; session state reset.');
      } catch (err) {
        console.error('[Geofencing Service] Error stopping tracking:', err);
      }
    });
    await taskQueue;
  }
}
