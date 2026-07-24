# Deep UI & Kakao Map WebView Bridge Audit Report

## 1. Executive Summary
An exhaustive audit of the `mobile/app/(tabs)` directory and related UI components / Kakao Map WebView bridge was performed. Several high-severity React hook bugs, memory/listener leak conditions, unhandled edge cases, WebView bridge injection risks, and rendering performance flaws were identified.

---

## 2. Comprehensive Findings

### Category A: React Hook Dependency Flaws
1. **`mobile/app/(tabs)/map.tsx` - Line 421 (`useEffect` for Location Watching)**
   - **Issue:** `useEffect` lists `[isFocused]` as dependency, but references `webViewRef.current`. However, when `startWatching()` receives location updates inside `watchPositionAsync` callback, `latitude` and `longitude` are injected. `isFocused` changing toggles subscription on/off, but `subscription` cleanup reference inside async function `startWatching()` could race if unmounted before `watchPositionAsync` resolves.
   - **Risk:** Potential leak of location watcher subscription or state updates on unmounted component if `watchPositionAsync` promise resolves after component unmounts.

2. **`mobile/app/(tabs)/map.tsx` - Line 436 (`useEffect` for Spot Markers Sync)**
   - **Issue:** `useEffect` dependency array is `[isMapReady, isSdkFailed, places, activeIndex]`. Inside the effect, `currentPlace` is derived from `places[activeIndex]`, but `currentPlace?.id` is used while `currentPlace` is NOT included in the dependency array (only `activeIndex`). Furthermore, `webViewRef` is used without checking if WebView instance is mounted.

3. **`mobile/app/(tabs)/map.tsx` - Line 444 (`useEffect` for Camera Viewport Focus)**
   - **Issue:** `useEffect` depends on `[activeIndex, isMapReady, isSdkFailed]`. However, `currentPlace` is used inside. If `places` array updates via SWR cache while `activeIndex` remains 0, the camera focus effect will NOT re-trigger because `places` is missing from dependencies!

4. **`mobile/app/(tabs)/sound.tsx` - Lines 51 & 61 (`useEffect` missing deps with `eslint-disable-line`)**
   - **Issue:** Line 51 disables hook linting for `[playing]`, hiding `waterSource`. Line 61 disables hook linting for `[waterSource]`, hiding `playing`.
   - **Risk:** Stale closures and out-of-sync audio engine playback state when `playing` and `waterSource` change in rapid succession.

5. **`mobile/app/(tabs)/diary.tsx` - Line 41 (`useCallback` for `renderItem`)**
   - **Issue:** `renderItem` lists `[colors, diaryEntries.length]` in dependency array, but inside the callback it accesses `diaryEntries[index]` indirectly via item comparison `index !== diaryEntries.length - 1`. If `diaryEntries` array items change without changing total length (e.g. deletion and insertion, or reordering), `renderItem` closure retains old references. `diaryEntries` should be included or avoided via item indexing.

---

### Category B: Memory Leaks & Listener Cleanup
1. **`mobile/app/(tabs)/map.tsx` - Lines 61-68 (HTML Bridge Poller `setInterval`)**
   - **Issue:** `var bridgePoller = setInterval(...)` inside Kakao Map WebView HTML template attempts `clearInterval(bridgePoller)` when `ReactNativeWebView.postMessage` exists. If `window.ReactNativeWebView` is never injected (e.g., loaded in standard web browser or WebKit crash), `setInterval` runs infinitely at 50ms interval forever consuming CPU.
   - **Fix:** Add max retry counter (e.g. 100 iterations / 5 seconds) to clear interval and fail gracefully.

2. **`mobile/app/(tabs)/map.tsx` - Lines 120-135 (HTML SDK Timeout `setTimeout`)**
   - **Issue:** `sdkTimeout` is set to 8000ms. If Kakao Map script fails to load, `handleScriptError` clears `sdkTimeout`. However, if `window.onload` succeeds, `clearTimeout(sdkTimeout)` is called. But if `window.onload` never fires (e.g. navigation away or aborted web view load), `sdkTimeout` fires postMessage on a detached/unmounted web view context.

3. **`mobile/app/(tabs)/map.tsx` - Lines 389-421 (`watchPositionAsync` Race Condition Leak)**
   - **Issue:** `startWatching()` is an `async` function inside `useEffect`. If `isFocused` turns `false` before `await Location.watchPositionAsync(...)` resolves, the cleanup function returns early (`subscription` is `null` at cleanup execution time). When `watchPositionAsync` finally resolves, `subscription` is assigned but its `remove()` is NEVER called!
   - **Impact:** Orphaned high-accuracy background location watcher leaking memory and draining battery rapidly.

4. **`mobile/context/RippleContext.tsx` - Lines 121-165 (DeviceEventEmitter Subscriptions)**
   - **Issue:** Subscriptions are correctly cleaned up in `useEffect` return (`dangerSub.remove()`, etc.). However, `AsyncStorage.setItem` inside `addDiaryEntry` is unhandled for unmounted state or storage quota errors.

---

