# Milestone 1 Analysis: 3-Minute Cooldown & Safe activeIndex Mechanism for MapScreen

## Executive Summary
This analysis investigates `app/(tabs)/map.tsx` in `Anyway_the_Sea/mobile` to design a robust 3-minute (180,000 ms) cooldown throttle for distance-based re-sorting on continuous real-time GPS updates (Requirement R3), combined with a safe `activeIndex` update mechanism that tracks place unique IDs during re-sorting to prevent UI jumps or out-of-bounds crashes.

---

## 1. Existing Code Structure & Findings (`app/(tabs)/map.tsx`)

### 1.1 State Management (Lines 351–355, 387–388)
```typescript
351: const [places, setPlaces] = useState<Place[]>([]);
352: const [index, setIndex] = useState(0);
...
355: const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
...
387: const activeIndex = index < places.length ? index : 0;
388: const currentPlace = places[activeIndex] || QUIET_SPOTS[0];
```
- **Place List State (`places`)**: Stores the list of `Place` objects loaded from local cache (`getPlaces()`) or mock fallback (`QUIET_SPOTS`).
- **Index State (`index`)**: Numeric index pointing to the currently selected place within `places`.
- **Derived Active State (`activeIndex` & `currentPlace`)**: Safely clamps `index` to bounds (`index < places.length ? index : 0`) and resolves `currentPlace`.

### 1.2 Foreground Location Listener (Lines 391–431)
```typescript
391: useEffect(() => {
392:   if (!isFocused) return;
393:   let active = true;
394:   let subscription: Location.LocationSubscription | null = null;
395:
396:   async function startWatching() {
397:     const { status } = await Location.requestForegroundPermissionsAsync();
398:     if (status !== 'granted' || !active) return;
399:
400:     const sub = await Location.watchPositionAsync(
401:       {
402:         accuracy: Location.Accuracy.Balanced,
403:         timeInterval: 10000,
404:         distanceInterval: 10,
405:       },
406:       (loc) => {
407:         if (!active) return;
408:         const { latitude, longitude } = loc.coords;
409:         setUserLocation({ latitude, longitude });
410:         
411:         const injectScript = `if(window.updateUserLocation){window.updateUserLocation(${latitude},${longitude});};true;`;
412:         webViewRef.current?.injectJavaScript(injectScript);
413:       }
414:     );
...
```
- **Observation**: `watchPositionAsync` fires every ~10,000 ms (10 seconds) or 10 meters when focused.
- **Current Defect**: Currently, location updates only update `userLocation` state and inject coordinates into the Kakao Map WebView (`window.updateUserLocation`). **No distance re-sorting is performed on `places`**, so places remain in their default static order.

---

## 2. Design of 3-Minute (180,000 ms) Strict Cooldown / Throttle Logic (R3)

### 2.1 Problem Statement
Continuous GPS streams deliver location updates every 10 seconds. Re-sorting `places` by Haversine distance on every single location update would cause:
1. Frequent unnecessary recalculations and React state re-renders.
2. Constant re-ordering of UI elements disrupting the user experience.
3. Excessive WebView marker state updates.

### 2.2 Cooldown Architecture & Specifications
- **Cooldown Interval**: `SORT_COOLDOWN_MS = 180000` (3 minutes / 180,000 ms).
- **Timestamp Ref**: `lastSortTimeRef = useRef<number>(0)` to store `Date.now()` timestamp of the last executed distance sort.
- **Immediate First-Fix Rule**: `lastSortTimeRef.current === 0` allows immediate sorting on the first GPS location fix, ensuring the user gets proximity-sorted places right away upon opening the map.
- **Cooldown Gate Condition**:
  ```typescript
  const now = Date.now();
  if (lastSortTimeRef.current === 0 || now - lastSortTimeRef.current >= SORT_COOLDOWN_MS) {
    // Execute distance sorting & update lastSortTimeRef.current = now
  }
  ```

---

## 3. Design of Safe activeIndex Update Mechanism

### 3.1 Problem Statement
When `places` array is re-sorted by distance:
- Suppose `places` before sorting is `[Place A (idx 0), Place B (idx 1), Place C (idx 2)]`, and the user is viewing **Place B** (`index = 1`).
- After re-sorting by distance, the new array order becomes `[Place B, Place C, Place A]`.
- If `index` remains unchanged (`1`), `places[1]` now points to **Place C**. The user UI suddenly jumps from Place B to Place C without user interaction!
- If places count shrinks or array changes, `index` might also exceed bounds.

