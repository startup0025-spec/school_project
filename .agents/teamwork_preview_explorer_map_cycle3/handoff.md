# Handoff Report — Cycle 3: State Keep-Alive & Performance Optimization Strategy

This report summarizes the observations, design logic, conclusions, and verification methods for the Kakao Maps WebView Keep-Alive and Viewport optimizations in *Anyway, the Sea*.

---

## 1. Observation
- **Current Map Component (`mobile/app/(tabs)/map.tsx`)**:
  - Currently renders a static image asset (`quiet-map.png`) rather than the active Kakao Maps WebView component:
    ```typescript
    36:         <Image
    37:           source={require('@/assets/images/quiet-map.png')}
    38:           style={StyleSheet.absoluteFillObject}
    39:           resizeMode="cover"
    40:         />
    ```
- **Current Tab Layout (`mobile/app/(tabs)/_layout.tsx`)**:
  - Implements standard `Tabs` from `expo-router` without disabling screen detachment:
    ```typescript
    50:     <Tabs
    51:       screenOptions={{
    52:         tabBarActiveTintColor: colors.primary,
    53:         tabBarInactiveTintColor: colors.mutedForeground,
    ```
    This means the default navigation behaviour will detach screens on focus loss, resulting in native WebView teardowns.
- **Previous Event Bridge Design**:
  - Handed off in Cycle 2, detailing local HTML inline bootstrap and bidirectional message bridge via `postMessage`.

---

## 2. Logic Chain
1. **Quota Protection**:
   - *Observation*: Kakao Map JS SDK charges quota per map initialization.
   - *Reasoning*: If the user switches tabs and the screen unmounts or detaches, the page is reloaded when they return, wasting daily API limits. Keeping the WebView mounted throughout the app session restricts the quota to a single load per session.
2. **Preventing Native Detachment**:
   - *Observation*: React Navigation's default behavior detaches background views.
   - *Reasoning*: Specifying `detachInactiveScreens: false` in the Tab Navigator screen options keeps all screens in the native hierarchy, ensuring the native WebView is not terminated.
3. **Avoiding `display: 'none'` Issues**:
   - *Observation*: Hiding native WebViews using `display: 'none'` or conditional rendering causes WebGL context loss and pauses JS execution on Android, leading to blank screens or forced reloads.
   - *Reasoning*: Instead of `display: 'none'`, we transition the container style using absolute off-screen positioning (`position: 'absolute', top: -9999, left: -9999, width: 1, height: 1, opacity: 0`) when the screen is blurred. This preserves the JS context, DOM, and Kakao map state safely.
4. **Locking Viewport Controls**:
   - *Observation*: Touch-gestures in mobile WebViews can trigger page-level zooms and double-taps, breaking the UI layout.
   - *Reasoning*: Specifying `scalesPageToFit={false}` on the WebView, setting `user-scalable=no` in the HTML meta viewport tag, and applying `touch-action: none` to the `#map` element overrides default browser behavior. This routes all pinch and pan touches directly to Kakao Map's JS gesture handler for smooth zooming.

---

## 3. Caveats
- **Memory Overhead**: Disabling `detachInactiveScreens` prevents native detachment of *all* screens in the Tab Navigator. Since the other screens (`Index`, `Sound`, `Diary`, `Safety`) are lightweight native layouts, the memory cost is negligible. However, if resource pressure grows, Option B (Global Root-Level WebView Overlay) remains a viable alternative.
- **Orientation changes**: Viewport scale parameters must be coupled with `-webkit-text-size-adjust: 100%;` to prevent text layout scaling when transitioning between portrait and landscape.

---

## 4. Conclusion
The proposed architecture in `analysis.md` successfully addresses Keep-Alive and Performance Optimization for the Kakao Map WebView. It establishes:
1. **Quota protection** via screen-level state persistence (`detachInactiveScreens: false`).
2. **Off-screen absolute positioning layout transitions** to prevent rendering overhead when blurred without destroying the WebGL/JS context.
3. **Viewport locks** (`scalesPageToFit={false}`, `user-scalable=no`, and `touch-action: none`) for smooth gesture routing.

---

## 5. Verification Method
- **File Inspection**:
  - Review `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle3\analysis.md` to verify the full design details and React Native layout patterns.
- **Verification Command**:
  - Run typecheck in the `mobile/` directory to verify there are no compilation errors:
    `cmd /c "npm run typecheck"`
