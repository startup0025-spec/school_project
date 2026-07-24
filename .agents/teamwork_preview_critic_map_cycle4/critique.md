# Critique of Data Clean-up & Migration Plan (Cycle 4)

This document provides a detailed critique of the proposed Data Clean-up & Migration Plan for Kakao Map Integration.

---

## 1. SWR Cache Hydration Race Conditions

### 1.1 Critique & Analysis of Proposed Design
The proposed design handles initial mount by calling `getPlaces()` inside a `useEffect` on mount. This triggers `revalidateData()` in the background to fetch fresh data from the GitHub Pages CDN and save it to AsyncStorage.

However, there is a fundamental flaw in this SWR lifecycle implementation:
- **No Reactive UI Update on Background Resolve**: `getPlaces()` is a simple async function that returns a promise once. It resolves immediately with either the AsyncStorage cached data or the bundled fallback JSON. When `revalidateData()` eventually finishes fetching the fresh data in the background and saves it to AsyncStorage, **no state update is triggered in the React Native layer**. The user will continue to see the stale/fallback data until the screen is unmounted and remounted or the app is restarted.
- **Race Condition on First App Launch**: On the first launch, AsyncStorage is empty. The map will load the bundled places immediately. When the CDN fetch completes, it silently updates AsyncStorage. The user remains on the bundled data during the current session, missing out on real-time water levels or new places.

### 1.2 Viewport Jumps and Marker Reset Risks
If we were to modify the code to reactively update the state when SWR resolves (e.g. by setting `places` when the cache changes):
1. **Marker Re-creation & Flicker**: In the WebView, `updateSpots` does:
   ```javascript
   for (var id in markers) { markers[id].setMap(null); }
   markers = {};
   ```
   This wipes and redraws all markers, causing a noticeable visual flicker or blink of markers on the map interface.
2. **Camera Viewport Panning Jump**: In `map.tsx`, the `useEffect` pans the map viewport whenever `currentPlace` changes:
   ```typescript
   useEffect(() => {
     if (isMapReady && !isSdkFailed && currentPlace) {
       const injectScript = `if(window.focusSpot){window.focusSpot(${currentPlace.latitude},${currentPlace.longitude},5);};true;`;
       webViewRef.current?.injectJavaScript(injectScript);
     }
   }, [index, isMapReady, isSdkFailed, currentPlace]);
   ```
   If SWR resolves and updates the data list, and the coordinates of `places[0]` (default active spot) differ from the fallback spot, the map will suddenly pan/jump to the new coordinates, interrupting user interaction.

### 1.3 Suggestions for Improvement
- **Reactive Cache Listener**: Implement an SWR-like custom hook or event listener in `local_places.ts` (e.g. using a subscription mechanism) that notifies `map.tsx` when the cache updates, allowing it to transition to the fresh data.
- **Marker Diffing in WebView**: Modify `updateSpots` in the WebView HTML/JS to diff markers instead of destroying them all. It should only add new markers, delete removed ones, and update positions if they change.
- **Interaction-Aware Focus**: Only execute the auto-panning/focusing (`window.focusSpot`) upon initial map load or when the user explicitly clicks the refresh/next button. Avoid auto-panning on background data updates if the user is already interacting with the map.

---

## 2. Walking Time Calculation Accuracy

### 2.1 Critique of Assumptions
The proposed design uses the Haversine formula to compute a straight-line distance, then divides by 80 meters per minute:
```typescript
const minutes = Math.round(distance / 80);
```

- **Flat/Straight Path Assumption vs. Reality**: The assumption of 80 meters/minute (4.8 km/h) is standard for healthy pedestrians on flat, straight pavement. However, Busan's geography is famously hilly and mountainous.
- **Detour Factor Ignored**: Pedestrians cannot walk in a straight line (Haversine); they must navigate streets, crosswalks, and alleys. An urban detour coefficient of **1.3x to 1.5x** is typical.
- **Terrain Factor Ignored**: Climbing hills drastically reduces pedestrian speed to **50–60 meters/minute** (3.0–3.6 km/h).
- **Cumulative Underestimation**: Combining a straight-line distance (30-50% shorter than the actual path) with a flat-ground speed (20-30% faster than hilly walking) results in a cumulative underestimation of walking times. A spot that is actually a 15–20 minute walk will be presented as a 7–8 minute walk.

### 2.2 Risk of Negative, Zero, or NaN Values
- **Negative Values**: No risk, as the Haversine formula distance is calculated using square roots and trigonometric absolute dimensions.
- **Zero Values**: Handled safely because `minutes <= 1` returns `'도보 1분 이내'`.
- **NaN Risk**: **High Risk**. If the user location fails to resolve properly or a place has corrupt coordinate data, `getHaversineDistance` will compute a `NaN` value. Since `NaN <= 1` is `false`, the function will return `'도보 NaN분'`, resulting in a broken UI string.

### 2.3 Suggestions for Improvement
- **Calibrate Calculations for Busan Terrain**: Apply an urban routing multiplier (e.g., 1.35x) to the Haversine distance, and adjust the walking speed down (e.g., 65 meters per minute) to reflect realistic walking speeds:
  ```typescript
  const estimatedActualDistance = distance * 1.35;
  const minutes = Math.round(estimatedActualDistance / 65);
  ```
- **Robust NaN and Boundary Guarding**:
  ```typescript
  if (isNaN(minutes) || minutes < 0) {
    return '도보 15분'; // Fallback default
  }
  ```

---

## 3. Place Model Field Matching & Compilation Breaks

### 3.1 Dependency Analysis
We performed a deep check across the `mobile` codebase:
- `QuietSpot` and `QUIET_SPOTS` are **only** imported and referenced in `constants/mockData.ts` and `app/(tabs)/map.tsx`.
- No other screens (such as `home_screen.tsx`, `index.tsx`, or `diary.tsx`) depend on the structure of `QuietSpot` or import the mock array.
- The legacy `.note` field on spots is only accessed in `app/(tabs)/map.tsx` at line 66: `{spot.note}`.

### 3.2 Compilation Risk Assessment
- **High Risk during Migration Phase**: Because `QuietSpot` is refactored to extend `Place` (renaming `note` to `description` and removing `pin`), compilation **will break** if `map.tsx` is not migrated simultaneously. 
- Specifically, the references to `spot.note` and `spot.pin` in the legacy `map.tsx` will cause TypeScript compilation failures.

### 3.3 Suggestions for Improvement
- **Atomic Migration Commit**: Ensure that the updates to `mockData.ts` (modifying the `QuietSpot` interface and coordinate values) and `map.tsx` (switching to `currentPlace.description`, removing relative `pinWrap` layout, and adding WebView mapping) are checked in as a single, atomic commit to avoid breaking the build.
- **Backward-Compatible Alias (Optional)**: If needed, define `QuietSpot` with a deprecated getter or alias to ease incremental migrations:
  ```typescript
  export interface QuietSpot extends Place {
    walk: string;
    /** @deprecated Use description instead */
    note?: string; 
  }
  ```

---

## 4. Overall Review Verdict

**Verdict**: **REQUEST_CHANGES**

### Critical/Major Findings
1. **SWR State Hydration Defect**: The proposed UI will not update dynamically when the background SWR request resolves. The user is stuck with stale or fallback data until the next screen load.
2. **NaN Guarding Defect**: The lack of checking for `NaN` coordinates in the walking time calculation poses a high risk of rendering `'도보 NaN분'` in the UI.
3. **Terrain & Routing Inaccuracy**: The straight-line Haversine walking time at 80 m/min is highly inaccurate for Busan's terrain, leading to severe underestimation of walking times.