### 3.2 Safe Update Protocol (ID-Preserving Index Mapping)
To prevent UI jumps and out-of-bounds errors:
1. **Identify Selected ID**: Before performing sort, record the unique ID of the currently selected place:
   ```typescript
   const currentSelectedId = currentPlace?.id;
   ```
2. **Sort Copy**: Create a new array sorted by Haversine distance from the user's current GPS location (`userLocation` or new incoming coordinates):
   ```typescript
   const sorted = [...places].sort((a, b) => {
     const distA = getHaversineDistance(coords.latitude, coords.longitude, a.latitude, a.longitude);
     const distB = getHaversineDistance(coords.latitude, coords.longitude, b.latitude, b.longitude);
     return distA - distB;
   });
   ```
3. **Map Target Index**: Locate `currentSelectedId` in the newly sorted array:
   ```typescript
   const newIndex = sorted.findIndex((p) => p.id === currentSelectedId);
   const safeIndex = newIndex !== -1 ? newIndex : 0;
   ```
4. **Atomic State Update**: Update `places` and `index` synchronously:
   ```typescript
   setPlaces(sorted);
   setIndex(safeIndex);
   lastSortTimeRef.current = now;
   ```

### 3.3 Verification of State Invariants
- `currentPlace` remains `Place B` (`sorted[safeIndex].id === currentSelectedId`).
- Card UI content remains unchanged (no visible jump or flickering).
- WebView active spot marker (`activeSpotId`) remains unchanged.
- Next spot cycling (`refreshButton`) will seamlessly navigate to the next closest spot in the new sorted order.

---

## 4. Proposed Code Implementation for MapScreen

Below is the concrete implementation plan to be applied to `app/(tabs)/map.tsx`.

### 4.1 Addition of Ref & Constant
```typescript
const SORT_COOLDOWN_MS = 180000; // 3 minutes
const lastSortTimeRef = useRef<number>(0);
```

### 4.2 Re-sorting Helper Function
```typescript
const sortPlacesByDistance = (
  rawPlaces: Place[],
  coords: { latitude: number; longitude: number }
): Place[] => {
  return [...rawPlaces].sort((a, b) => {
    const distA = getHaversineDistance(coords.latitude, coords.longitude, a.latitude, a.longitude);
    const distB = getHaversineDistance(coords.latitude, coords.longitude, b.latitude, b.longitude);
    return distA - distB;
  });
};
```

### 4.3 Integration inside Location Watcher (`watchPositionAsync`)
```typescript
(loc) => {
  if (!active) return;
  const { latitude, longitude } = loc.coords;
  setUserLocation({ latitude, longitude });

  const injectScript = `if(window.updateUserLocation){window.updateUserLocation(${latitude},${longitude});};true;`;
  webViewRef.current?.injectJavaScript(injectScript);

  // 3-Minute Cooldown & Safe activeIndex Re-sorting Logic (R3)
  const now = Date.now();
  if (lastSortTimeRef.current === 0 || now - lastSortTimeRef.current >= SORT_COOLDOWN_MS) {
    setPlaces((prevPlaces) => {
      if (!prevPlaces || prevPlaces.length === 0) return prevPlaces;

      const currentSelectedId = prevPlaces[index]?.id;
      const sorted = [...prevPlaces].sort((a, b) => {
        const distA = getHaversineDistance(latitude, longitude, a.latitude, a.longitude);
        const distB = getHaversineDistance(latitude, longitude, b.latitude, b.longitude);
        return distA - distB;
      });

      if (currentSelectedId) {
        const newIdx = sorted.findIndex((p) => p.id === currentSelectedId);
        setIndex(newIdx !== -1 ? newIdx : 0);
      }

      lastSortTimeRef.current = now;
      return sorted;
    });
  }
}
```

### 4.4 Initial Data Load & SWR Cache Subscription Integration
When `initPlaces()` or `subscribeToPlacesCache` fires and returns new data, if `userLocation` is already available, apply `sortPlacesByDistance` immediately to preserve distance ordering.

---

## 5. Risk Assessment & Invalidation Conditions

| Risk | Mitigation |
| --- | --- |
| Rapid initial GPS updates cause multi-sorting | `lastSortTimeRef.current` updated immediately on first sort execution |
| Memory leaks / invalid React state updates | Use functional state setter `setPlaces((prev) => ...)` and proper cleanup in `useEffect` |
| `places` array empty on init | Safe length checks (`prevPlaces.length > 0`) and fallback index to `0` |
| Navigation away from screen | `lastSortTimeRef` persists in ref across re-renders; location subscription removed cleanly via `subscription.remove()` on blur/unmount |