### Category C: WebView Communication, Injection & Edge Cases
1. **`mobile/app/(tabs)/map.tsx` - Lines 407, 433, 441, 448 (Unescaped string interpolation in `injectJavaScript`)**
   - **Issue (Injection Risk):**
     - Line 433: `window.updateSpots(${JSON.stringify(spotsData)}, '${activeSpotId}')`
     - Line 441: `window.focusSpot(${currentPlace.latitude},${currentPlace.longitude},5)`
     - Line 407: `window.updateUserLocation(${latitude},${longitude})`
   - If `activeSpotId` or `spot.name` contains single quotes (`'`) or special characters like `\n` or `</script>`, raw string interpolation in `injectJavaScript` causes JS syntax errors in WebKit or code injection vulnerabilities.
   - **Fix:** Use `JSON.stringify()` for ALL values passed into `injectJavaScript`, e.g. `JSON.stringify(activeSpotId)`.

2. **`mobile/app/(tabs)/map.tsx` - Lines 230-235 (SVG string concat in Kakao Map WebView)**
   - **Issue:** `markerImage` creates data URI via `'data:image/svg+xml;charset=UTF-8,' + svgStr`. Unencoded `#` characters in SVG colors (e.g. `%23007AFF`) work in some WebKits, but raw unencoded SVG XML in data URI fails to render markers in Android WebViews (Chromium engine requires `encodeURIComponent`).

3. **`mobile/app/(tabs)/map.tsx` - Lines 492-510 (`handleDeepLink` exception handling & parameter encoding)**
   - **Issue:** `encodeURIComponent(name)` encodes name, but if `kakaomap://` scheme is opened without Kakao Map app installed on iOS, `Linking.canOpenURL` may return `true` if declared in Info.plist even if app launch fails, or throw an unhandled rejection.

4. **`mobile/app/(tabs)/map.tsx` - Lines 524-525 (`API_KEY` replacement flaw)**
   - **Issue:** `const htmlContent = KAKAO_MAP_HTML.replace('YOUR_JS_API_KEY', apiKey);`. If `KAKAO_MAP_HTML` is re-rendered or evaluated, `.replace()` only replaces the first instance. If `apiKey` is empty string or undefined, Kakao SDK script fails with HTTP 400 without descriptive error.

---

### Category D: UI / State / Null Dereference Bugs
1. **`mobile/app/(tabs)/map.tsx` - Lines 383-384 (`activeIndex` & `currentPlace` fallback)**
   - **Issue:** `const activeIndex = index < places.length ? index : 0;`
     `const currentPlace = places[activeIndex] || QUIET_SPOTS[0];`
     If `places` is empty `[]` and `QUIET_SPOTS` is empty, `currentPlace` is `undefined`. Line 583 (`currentPlace.name`) will throw a TypeError crashing the screen.

2. **`mobile/app/(tabs)/map.tsx` - Lines 608-611 (Index Cycle State Update)**
   - **Issue:** `setIndex((i) => (i + 1) % (places.length || QUIET_SPOTS.length));`
     If `places.length` is 0 and `QUIET_SPOTS.length` is 0, modulo by zero results in `NaN`, corrupting state.

3. **`mobile/app/(tabs)/index.tsx` - Lines 69-93 (Banner Dismissal State)**
   - **Issue:** `useEffect(() => { setBannerDismissed(false); }, [currentMessage]);`
     When `currentMessage` changes, state is updated. If user dismisses banner, but `RippleContext` triggers re-render with identical object reference, banner state is fine. However, `MOVEMENT_COPY[movement]` on Line 62 could access undefined if `movement` key is invalid.

4. **`mobile/app/(tabs)/diary.tsx` - Line 65 (`scrollEnabled` prop redundancy)**
   - **Issue:** `<FlatList scrollEnabled={diaryEntries.length > 0} ... />`. `scrollEnabled` being false when empty is harmless because `ListEmptyComponent` is not used here (empty state is rendered conditionally on line 53), but conditional rendering destroys `FlatList` internal state on state transition.

---

## 3. Recommended Remediation & Action Plan

| Component | Target File | Issue Description | Fix Strategy |
|---|---|---|---|
| Map Screen | `mobile/app/(tabs)/map.tsx` | Async `watchPositionAsync` location watcher race leak | Track cancel token / ref boolean before assigning subscription |
| Map Screen | `mobile/app/(tabs)/map.tsx` | String interpolation in `injectJavaScript` | Wrap all injected parameters with `JSON.stringify()` |
| Map Screen | `mobile/app/(tabs)/map.tsx` | Missing `places` in `useEffect` camera focus deps | Add `places` to dependency array |
| Map Screen | `mobile/app/(tabs)/map.tsx` | Infinite 50ms `bridgePoller` interval in HTML | Limit max polling attempts (e.g. 100) and clear interval |
| Sound Screen | `mobile/app/(tabs)/sound.tsx` | `eslint-disable-line` hiding stale closure in audio engine sync | Refactor effects to unify `playing` and `waterSource` state updates |
| Diary Screen | `mobile/app/(tabs)/diary.tsx` | `useCallback` dependency omission for `diaryEntries` | Include `diaryEntries` or use stable item index accessor |

