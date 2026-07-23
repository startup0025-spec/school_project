# Handoff Report: Cycle 3 Map Keep-Alive & Performance Optimization Strategy Critique

## 1. Observation
We reviewed the Explorer's analysis and code design document located at `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle3\analysis.md`. The following code patterns and layouts were identified:
- **Global `detachInactiveScreens` configuration** (line 89):
  ```typescript
  detachInactiveScreens: false, // PREVENTS WebView unmount/native detachment on Android/iOS
  ```
- **Inactive container styling with 1x1 compression** (lines 455–462):
  ```typescript
  webViewContainerInactive: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    opacity: 0,
  },
  ```
- **Unconditional Geolocation watch active** (lines 257–286):
  ```typescript
  useEffect(() => {
    let active = true;
    async function startWatchingLocation() {
      // ...
      const subscription = await Location.watchPositionAsync(
        { ... },
        (loc) => {
          if (!active) return;
          // ...
          webViewRef.current?.injectJavaScript(injectScript);
        }
      );
      if (active) setLocationSubscription(subscription);
      else subscription.remove();
    }
    startWatchingLocation();
    return () => {
      active = false;
      locationSubscription?.remove();
    };
  }, []);
  ```
- **Viewport and CSS Touch configurations**: Meta tag `user-scalable=no` (line 127) and CSS `#map { touch-action: none; }` (line 142).

---

## 2. Logic Chain
- **Step 1**: Disabling screen detachment globally (`detachInactiveScreens: false` at line 89) retains all screen components in the native memory stack. When combined with a heavy map engine (Kakao Maps JS SDK running in a WebView process), this increases memory overhead and introduces OOM risks on memory-constrained Android devices.
- **Step 2**: The geolocation hook (lines 257–286) starts a background watcher. Because the screen is never unmounted under `detachInactiveScreens: false`, the cleanup function (`return () => { ... }`) is never triggered. The location watcher continues to run background location checks and injects script changes to a blurred WebView, causing background battery drain and CPU cycles.
- **Step 3**: Shrinking the WebView size to `1x1` pixels and setting opacity to `0` (lines 455–462) tells WebKit (iOS) and Chromium (Android) compositing engines that the element is inactive or hidden. This triggers aggressive power-saving suspensions, resulting in WebGL context loss and a blank map canvas when returning to the tab.
- **Step 4**: Under Android's `adjustResize` mode, keyboard events in other screens trigger layout passes. An active but off-screen WebView receives resize passes and triggers window resize listeners within the web context, leading to background map re-centering and CPU utilization.
- **Step 5**: While CSS `touch-action: none` disables browser scroll defaults, it does not bypass the WebView's native parent view interception. Active full-screen gesture listeners inside the WebView will block custom React Native drawer menu gesture handlers unless proper gesture interception exclusion is configured on the native layer.

---

## 3. Caveats
- Actual WebGL suspension behavior is vendor-specific; some low-end Android builds do not recover the context automatically even if dimensions are maintained, requiring forced redraw calls.
- Geolocation background behavior is subject to platform-specific system permissions and OS background execution constraints.

---

## 4. Conclusion
The proposed Keep-Alive strategy requires adjustments before implementation. We issue a **REQUEST_CHANGES** verdict. Implementing focus-aware subscriptions, keeping the off-screen WebView layout dimensions at full screen (`width: '100%', height: '100%', opacity: 0.01`), sending focus state synchronization events, and using `pointerEvents="none"` on blur are mandatory modifications to ensure stability and battery efficiency.

---

## 5. Verification Method
1. Inspect the critique report generated at `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_critic_map_cycle3\critique.md`.
2. Inspect the agent notes file `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\agent_notes\20260716_0930_TEAMWORK_MAP_CRITIC_CYCLE3.md`.
3. Verify that all 4 questions in the original request have been detailed and resolved in the critique.
