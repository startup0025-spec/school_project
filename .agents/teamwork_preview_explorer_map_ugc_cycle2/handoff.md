# Handoff Report — Cycle 2 Map & UGC Pivot Explorer

This handoff report summarizes the findings of the Lead Explorer for Cycle 2 of the Kakao Map & UGC Pivot implementation plan.

## 1. Observation
We examined `mobile/app/(tabs)/map.tsx`, `mobile/core_engine/src/database/local_places.ts`, `mobile/core_engine/src/models/place_model.ts`, and `mobile/context/RippleContext.tsx` and observed the following:

- **Appkey Injection (map.tsx:478-479)**:
  ```typescript
  const apiKey = process.env.EXPO_PUBLIC_KAKAO_MAP_API_KEY || 'MOCK_KEY';
  const htmlContent = KAKAO_MAP_HTML.replace('YOUR_JS_API_KEY', apiKey);
  ```
- **Base URL Setting (map.tsx:509)**:
  ```typescript
  source={{ html: htmlContent, baseUrl: 'https://haetae05.github.io' }}
  ```
- **WebView Inactive Styling (map.tsx:582-589)**:
  ```typescript
  webViewContainerInactive: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: '100%',  // Maintain full size to avoid WebGL context discard
    height: '100%', // Maintain full size to avoid WebKit process suspension
    opacity: 0.01,  // Keep opacity above 0 to prevent process suspension
  },
  ```
- **Current postMessage Handler (map.tsx:443-476)**: Handles `MAP_READY`, `SPOT_SELECTED`, `SDK_LOAD_FAILED`, `WEB_ERROR`, `CONSOLE_LOG`, and `MAP_CLICKED`.
- **Local Places Storage (local_places.ts:59-79)**: `getPlaces()` reads cache key `@anywayTheSea:places_cache` from `AsyncStorage` and falls back to a bundled JSON file. No custom place insertion is supported currently.

## 2. Logic Chain
1. **Script Loading and Domains**: Because the Kakao Map Javascript SDK checks the origin domain of requests and fails if the domain is not registered, setting `baseUrl: 'https://haetae05.github.io'` forces the WebView to pretend all calls originate from that domain. Therefore, whitelisting `https://haetae05.github.io` in the Kakao Developer Console under Web Site Domains is mandatory to avoid 401 errors.
2. **postMessage Bridge & UGC**: 
   - To support **creating diary entries for map locations**, we can either pass a new event `CREATE_DIARY_ENTRY` from WebView to React Native or let the native side trigger `addDiaryEntry` directly on the active place when the user clicks a native button.
   - To support **arbitrary point creation (custom spots)**, we can bind touch listeners in the WebView to compute coordinate transforms under long-presses, send a `MAP_LONG_CLICKED` postMessage event with the latitude/longitude, and prompt the user.
   - To persist custom places, we must extend `local_places.ts` to merge static CDN/bundle places with a separate AsyncStorage key (e.g. `@anywayTheSea:custom_places`). Since `map.tsx` dynamically subscribes to place cache updates, saving the new place and notifying listeners will automatically push the new coordinates to the WebView using `updateSpots()`, drawing the UGC marker dynamically.
3. **WebView Keep-Alive evaluation**:
   - The inactive style preserves the WebGL context and prevents WebKit thread suspension by keeping dimensions at `100%` and opacity at `0.01`.
   - However, keeping the WebView active in the background retains a high memory foot-print (OOM risks on low-end devices) and causes background CPU/battery drain since event handlers and rendering loops are not frozen.

## 3. Caveats
- Since this is a read-only investigation, the proposed changes are architectural recommendations and have not been committed to the codebase.
- The behavior of iOS WebKit and Android Chrome WebView can vary under memory pressure. If the device experiences severe GPU memory shortage, the WebGL context might still be discarded despite the keep-alive styles.

## 4. Conclusion
The Kakao Map script loading, whitelisting, and keep-alive off-screen positioning strategies are functionally correct, but introducing UGC features requires extending the postMessage bridge (events `MAP_LONG_CLICKED` and/or `CREATE_DIARY_ENTRY`), expanding `local_places.ts` to merge local AsyncStorage places, and optimizing background rendering of the off-screen WebView to prevent battery/memory degradation.

## 5. Verification Method
1. **Verification of current logic**: Open `mobile/app/(tabs)/map.tsx` and confirm the `baseUrl` configuration and `webViewContainerInactive` style properties matching the quoted lines.
2. **Independent verification of domain restriction**: Create a test WebView using `html` source without a `baseUrl` or with an unregistered `baseUrl` and verify Kakao Maps SDK fails to render (generating a domain authorization error in Web Console logs).
3. **Trace path**: Confirm `analysis.md` is present in the working directory `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_ugc_cycle2\analysis.md`.
