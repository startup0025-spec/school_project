# Milestone 1: Haversine & Distance Sorting Analysis Report

## Executive Summary
This analysis evaluates `map.tsx` and the place data model within the Anyway the Sea mobile application, audits existing distance calculation helpers across the codebase, designs an accurate and edge-case-safe Haversine distance function, and details the sorting strategy to ensure the closest place is positioned at index 0 of the `places` array when user location is available.

---

## 1. Location & Analysis of `map.tsx` and Place Data Types

### 1.1 `map.tsx` Structure
- **File Path**: `app/(tabs)/map.tsx`
- **Core Components**:
  - `MapScreen`: React Native component containing a Kakao Map JS SDK within a `<WebView>`.
  - State variables:
    - `places: Place[]`: Loaded asynchronously via `getPlaces()` from `core_engine/src/database/local_places.ts` (with fallback to `QUIET_SPOTS` from `constants/mockData.ts`).
    - `userLocation: { latitude: number; longitude: number } | null`: Updated via `expo-location` (`Location.watchPositionAsync`).
    - `index: number`: Active selected place index (defaults to `0`).
  - Render Card (`renderCard()`): Displays the currently selected place (`currentPlace = places[activeIndex]`), estimated walking time, and action buttons ("기록하기", "길찾기", "다음 추천").

### 1.2 Place Data Types & Interfaces
- **Primary Model**: `Place` interface in `core_engine/src/models/place_model.ts`
  ```typescript
  export interface Place {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    description: string;
    waterType: 'stream' | 'river' | 'sea' | 'none';
    imageUrl?: string;
    tags?: string[];
    geofenceRadius: number;
    kmaNx?: number;
    kmaNy?: number;
    district: string;
    waterStationName?: string;
  }
  ```
- **Mock/Backward Compatibility Model**: `QuietSpot` interface in `constants/mockData.ts`
  ```typescript
  export interface QuietSpot extends Place {
    walk: string; // e.g. '도보 12분'
  }
  ```

---

## 2. Codebase Audit of Existing Distance Helpers & Math Utilities

### 2.1 Findings
1. **`app/(tabs)/map.tsx` (Lines 290–308)**:
   Contains an inline function `getHaversineDistance(lat1, lon1, lat2, lon2)`:
   - **Observation**: Uses Earth radius $R = 6,371,000$ m and $\text{atan2}(\sqrt{a}, \sqrt{1-a})$.
   - **Defect Identified**: Line 294 has a copy-paste error checking `isNaN(lat1)` twice instead of `isNaN(lon1)`:
     ```typescript
     // Existing line 294 in map.tsx:
     lon1 === null || lon1 === undefined || typeof lon1 !== 'number' || isNaN(lat1) ||
     ```
   - **Scope**: Used only locally inside `getWalkTime()` helper.

2. **`core_engine/src/api.ts` (Lines 8–34)**:
   Contains an unexported function `haversineDistance(lat1, lng1, lat2, lng2)`:
   - **Observation**: Uses $R = 6,371,000$ m, applies `clampedA = Math.max(0, Math.min(1, a))`.
   - **Scope**: Used only internally within `checkGeofenceAndSafety()`.

3. **Utility Gaps**:
   - There is no central, shared math/distance utility in `core_engine/src/utils/` or `@/utils/`.
   - Code duplication exists between `map.tsx` and `core_engine/src/api.ts`.

---

## 3. Accurate Haversine Distance Function Design

### 3.1 Mathematical Specification
$$\Delta \phi = \frac{(\text{lat}_2 - \text{lat}_1) \cdot \pi}{180}, \quad \Delta \lambda = \frac{(\text{lng}_2 - \text{lng}_1) \cdot \pi}{180}$$

$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos\left(\frac{\text{lat}_1 \cdot \pi}{180}\right) \cdot \cos\left(\frac{\text{lat}_2 \cdot \pi}{180}\right) \cdot \sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$a_{\text{clamped}} = \max(0, \min(1, a))$$

$$c = 2 \cdot \operatorname{atan2}\left(\sqrt{a_{\text{clamped}}}, \sqrt{1 - a_{\text{clamped}}}\right)$$

$$d = R \cdot c \quad (R = 6,371,000 \text{ meters})$$

### 3.2 Key Robustness Features
1. **Strict Input Validation**:
   Checks for `null`, `undefined`, `typeof !== 'number'`, `isNaN`, and finite numbers.
