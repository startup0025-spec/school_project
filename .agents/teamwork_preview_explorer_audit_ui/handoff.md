# Handoff Report — UI & Kakao Map WebView Bridge Audit

## 1. Observation
- **Scope Audited:**
  - `mobile/app/(tabs)/_layout.tsx`
  - `mobile/app/(tabs)/index.tsx`
  - `mobile/app/(tabs)/map.tsx`
  - `mobile/app/(tabs)/sound.tsx`
  - `mobile/app/(tabs)/diary.tsx`
  - `mobile/app/(tabs)/safety.tsx`
  - `mobile/app/notifications.tsx`
  - `mobile/app/_layout.tsx`
  - `mobile/context/RippleContext.tsx`
  - `mobile/components/WaveformVisualizer.tsx`
  - `mobile/components/RippleOrb.tsx`
  - `mobile/components/ErrorBoundary.tsx`
  - `mobile/components/ErrorFallback.tsx`
  - `mobile/hooks/useLocationPermissionMonitor.ts`

- **Key Defects Discovered:**
  1. `mobile/app/(tabs)/map.tsx:389-421`: **Memory/Location Watcher Leak**. `Location.watchPositionAsync` is asynchronous. When tab focus toggles rapidly (`isFocused` transitions `true` -> `false`), cleanup executes before `watchPositionAsync` resolves (`subscription` is `null`), resulting in an un-cleared location listener running in background.
  2. `mobile/app/(tabs)/map.tsx:407, 433, 441`: **JS Injection / Syntax Breaking Vulnerability**. `injectJavaScript` relies on raw string interpolation (`'${activeSpotId}'`). If spot names or IDs contain single quotes, double quotes, or newlines, JS execution fails or permits script injection in Kakao Map WebView.
  3. `mobile/app/(tabs)/map.tsx:61-68`: **Infinite Web Worker Interval Leak**. Kakao Map HTML template runs `setInterval` every 50ms to flush message queue without a max iteration timeout.
  4. `mobile/app/(tabs)/sound.tsx:31-61`: **Stale Closure Audio Engine Bugs**. `useEffect` blocks use `eslint-disable-line` to ignore `waterSource` and `playing` cross-dependencies, causing out-of-sync audio playback during fast toggle interactions.
  5. `mobile/app/(tabs)/map.tsx:444`: **Missing Hook Dependency**. Camera viewport focus `useEffect` is missing `places` in its dependency array.

---

## 2. Logic Chain
1. **Location Watcher Leak:**
   - In `map.tsx` line 396: `subscription = await Location.watchPositionAsync(...)`.
   - The effect cleanup function on line 415 checks `if (subscription) subscription.remove()`.
   - If `isFocused` changes to `false` during the `await` execution, cleanup fires while `subscription` is still `null`.
   - When `watchPositionAsync` promise fulfills post-cleanup, `subscription` is created without any remaining reference to remove it, causing battery and memory leak.

2. **Kakao Map IPC String Escaping:**
   - Line 433: `window.updateSpots(${JSON.stringify(spotsData)}, '${activeSpotId}')`.
   - Wrapping `${activeSpotId}` in literal quotes (`'${...}'`) rather than using `JSON.stringify(activeSpotId)` causes broken JS syntax if `activeSpotId` contains quotes or special characters.

3. **Audio State Synchronization:**
   - In `sound.tsx`, line 31 updates sound on `[playing]` and line 54 updates sound on `[waterSource]`.
   - Disabling `react-hooks/exhaustive-deps` hides stale values of `waterSource` when `playing` flips from `false` to `true`, causing stream audio to play instead of selected river audio.

---

## 3. Caveats
- Android native WebGL canvas context behavior for Kakao Maps was analyzed statically based on standard WebView configuration in `react-native-webview`.
- No source code modifications were performed in `mobile/` as per Explorer role constraints.

---

## 4. Conclusion
The UI layer and Kakao Map WebView bridge are functionally comprehensive but suffer from critical edge-case memory leaks (`watchPositionAsync` unmount race condition), WebScript injection vulnerabilities (raw parameter interpolation in `injectJavaScript`), and React hook dependency omissions. Following the recommended fixes in `analysis.md` will solidify app stability, prevent battery drain, and eliminate potential WebKit bridge crashes.

---

## 5. Verification Method
1. **React Hook & Memory Leak Verification:**
   - Inspect `mobile/app/(tabs)/map.tsx` around lines 389-421. Verify location subscription is cancelled if component loses focus prior to promise resolution.
2. **WebView Bridge Security Verification:**
   - Test passing a place name or ID containing single quotes (`'`) or Korean quotes to `updateSpots` via `injectJavaScript` and confirm JS syntax remains valid.
3. **Audio Sync Verification:**
   - Mount `sound.tsx`, toggle sound source rapidly while pausing/playing, and verify audio engine receives current state without race conditions.
