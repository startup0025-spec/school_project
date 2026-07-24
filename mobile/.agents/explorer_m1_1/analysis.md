# Location & AsyncStorage Analysis Report (Milestone 1)

**Target Scope**: Background Location State (`@anywayTheSea:bg_location_state`) & Map Screen Instant Initial Recommendation (R1)  
**Agent**: Explorer (`explorer_m1_1`)  
**Project Root**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile`  
**Date**: 2026-07-24  

---

## Executive Summary
This report analyzes the background location persistence mechanism in the *Anyway the Sea* mobile application and details how `app/(tabs)/map.tsx` should consume stored background location state (`@anywayTheSea:bg_location_state`) upon initial mount. Incorporating stored background location data eliminates cold-start latency, allows immediate calculation of Haversine walk times, and enables instant proximity-based recommendation ranking (R1) prior to obtaining a fresh GPS fix.

---

## 1. Codebase Architecture & File Mapping

| Component | File Path | Responsibility |
|---|---|---|
| **Map Screen** | `app/(tabs)/map.tsx` | UI view rendering Kakao Map via `WebView`, place recommendation cards, and user location markers. |
| **Geofencing Service** | `lib/services/geofencing_service.ts` | Handles background location tracking (`LOCATION_TRACKING_TASK`), calculates geofence boundaries, and persists tracking state to `AsyncStorage`. |
| **Permission Monitor** | `hooks/useLocationPermissionMonitor.ts` | Monitors AppState transitions and checks `@anywayTheSea:permission_error` in `AsyncStorage`. |
| **Root Layout** | `app/_layout.tsx` | Launches background audio session & registers/starts `startAdaptiveTracking()` on app launch. |
| **Global State Context** | `context/RippleContext.tsx` | Manages app-wide state and listens for `DeviceEventEmitter` background events (`onSafetyDanger`, `onSafetySafe`, `onTrackingStateUpdate`). |
| **Local Database & Cache** | `core_engine/src/database/local_places.ts` | Provides `getPlaces()` with SWR cache (`@anywayTheSea:places_cache`) and fallback data from `busan_places_master.json`. |

---

## 2. Background Location State Analysis (`@anywayTheSea:bg_location_state`)

### 2.1 Storage Key & Configuration
- **Storage Key**: `@anywayTheSea:bg_location_state` (Defined in `lib/services/geofencing_service.ts:13`)
- **Task Name**: `ANYWAY_THE_SEA_LOCATION_TASK` (Defined in `lib/services/geofencing_service.ts:12`)
- **Data Serialization**: JSON stringified object representing the `TrackingState` interface.

### 2.2 Schema Definition (`TrackingState`)
Located in `lib/services/geofencing_service.ts:19-39`:

```typescript
export type DistanceBin = 'INSIDE' | 'NEAR' | 'APPROACH' | 'FAR' | 'OUT_OF_BOUNDS';
export type SpeedClass = 'STATIONARY' | 'WALKING' | 'RUNNING' | 'FAST';