2. **Geographic Coordinate Bounds Check**:
   - Latitude: $[-90, 90]$
   - Longitude: $[-180, 180]$
3. **Floating-Point Precision Safeguard**:
   Clamping $a$ into $[0, 1]$ prevents domain errors in $\sqrt{1 - a}$ caused by minor floating-point inaccuracies (e.g. $1.0000000000000002$).
4. **Zero-Distance Fast Path**:
   If $\text{lat}_1 = \text{lat}_2$ and $\text{lng}_1 = \text{lng}_2$, returns `0` directly.

### 3.3 Proposed Reusable Utility Code (`core_engine/src/utils/haversine.ts`)

```typescript
/**
 * Earth's mean radius in meters (IUGG standard).
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Validates whether latitude and longitude numbers are valid and within legal geographic boundaries.
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  if (
    lat === null || lat === undefined || typeof lat !== 'number' || Number.isNaN(lat) || !Number.isFinite(lat) ||
    lng === null || lng === undefined || typeof lng !== 'number' || Number.isNaN(lng) || !Number.isFinite(lng)
  ) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Calculates the Haversine distance in meters between two GPS coordinates.
 * Returns NaN if any coordinate is invalid.
 */
export function getHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    return Number.NaN;
  }

  if (lat1 === lat2 && lng1 === lng2) {
    return 0;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const clampedA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}
```

---

## 4. Distance Sorting Design for `map.tsx` (Requirement R2)

### 4.1 Problem Statement
In the current implementation of `app/(tabs)/map.tsx`:
- `places` state is populated by `getPlaces()` or fallback `QUIET_SPOTS`.
- `userLocation` state is populated when GPS position updates.
- **Deficiency**: `places` array is rendered in default database/mock order. The card component displays `places[index]` (where `index` starts at 0). Index 0 is NOT sorted relative to `userLocation`, violating Requirement R2 ("places array in map.tsx should be sorted by Haversine distance from the user location so closest place is at index 0").

### 4.2 Detailed Design for Distance Sorting

#### Option A: Derived Sorted Array with `useMemo` (Recommended)
Instead of replacing `places` state directly (which would re-trigger marker registration loops on every minor location drift), compute a derived sorted array `sortedPlaces` using `useMemo`:

```typescript
const sortedPlaces = React.useMemo(() => {
  if (!places || places.length === 0) return [];
  if (!userLocation) return places;

  return [...places].sort((a, b) => {
    const distA = getHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      a.latitude,
      a.longitude
    );
    const distB = getHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      b.latitude,
      b.longitude
    );

    // Fallback if distance is NaN
    const validA = Number.isNaN(distA) ? Number.MAX_VALUE : distA;
    const validB = Number.isNaN(distB) ? Number.MAX_VALUE : distB;

    return validA - validB;
  });
}, [places, userLocation?.latitude, userLocation?.longitude]);
```

#### Integration Points in `map.tsx`:
1. **Card Display (`renderCard`)**:
   `currentPlace` should use `sortedPlaces[activeIndex]` instead of `places[activeIndex]`:
   ```typescript
   const activeIndex = index < sortedPlaces.length ? index : 0;
   const currentPlace = sortedPlaces[activeIndex] || QUIET_SPOTS[0];
   ```
2. **WebView Spots Sync (`useEffect` #4)**:
   Pass `sortedPlaces` to `updateSpots` so markers on the map correspond to the sorted order.
3. **Camera Viewport Focus (`useEffect` #5)**:
   Focus on `sortedPlaces[activeIndex]`.
4. **Index Reset on Initial Location Fix**:
   When `userLocation` transitions from `null` to a valid location object, reset `index` state to `0` so the card automatically highlights the closest place (index 0).

---

## 5. Summary of Proposed Changes (For Implementation Handoff)

| Target File | Type of Change | Summary of Modification |
| ----------- | -------------- | ----------------------- |
| `core_engine/src/utils/haversine.ts` | New Utility File | Export `getHaversineDistance` and `isValidCoordinate` |
| `core_engine/src/api.ts` | Refactor | Import `getHaversineDistance` from `utils/haversine.ts` |
| `app/(tabs)/map.tsx` | Enhancement (R2) | Import `getHaversineDistance`, compute `sortedPlaces` via `useMemo`, bind UI card and markers to `sortedPlaces`, reset `index` to 0 on initial location fix |

---
*Report prepared by Explorer Agent (`explorer_m1_2`)*
