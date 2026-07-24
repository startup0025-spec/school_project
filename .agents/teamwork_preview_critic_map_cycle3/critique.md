# Critique: Keep-Alive & Performance Optimization Strategy (Cycle 3)

**Author**: teamwork_preview_reviewer (BERRY 🍎)  
**Target**: Keep-Alive & Performance Optimization Strategy proposed by the Explorer in Cycle 3 (`teamwork_preview_explorer_map_cycle3/analysis.md`)  
**Verdict**: **REQUEST_CHANGES** (Significant performance, battery drain, and suspension risks identified)

---

## Executive Summary

While the Explorer's proposed strategy of using a hidden off-screen WebView with `detachInactiveScreens: false` successfully prevents page re-renders and protects the Kakao Maps JS API quota, it introduces critical side effects in resource usage, battery consumption, and rendering reliability. This critique details these risks and provides concrete engineering solutions to mitigate them.

---

## 1. Android Memory Usage & OOM Prevention (`detachInactiveScreens: false`)

### Concerns & Findings
1. **Global Navigator Bloat**: Setting `detachInactiveScreens: false` on the Tab Navigator prevents *all* tab screens (Home, Map, Settings, etc.) from being detached natively. This keeps all native view hierarchies, image caches, and layout contexts for all tabs in memory simultaneously. Combined with a heavy WebGL-based Kakao Map WebView, low-end Android devices (2GB–3GB RAM) are at high risk of Out-of-Memory (OOM) crashes.
2. **Background Geolocation Leak (Critical)**: In the proposed `MapScreen` code (lines 257–286), the location watcher is initialized in a `useEffect` with an empty dependency array. Because the screen is never unmounted under `detachInactiveScreens: false`, the geofencing/location watcher (`Location.watchPositionAsync`) runs continuously in the background even when the user navigates away to another tab. This continuously triggers React Native bridge activity and calls `injectJavaScript` on a blurred WebView, wasting CPU, memory, and battery.

### Suggestions & Mitigations
* **Focus-Aware Location Subscription**: Bind the location subscription to the navigator's focus state (`isFocused`). Suspend geolocation tracking immediately when the map tab is blurred and resume it only on focus.
* **Hoisted WebView Architecture (Option B)**: Re-evaluate Option B. Hoisting the WebView to the root-level layout (`app/(tabs)/_layout.tsx`) allows you to keep `detachInactiveScreens: true` on the Tab Navigator. This frees up native memory for other inactive tabs while keeping only the single persistent WebView in memory.
* **Active Resource Cleanup**: On blur, send a message to the WebView to clear non-essential map resources (such as active traffic layers, cluster animations, or large marker arrays) to free up V8 heap space.

---

## 2. WebGL Context Safety & OS Process Suspension

### Concerns & Findings
1. **Process Suspension Risk**: The Explorer proposes transitioning the WebView container to `width: 1, height: 1, opacity: 0` and `left: -9999` when inactive. In modern versions of iOS WebKit and Android Chromium, shrinking a WebView to `1x1` pixels and hiding it off-screen is recognized as a layout optimization trigger (often associated with tracking pixels). WebKit will aggressively suspend the web process, and Chromium will discard the GPU rendering context.
2. **Blank Canvas / WebGL Loss**: When the user returns to the tab, the WebGL context is often lost (`webglcontextlost` event fires). Because the Explorer's HTML script does not listen to context loss, the canvas will fail to render, displaying a blank or black screen instead of the map.

### Suggestions & Mitigations
* **Maintain Viewport Dimensions**: Keep the WebView container at `width: '100%'` and `height: '100%'` even when off-screen. Position it off-screen using `position: 'absolute', left: -9999, top: -9999` without resizing it to `1x1`.
* **Slight Opacity & Z-Indexing**: If off-screen rendering still triggers suspension, keep the WebView at full size, set `opacity: 0.01`, place it behind a solid background-colored mask using `zIndex: -1`, and set `pointerEvents="none"`.
* **Explicit Relayout on Focus**: When `isFocused` transitions to `true`, inject a JS command to force Kakao Maps to recalculate its viewport size and redraw:
  ```typescript
  webViewRef.current?.injectJavaScript(`if(map && map.relayout){ map.relayout(); }; true;`);
  ```
* **Handle WebGL Events in HTML**: Add JS event listeners inside the WebView HTML to detect context loss and safely reinitialize web resources if needed.

---

## 3. Android Keyboard Adjust Mode Layout Interference

