# Handoff Report — Cycle 2: Bidirectional Communication & Event Bridge Design

This report summarizes the observations, design logic, conclusions, and verification methods for the Kakao Maps WebView event bridge in *Anyway, the Sea*.

---

## 1. Observation
- **Current Map Component (`app/(tabs)/map.tsx`)**:
  - Implements static illustration-based mapping via `Image` and relative coordinate calculations:
    ```typescript
    source={require('@/assets/images/quiet-map.png')}
    ...
    style={[
      styles.pinWrap,
      { left: `${spot.pin.x * 100}%` as const, top: `${spot.pin.y * 100}%` as const },
    ]}
    ```
- **Typecheck Status**:
  - Running `cmd /c "npm run typecheck"` results in the following 6 TypeScript compilation errors (unrelated to map logic):
    ```
    lib/services/audio_caching_service.ts(5,40): error TS2339: Property 'documentDirectory' does not exist on type 'typeof import("...")'.
    lib/services/audio_caching_service.ts(12,59): error TS2694: Namespace '"..."' has no exported member 'DownloadResumable'.
    lib/services/audio_caching_service.ts(115,5): error TS2322: Type 'number' is not assignable to type 'Timeout'.
    lib/services/audio_caching_service.ts(281,22): error TS7006: Parameter 'downloadResult' implicitly has an 'any' type.
    lib/services/audio_caching_service.ts(290,23): error TS7006: Parameter 'err' implicitly has an 'any' type.
    lib/services/audio_engine_service.ts(104,9): error TS2322: Type 'number' is not assignable to type 'Timeout'.
    ```
- **Critic Suggestions (Cycle 1)**:
  - Add native geolocation proxying rather than using WebView-side Geolocation API.
  - Implement log and error routing (global `onerror`, unhandled promise rejection, `console.log` proxying).
  - Use `onerror` hooks on the SDK script tag to detect load failures.
  - Formulate a robust postMessage message protocol.

---

## 2. Logic Chain
1. **Offline and API Authorization Concerns (Option C vs Option A)**:
   - *Observation*: If we use a CDN (Option A), the WebView fails to load the HTML shell itself when offline, showing a blank white/error screen.
   - *Reasoning*: Loading a local inline HTML string with the `baseUrl` prop spoofed to `https://haetae05.github.io` allows the HTML to bootstrap instantly, offline or online. Origin check is still authorized by Kakao Developers Console.
2. **Error and Console Visibility**:
   - *Observation*: WebViews swallow exceptions and logs.
   - *Reasoning*: Overriding `window.onerror`, mapping `unhandledrejection`, and wrapping `console.log/info/warn/error` to forward messages via `postMessage` allows Metro console to print diagnostics immediately.
3. **Queueing to Prevent Loss of Early Messages**:
   - *Observation*: If `console` commands run before the `window.ReactNativeWebView` bridge is fully loaded, messages are lost.
   - *Reasoning*: A message buffer queue (`messageQueue`) stores logs/events and flushes them once the bridge poller detects that the native bridge is active.
4. **Geolocation Permission Safety**:
   - *Observation*: Requesting location directly inside Android WebView is prone to native runtime permission exceptions.
   - *Reasoning*: Using Expo's native `Location.watchPositionAsync` in React Native and injecting coordinates via `window.updateUserLocation()` completely bypasses in-WebView permission issues.

---

## 3. Caveats
- **Mock Coordinates**: The coordinates used in the `map.tsx` template are simple linear projections (`spot.pin.x * 0.05 + 35.17`) to match Busan's general range. Actual integration requires replacing mock coordinates with real latitude and longitude numbers stored in `local_places.ts` or `mockData.ts`.
- **API Key Configuration**: The Kakao JS Key must be supplied in Expo config secrets (`process.env.EXPO_PUBLIC_KAKAO_MAP_API_KEY`) and substituted dynamically at runtime inside the HTML template string.

---

## 4. Conclusion
The proposed design in `analysis.md` provides a complete, robust, and diagnostic-friendly Event Bridge for Kakao Maps WebView. It includes:
1. **Structured Event Bridge Schema** for 6 Web-to-Native events and 4 Native-to-Web commands.
2. **Offline Bootstrap Resilience** via local inline HTML loading.
3. **8-Second Watchdog and script `onerror` hook** to gracefully switch to `quiet-map.png` fallback if script loading fails.
4. **Diagnostic Mirroring** that tunnels console output and runtime exceptions directly to the Metro bundler.
5. **Native Location Proxying** to avoid in-WebView permission bugs.

---

## 5. Verification Method
- **File Inspection**:
  - Review `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle2\analysis.md` to inspect the full event bridge schema, HTML templates, and the complete React Native `map.tsx` implementation template.
- **Verification Commands**:
  - Run typecheck check: `cmd /c "npm run typecheck"` in `mobile` directory.
  - Note: The current project has 6 unrelated compilation errors in audio services. A successful integration of the design in `map.tsx` must not introduce any new TypeScript compilation errors.
