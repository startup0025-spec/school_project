# Handoff Report - Cycle 5 Map & UGC Critique

## 1. Observation
1. **SVG Double Encoding**:
   - Inside `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_ugc_cycle5\analysis.md` (lines 35-37):
     ```javascript
     var activeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">' +
       '<path d="..." fill="%23007AFF" stroke="white" stroke-width="2"/>' +
       '</svg>';
     ```
     and line 48:
     ```javascript
     'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(activeSvg),
     ```
2. **Marker Image Re-instantiation**:
   - Inside `analysis.md` (lines 47-57):
     ```javascript
     window.updateSpots = function(spots, activeSpotId) {
       ...
       var activeMarkerImage = new kakao.maps.MarkerImage(...);
       var inactiveMarkerImage = new kakao.maps.MarkerImage(...);
     ```
3. **Missing React Native Imports and Styles in map.tsx**:
   - Inside `analysis.md` (lines 228-275), native components `<Modal>` and `<TextInput>` are added to `map.tsx`'s place card renderer, and styles are referenced as `styles.modalOverlay`, `styles.modalContent`, etc.
   - Inside `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\map.tsx` (lines 1-2), the imports from `'react-native'` do not include `Modal` or `TextInput`.
   - Inside `map.tsx` stylesheet (lines 567-623), no styles for `modalOverlay`, `modalContent`, etc., are defined.
4. **SWR Cache Revalidation Disabled**:
   - Inside `analysis.md` (lines 371-403), the proposed `getPlaces()` function in `local_places.ts` checks the cache first:
     ```typescript
     export const getPlaces = async (): Promise<Place[]> => {
       // 1. Check in-memory cache first
       if (inMemoryPlaces) {
         return inMemoryPlaces;
       }
       // 2. Fall back to AsyncStorage...
     ```
     but completely omits the original revalidation check block (originally at `mobile/core_engine/src/database/local_places.ts` lines 60-67):
     ```typescript
     const now = Date.now();
     if (!isRevalidating && now - lastFetchTime > FRESHNESS_THRESHOLD) {
       isRevalidating = true;
       ...
     }
     ```
5. **Revalidation Failing to Update In-Memory Cache**:
   - Inside `analysis.md` (lines 359-369), the helper `updateInMemoryCache()` updates `inMemoryPlaces` and `inMemoryMap`.
   - Inside original `local_places.ts` (lines 38-57), `revalidateData()` writes to AsyncStorage and notifies listeners, but never calls `updateInMemoryCache()`.
6. **Missing Android package queries**:
   - Inside `analysis.md` (lines 320-329), only the iOS Info.plist whitelisting is configured under `expo.ios.infoPlist`. There is no configuration for Android package visibility.
7. **Typecheck Failures on Existing Code**:
   - Running typecheck using `powershell -ExecutionPolicy Bypass -Command "npx tsc -p tsconfig.json --noEmit"` in `mobile/` failed with exit code 1 due to missing libraries in `package.json` (such as `axios`, `expo-file-system`, `expo-av`, `expo-task-manager`, and `expo-notifications`).

## 2. Logic Chain
1. From Observation 1, because `encodeURIComponent` escapes `%` to `%25`, calling it on a string containing `%23` results in `%2523`. This double-escapes the hex symbol `#` inside the SVG markup to `%23`, which the SVG rendering engine cannot parse as a valid color code, causing markers to render as black/transparent.
2. From Observation 2, reinstantiating `MarkerImage` inside `window.updateSpots` on every spot/index switch creates memory churn. In Webviews, repeatedly loading SVG data URIs inside brand new objects leaks memory.
3. From Observation 3, referencing `Modal`, `TextInput`, and modal styles without importing or defining them leads to TypeScript compile-time errors and immediate runtime layout breakdown.
4. From Observation 4, since `getPlaces()` returns immediately when `inMemoryPlaces` is populated without firing the background fetch check, once the cache is loaded, revalidation is permanently disabled.
5. From Observation 5, since `revalidateData()` updates AsyncStorage and notifies SWR listeners but never calls `updateInMemoryCache()`, any subsequent direct calls to `getPlaces()` or `getPlaceByIdSync()` retrieve stale data from the un-refreshed in-memory variables.
6. From Observation 6, because Android 11+ restricts package query visibility, calling `Linking.canOpenURL('kakaomap://')` on Android will return `false` without explicit `<queries>` intent mapping in the manifest, forcing the app to always open the web fallback.
7. From Observation 7, missing packages in `mobile/package.json` prevent TypeScript from compiling files that depend on them.

Therefore, we conclude that the implementation plan **must be revised** to resolve these correctness bugs, package gaps, and compile errors.

## 3. Caveats
- Physical native deep link launching could not be tested on a real device/emulator.

## 4. Conclusion
We issue a **REQUEST_CHANGES** verdict. The implementer must incorporate the following fixes:
1. Replace `%23` with literal `#` in JS SVG strings.
2. Define the marker images globally to prevent memory leaks.
3. Add missing imports (`Modal`, `TextInput`) and styles to `map.tsx`.
4. Restore SWR background checking block inside `getPlaces()`.
5. Call `updateInMemoryCache` inside `revalidateData()`.
6. Add Android manifest intent query for the `kakaomap` scheme, or bypass `canOpenURL` with try-catch `openURL`.
7. Add missing Expo dependencies and `axios` to `mobile/package.json`.

## 5. Verification Method
1. **Typechecking**:
   Run `npx tsc -p tsconfig.json --noEmit` in `mobile/` directory to verify compile success after implementing the imports and dependency fixes.
2. **Review output files**:
   Inspect `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_critic_map_ugc_cycle5\critique.md` for full detailed findings.