export interface TrackingState {
  currentBin: DistanceBin;         // Current geofence bin with hysteresis
  currentSpeedClass: SpeedClass;   // Classified movement speed
  activePlaceId: string | null;    // Geofence lock target place ID
  configKey: string;               // Quantized options signature (e.g., "FAR_STATIONARY")
  lastLatitude: number | null;     // Last recorded GPS latitude (double)
  lastLongitude: number | null;    // Last recorded GPS longitude (double)
  lastTimestamp: number | null;    // Unix timestamp of last update in milliseconds
  lastDistance: number;            // Haversine distance (meters) to target/closest spot
}
```

#### Initial Default Values (`INITIAL_STATE`):
```typescript
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
```

### 2.3 Write Lifecycle (`geofencing_service.ts`)
1. **Service Initialization (`startAdaptiveTracking`)**:
   - Executes at app launch via `app/_layout.tsx:78`.
   - Writes `INITIAL_STATE` to `@anywayTheSea:bg_location_state` via `AsyncStorage.setItem`.
2. **Background Task Processing (`LOCATION_TRACKING_TASK`)**:
   - `TaskManager.defineTask` (`geofencing_service.ts:399-418`) queues updates through a static promise queue (`taskQueue`) to prevent `AsyncStorage` write race conditions.
   - Reads current state: `await AsyncStorage.getItem(STORAGE_STATE_KEY)`.
   - Applies quality filters (GPS accuracy check <= 50m/100m, anomalous velocity check <= 45 m/s).
   - Computes updated `lastLatitude`, `lastLongitude`, `lastTimestamp`, `lastDistance`, `currentBin`, and `activePlaceId`.
   - Saves state: `await AsyncStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state))` (`geofencing_service.ts:392`).
   - Broadcasts event: `DeviceEventEmitter.emit('onTrackingStateUpdate', state)` (`geofencing_service.ts:395`).

---

## 3. Current Implementation vs. Gap Analysis for `map.tsx`

### 3.1 Existing Behaviour in `map.tsx`
- Currently, `map.tsx` loads places via `getPlaces()` (lines 360-375) and defaults `userLocation` to `null` (line 355).
- Place indexing defaults to `index = 0`, which is the first place in the static database array (line 387).
- `Location.watchPositionAsync` (lines 390-431) runs only when `isFocused` is true, requesting foreground permissions and updating `userLocation` after a delay (every 10s / 10m).
- **Gap / Deficit**:
  - `map.tsx` does **not** query `@anywayTheSea:bg_location_state` from `AsyncStorage`.
  - On initial mount, `userLocation` is `null`, forcing `getWalkTime()` (lines 311-342) to fall back to static text strings (e.g. `'도보 15분'`).
  - The map screen shows an arbitrary default spot (`places[0]`) rather than the place nearest to the user's background-tracked position.

---

## 4. Proposed Solution: Instant Initial Recommendation (R1)

### 4.1 Architecture & Strategy
To satisfy Requirement R1 (Instant Initial Recommendation on mount), `map.tsx` must:
1. Concurrently read `@anywayTheSea:bg_location_state` from `AsyncStorage` alongside `getPlaces()`.
2. Extract `lastLatitude` and `lastLongitude` if non-null.
3. Compute Haversine distances from `(lastLatitude, lastLongitude)` to all places in the database.
4. Sort the places list by distance so that the closest place becomes `places[0]`.
5. Pre-fill `userLocation` state with `{ latitude: lastLatitude, longitude: lastLongitude }`.
6. Immediately display accurate walking time (`getWalkTime`) and center Kakao Map on the nearest spot without waiting for new GPS polling or CDN fetch.

### 4.2 Code Snippet / Diff for `map.tsx`

```typescript
// Add AsyncStorage import
import AsyncStorage from '@react-native-async-storage/async-storage';

const BG_LOCATION_STATE_KEY = '@anywayTheSea:bg_location_state';

// Replace useEffect #1 in map.tsx (lines 360-375) with R1 Initial Load Logic:
useEffect(() => {
  async function initMapData() {
    try {
      // 1. Load places data (SWR cache or mock fallback)
      const data = await getPlaces();
      const initialPlaces = (data && data.length > 0) ? data : QUIET_SPOTS;

      // 2. Load background location state from AsyncStorage
      const storedStateRaw = await AsyncStorage.getItem(BG_LOCATION_STATE_KEY);
      if (storedStateRaw) {
        const storedState = JSON.parse(storedStateRaw);
        if (storedState?.lastLatitude != null && storedState?.lastLongitude != null) {
          const { lastLatitude, lastLongitude } = storedState;

          // Set user location immediately from background storage
          setUserLocation({ latitude: lastLatitude, longitude: lastLongitude });

          // Calculate distance to each place and sort by proximity
          const placesWithDistance = initialPlaces.map((place) => {
            const dist = getHaversineDistance(
              lastLatitude,
              lastLongitude,
              place.latitude,
              place.longitude
            );
            return { place, dist: isNaN(dist) ? Infinity : dist };
          });

          placesWithDistance.sort((a, b) => a.dist - b.dist);
          const sortedPlaces = placesWithDistance.map((item) => item.place);

          setPlaces(sortedPlaces);
          setIndex(0); // Index 0 is guaranteed to be the closest spot!
          return;
        }
      }

      // Default fallback if stored location is not available
      setPlaces(initialPlaces);
    } catch (err) {
      console.warn('[MapScreen] Error initializing place recommendation:', err);
      setPlaces(QUIET_SPOTS);
    }
  }

  initMapData();
}, []);
```

---

## 5. Verification & Testing Plan
1. **AsyncStorage Persistence Test**: Launch app, simulate background location updates, inspect `AsyncStorage.getItem('@anywayTheSea:bg_location_state')`. Confirm `lastLatitude` and `lastLongitude` are populated.
2. **Cold Start Recommendation Test**: Kill app process, navigate to Map tab (`map.tsx`). Verify that `userLocation` is instantly populated, the top place card displays the closest spot to the stored coordinates, and walk time is immediately computed in minutes (not fallback `'도보 15분'`).
3. **Foreground Handoff Verification**: Ensure `watchPositionAsync` updates `userLocation` seamlessly as fresh GPS updates arrive without resetting active user selections.
