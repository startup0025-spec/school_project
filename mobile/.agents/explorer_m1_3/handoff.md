# Handoff Report: Milestone 1 (3-Minute Cooldown & Safe activeIndex analysis)

## 1. Observation
- **Inspected File**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\map.tsx`
- **Place List & Index State**: Lines 351–352
  ```typescript
  351: const [places, setPlaces] = useState<Place[]>([]);
  352: const [index, setIndex] = useState(0);
  387: const activeIndex = index < places.length ? index : 0;
  388: const currentPlace = places[activeIndex] || QUIET_SPOTS[0];
  ```
- **Real-Time Location Watcher**: Lines 400–413
  ```typescript
  400: const sub = await Location.watchPositionAsync(
  401:   { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 10 },
  402:   (loc) => {
  403:     if (!active) return;
  404:     const { latitude, longitude } = loc.coords;
  405:     setUserLocation({ latitude, longitude });
  406:     const injectScript = `if(window.updateUserLocation){window.updateUserLocation(${latitude},${longitude});};true;`;
  407:     webViewRef.current?.injectJavaScript(injectScript);
  408:   }
  409: );
  ```
- **Distance Calculation Utility**: Lines 290–308
  `function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number` is present and handles invalid inputs gracefully.
- **Defect Observation**: Location updates currently stream every ~10 seconds, but `places` is never re-sorted by distance. If re-sorted naively on every GPS tick without throttle or tracking `currentPlace.id`, array order changes will cause UI jumps or out-of-bounds index errors.

## 2. Logic Chain
1. *From Observation 400–413*: Location updates arrive continuously every 10 seconds or 10 meters distance change. Re-sorting `places` on every update causes unthrottled state updates and UI instability.
2. *From Requirement R3*: A strict 3-minute (`180,000 ms`) cooldown gate using `lastSortTimeRef` ensures re-sorting runs at most once per 3 minutes (except for `lastSortTimeRef.current === 0` which triggers immediately on initial GPS fix).
3. *From Observation 351–352, 387–388*: `index` points to a numeric position in `places`. When `places` is re-sorted, element positions change.
4. *Therefore*: To maintain UI stability and prevent card content jumps, `currentSelectedId` (`places[index].id`) must be tracked prior to sort. After sorting, `setIndex` is set to the new index of `currentSelectedId` in the sorted array (`newIdx !== -1 ? newIdx : 0`).

## 3. Caveats
- **Offline / Mock Mode**: If GPS location permissions are denied or unavailable, `userLocation` remains `null` and fallback place list (`QUIET_SPOTS`) order is preserved.
- **Background Tabs**: Location watcher already checks `isFocused` (line 392), suspending position watching when tab is unfocused. When re-focused, the next location update will check `now - lastSortTimeRef.current >= 180000` and re-sort if 3 minutes have passed.

## 4. Conclusion
The 3-minute cooldown throttle and safe `activeIndex` tracking design ready for implementation in `map.tsx` comprises:
1. `lastSortTimeRef` with `SORT_COOLDOWN_MS = 180000`.
2. Functional state update in location watcher callback re-sorting `places` by `getHaversineDistance`.
3. ID-based index re-mapping (`findIndex(p => p.id === currentSelectedId)`) executed atomically alongside place state updates.

Detailed code proposals and specifications are documented in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.agents\explorer_m1_3\analysis.md`.

## 5. Verification Method
1. **Inspection**:
   - Inspect `app/(tabs)/map.tsx` lines 391–431 to confirm insertion of `lastSortTimeRef` and `SORT_COOLDOWN_MS`.
2. **Behavioral Invalidation Tests**:
   - Verify that initial GPS fix triggers immediate distance sort (`lastSortTimeRef.current === 0`).
   - Verify that subsequent GPS updates within 180 seconds do NOT re-sort `places`.
   - Verify that after 180 seconds, the next GPS update triggers re-sorting.
   - Verify that the card currently showing place `X` stays on place `X` after re-sorting, updating `index` to place `X`'s new position in the array.
