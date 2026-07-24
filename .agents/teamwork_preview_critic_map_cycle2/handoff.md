# Handoff Report — Critique of WebView Event Bridge Design

## 1. Observation
- File reviewed: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle2\analysis.md`
- Code segment 1 (Base URL & WebView Source):
  ```typescript
  source={{ html: htmlContent, baseUrl: 'https://haetae05.github.io' }}
  ```
- Code segment 2 (Message Polling & Buffer):
  ```javascript
  var bridgePoller = setInterval(function() {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      clearInterval(bridgePoller);
      while (messageQueue.length > 0) {
        window.ReactNativeWebView.postMessage(messageQueue.shift());
      }
    }
  }, 50);
  ```
- Code segment 3 (Geolocation Sync):
  ```typescript
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000, // Update every 10 seconds
      distanceInterval: 10, // Or every 10 meters
    },
    ...
  );
  ```
- Code segment 4 (Manual Escaping & Script Injection):
  ```typescript
  const injectScript = `if (window.updateSpots) { window.updateSpots('${spotsJson.replace(/'/g, "\\'")}'); }; true;`;
  ```

## 2. Logic Chain
- **Base URL Spoofing**: Since the WebView utilizes a spoofed HTTPS baseUrl (`https://haetae05.github.io`), the origin is treated as secure. This causes Android WebView to block access to local assets (e.g. `file://` protocols) under mixed content restrictions. Additionally, older Android WebView versions do not reliably attach the `Origin` header to outgoing HTTP requests initiated within dynamic scripts loaded via `loadDataWithBaseURL()`.
- **PostMessage buffering queue order race**: Under the current poller design, a message `sendToRN` can be invoked after the bridge becomes available but before the poller fires. In this scenario, the immediate postMessage executes before the queued messages are flushed by the 50ms interval poller, resulting in out-of-order execution in the React Native state handler.
- **Battery Drain & Navigation Lifecycle**: React Native Navigation keeps screens mounted when hidden. The `useEffect` cleanup for `Location.watchPositionAsync` will not run when navigating away from the Map tab. Thus, GPS tracking continues infinitely in the background, consuming battery.
- **Dynamic Script Injection Vulnerability**: Substituting `spotsJson` via manual regex replace `.replace(/'/g, "\\'")` does not escape backslashes (`\`) or special formatting characters, leading to JavaScript execution crashes or script injection (XSS) if the mock or API data contains complex characters.

## 3. Caveats
- Android physical device behavior on ancient Android versions (below API level 24) was not verified.
- The external Kakao Maps CDN endpoints (`dapi.kakao.com`) could not be dynamically hit due to the network restriction.

## 4. Conclusion
The proposed design is functionally thorough but introduces critical flaws regarding WebView message order safety, background battery consumption, Android security/CORS blocks, and dynamic string injection vulnerabilities. Changes must be requested to correct the message queue structure, navigation focus handling, and script injection methodology.

## 5. Verification Method
- Inspect the critique report located at: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_critic_map_cycle2\critique.md`
- Verify the proposed fixes in mock setups or by updating `app/(tabs)/map.tsx` and testing on iOS/Android emulators.
