# Handoff Report: critique of Data Clean-up & Migration Plan (Cycle 4)

## 1. Observation
- **Local Places Database**: In `mobile/core_engine/src/database/local_places.ts`, the `getPlaces()` function reads from AsyncStorage and returns cached data or fallback data, while calling `revalidateData()` in the background to fetch updated data from `https://haetae05.github.io/Anyway_the_Sea/data/busan_places_master.json`. `revalidateData()` runs completely asynchronously and saves to AsyncStorage, but does not provide a subscription/callback to update active component state:
  ```typescript
  async function revalidateData(): Promise<void> {
    try {
      const response = await fetch(CDN_URL, ...);
      ...
      const json = await response.json();
      if (json && Array.isArray(json.places) && json.places.length > 0) {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json));
        console.log(`[local_places] SWR: GitHub Pages에서 최신 장소 데이터(${json.places.length}건) 캐싱 완료.`);
      }
    } ...
  }
  ```
- **Proposed Map Screen Logic**: In `.agents/teamwork_preview_explorer_map_cycle4/analysis.md` lines 309-324:
  ```typescript
  useEffect(() => {
    async function initPlaces() {
      try {
        const data = await getPlaces();
        if (data && data.length > 0) {
          setPlaces(data);
        } else {
          setPlaces(QUIET_SPOTS);
        }
      } ...
    }
    initPlaces();
  }, []);
  ```
  This loads `places` exactly once on mount, meaning any background revalidation in `revalidateData` that resolves after `initPlaces` runs will not update the screen state.
- **Walking Time Logic**: In `.agents/teamwork_preview_explorer_map_cycle4/analysis.md` lines 160-165:
  ```typescript
  const minutes = Math.round(distance / 80); // Assuming 80 meters per minute (approx. 4.8 km/h)
  if (minutes <= 1) return '도보 1분 이내';
  return `도보 ${minutes}분`;
  ```
- **Search of `QuietSpot` References**: Using PowerShell searches, we confirmed that `QuietSpot` and `QUIET_SPOTS` are exclusively declared in `mobile/constants/mockData.ts` and imported in `mobile/app/(tabs)/map.tsx`. No other files use these terms or reference the `.note` property.
- **Legacy Property Usage**: In `mobile/app/(tabs)/map.tsx` line 66, the legacy property `.note` is accessed:
  ```typescript
  <Text style={[styles.spotNote, { color: colors.mutedForeground }]}>{spot.note}</Text>
  ```

## 2. Logic Chain
1. **Lack of Dynamic SWR State Hydration**: Because `initPlaces()` only runs once inside the mount `useEffect`, and `local_places.ts` does not emit an event or notify of storage updates when `revalidateData()` successfully fetches new data from the CDN, the screen `places` state remains stale for the current session.
2. **Marker Refresh and Viewport Jump**: If we were to update the state reactively, the WebView's `updateSpots` script resets all markers which causes a flash/flicker. Furthermore, the coordinate panning `useEffect` triggers on `currentPlace` changes, meaning the camera viewport will automatically snap to new coordinates when the background data hydrater resolves, disrupting manual panning/zooming.
3. **Underestimated Travel Time**: Busan's terrain is notoriously hilly and urban roads are non-linear. The straight-line Haversine distance ignores routing detours (which add a ~1.35x multiplier to the distance) and the walking speed assumption of 80 m/min ignores elevation slowdowns (which reduce speed to ~65 m/min). Without adjustments, estimated travel times will be severely underestimated.
4. **NaN Safety Hazard**: If coordinates are missing or invalid, `distance` is computed as `NaN`, making `minutes` evaluate to `NaN`. Because `NaN <= 1` is false, it returns `도보 NaN분`, causing a raw invalid string to appear on the UI.
5. **No Compiler Breaks Outside `map.tsx`**: Since `QuietSpot` and `QUIET_SPOTS` are not used in `home_screen.tsx` or `index.tsx`, the model matching changes only affect `map.tsx`. However, the updates to `mockData.ts` and `map.tsx` must be done in tandem to avoid immediate compiler breaks during migration due to the replacement of `.note` with `.description` and the removal of the `.pin` layout values.

## 3. Caveats
- We did not deploy a live simulator to measure the exact visual flicker duration on different devices (iOS vs. Android WebViews).
- We assumed that there are no hidden JavaScript dynamic object accesses to `note` that would bypass TypeScript compile-time checks (such as `any` casting in other undocumented modules), although our text-search confirmed no such patterns exist in the codebase.

## 4. Conclusion
The proposed plan is well-formulated but contains critical design flaws that must be addressed:
1. SWR background updates do not trigger UI re-renders, leaving users with stale data.
2. Marker rendering is inefficient (clearing all) and camera snapping will disrupt user interactions if data updates asynchronously.
3. Walking times will be highly inaccurate due to flat-ground/straight-line assumptions and are susceptible to displaying `'도보 NaN분'` if GPS signals or coordinate payloads contain incomplete or invalid numbers.
4. Compilation will break unless modifications to `mockData.ts` and `map.tsx` are checked in as a single atomic package.

## 5. Verification Method
1. **Review files**: View the written `critique.md` at `.agents/teamwork_preview_critic_map_cycle4/critique.md` to confirm the review findings.
2. **Check for compilation issues**: Run `npx tsc --noEmit` or equivalent in the `mobile` workspace to verify that editing the files in isolation vs. atomically results in expected type checker alerts.