### Concerns & Findings
1. **Background Resize Storms**: On Android, the default window soft input mode is `adjustResize`. When a keyboard is opened on *any* other tab screen (e.g., search bars or forms), the native layout window is resized. Because the WebView remains attached to the window hierarchy (`detachInactiveScreens: false`), it receives the resize layout pass.
2. **CPU/GPU Waste**: Kakao Maps JS SDK listens to window resize events to adjust the map container. When the keyboard opens or closes elsewhere, the background WebView runs heavy JavaScript calculations to pan and redraw the map canvas, leading to visual stutter and typing lag in the active foreground tab.

### Suggestions & Mitigations
* **Disable Pointer and Focus Events**: Add `pointerEvents={isFocused ? 'auto' : 'none'}` to the WebView container to prevent the keyboard focus controller from interacting with it when inactive.
* **Conditional Resize Handling in Web**: Modify the resize listener inside the HTML string to only trigger map relayout when the screen is focused:
  ```javascript
  // Inject focus state from RN
  window.setIsFocused = function(focused) {
    window.isMapFocused = focused;
  };
  window.addEventListener('resize', function() {
    if (window.isMapFocused && map) {
      map.relayout();
    }
  });
  ```
* **Isolate Dimensions**: Hardcode the absolute layout dimensions of the WebView wrapper container during blur (matching screen width/height) rather than letting it dynamically flex or shrink with window resize.

---

## 4. Touch-Action None & Native Gestures Conflict

### Concerns & Findings
1. **Web vs. Native Gestures**: Setting `touch-action: none;` on `#map` inside the WebView correctly disables default browser behaviors (such as elastic scrolling or browser-level zooming). However, because the WebView component spans the entire screen, it intercepts all pointer events.
2. **Gesture Lockout**: If the app navigation includes native swipe-to-go-back gesture zones (on Stack navigators) or edge swipe drawers, the WebView's touch consumption can block them. For instance, swiping from the edge to open a side navigation drawer will fail because the WebView grabs the touch event first.

### Suggestions & Mitigations
* **Native Gesture Handler Wrapping**: Wrap the WebView inside a `NativeViewGestureHandler` from `react-native-gesture-handler` with `disallowInterruption={false}`. This allows parent native navigators (like drawers or edge-swipe controllers) to coordinate and intercept gestures when appropriate.
* **Conditional Pointer Events**: Apply `pointerEvents="none"` on the WebView wrapper when the user begins a native gesture transition (e.g., during navigation transitions) to ensure the native gesture runs smoothly.

---

## 5. Summary of Recommended Code Revisions

### Focus-Aware MapScreen (`app/(tabs)/map.tsx`)
```typescript
export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const isFocused = useIsFocused();
  const [index, setIndex] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSdkFailed, setIsSdkFailed] = useState(false);

  // 1. Focus-Aware Geolocation Watcher (Fixes battery drain and background activity)
  useEffect(() => {
    if (!isFocused) return;

    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startWatchingLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (loc) => {
          if (!active) return;
          const { latitude, longitude } = loc.coords;
          const injectScript = `if(window.updateUserLocation){window.updateUserLocation(${latitude},${longitude});};true;`;
          webViewRef.current?.injectJavaScript(injectScript);
        }
      );
    }

    startWatchingLocation();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [isFocused]);

  // 2. Focus State Synchronization with Web Context
  useEffect(() => {
    const focusStateScript = `if(window.setIsFocused){window.setIsFocused(${isFocused});};true;`;
    webViewRef.current?.injectJavaScript(focusStateScript);
    
    // Force relayout when switching back to Map tab to restore WebGL context
    if (isFocused && isMapReady) {
      webViewRef.current?.injectJavaScript(`if(map && map.relayout){map.relayout();};true;`);
    }
  }, [isFocused, isMapReady]);

  // Active/Inactive Style Transition (Avoids 1x1 width/height compression)
  const webViewContainerStyle = isFocused 
    ? styles.webViewContainerActive 
    : styles.webViewContainerInactive;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.mapArea}>
        <View 
          pointerEvents={isFocused ? 'auto' : 'none'} 
          style={webViewContainerStyle}
        >
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent, baseUrl: 'https://haetae05.github.io' }}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={false}
            style={styles.webView}
            // ...other props
          />
        </View>
        // ...header overlays
      </View>
      {renderCard()}
    </View>
  );
}

const styles = StyleSheet.create({
  // ...
  webViewContainerActive: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webViewContainerInactive: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: '100%',  // Maintain full size to avoid WebGL context discard
    height: '100%', // Maintain full size to avoid WebKit process suspension
    opacity: 0.01,  // Keep opacity above 0 to prevent process suspension
  },
});
```
