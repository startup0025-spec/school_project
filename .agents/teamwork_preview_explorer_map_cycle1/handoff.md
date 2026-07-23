# Handoff Report — Cycle 1: Baseline Architecture & WebView Integration Strategy

## 1. Observation
We observed the following files and structural states in the workspace:
* **Empty views file**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\lib\views\home_screen.tsx` contains only:
  ```typescript
  // TODO: Initialize
  ```
* **Map Screen**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\map.tsx` contains static layout mapping:
  ```typescript
  36:         <Image
  37:           source={require('@/assets/images/quiet-map.png')}
  38:           style={StyleSheet.absoluteFillObject}
  39:           resizeMode="cover"
  40:         />
  ...
  45:             { left: `${spot.pin.x * 100}%` as const, top: `${spot.pin.y * 100}%` as const },
  ```
* **Database & Fallback Data**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\core_engine\src\database\local_places.ts` fetches and caches places from a CDN JSON file, failing back to a bundled file:
  ```typescript
  5: const CDN_URL = 'https://haetae05.github.io/Anyway_the_Sea/data/busan_places_master.json';
  ...
  66:     const bundledData = require('../../../assets/data/busan_places_master.json');
  ```
  However, `mobile/assets/data/busan_places_master.json` contains no real places:
  ```json
  {
    "generatedAt": "2026-07-15T00:00:00Z",
    "totalCount": 0,
    "places": []
  }
  ```
* **Mock Data**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\constants\mockData.ts` contains `QUIET_SPOTS` with pixel-ratio pins:
  ```typescript
  50: export const QUIET_SPOTS: QuietSpot[] = [
  51:   {
  52:     id: 's1',
  53:     name: '수성천 산책로',
  54:     note: '여기 지금 사람 아무도 없대요. 혹시 근처면 그냥 한 번 가보든가요.',
  55:     walk: '도보 12분',
  56:     pin: { x: 0.52, y: 0.4 },
  ...
  ```
* **Package Dependencies**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\package.json` does not include `react-native-webview`.

---

## 2. Logic Chain
1. Since the current `map.tsx` relies on a static illustration map (`quiet-map.png`) and relative percentage pins (from `pin: { x, y }` in `mockData.ts`), it cannot render dynamic GPS coordinate listings retrieved via `getPlaces()` in the local database.
2. To render real-world coordinate pins dynamically and support accurate locations in Busan, we must transition to a live map SDK.
3. Because Kakao Maps does not offer an official React Native SDK, community native wrappers are unstable and break compatibility with the Expo Go managed workflow.
4. Embedded JavaScript SDK via `react-native-webview` is the standard approach in Expo, offering high performance, cross-platform compatibility, and the ability to customize style filters.
5. In order for the Kakao SDK to authorize successfully, the WebView origin must match a registered Web platform domain in the Kakao Developer Console. Hosting the HTML wrapper on a CDN (like GitHub Pages) resolves OS-specific local origin conflicts (`file://`).
6. To avoid re-rendering the WebView on every React state update (which consumes the daily API quota of 300,000 requests), we must use `React.memo` and communicate via a `postMessage`/`injectJavaScript` bridge.

---

## 3. Caveats
* **Offline Map Fallback**: Since the Kakao JS SDK downloads map tiles dynamically over the web, the map screen will show blank tiles if there is no internet connection. The app must handle this offline state gracefully using the axios-cache-interceptor fallback logic or a static offline UI overlay.
* **API Keys**: Kakao Developers JavaScript key must be kept in `core_engine/src/config/api_keys.ts` or similar config files, decoded dynamically, and injected into the HTML rather than hardcoded in the public CDN page, if possible, to prevent unauthorized usage.

---

## 4. Conclusion
We propose integrating the Kakao Map API in React Native Expo using `react-native-webview` loaded with a CDN-hosted HTML template. Visual clutter can be suppressed to maintain a "Calm UX" using CSS filters (grayscale/dark mode) on the map container. A bidirectional postMessage bridge will coordinate marker updates and selections without triggering WebView reloads, preserving performance and API quotas.

---

## 5. Verification Method
1. **Dependency Verification**: Run `npm install` inside `mobile/` after adding `react-native-webview` to confirm clean compilation.
2. **Local Test Script**: Run `npm run dev` and open the map tab. Check the WebView console output using Chrome DevTools or Safari Web Inspector to verify successful load of Kakao Maps JS SDK.
3. **Mock Data Invalidation**: If coordinates do not display, confirm that the registered Web Platform Domain in the Kakao console matches the loaded HTML origin (e.g., `https://haetae05.github.io` or `http://localhost:8081`).

---

## 6. Remaining Work
1. Add `"react-native-webview": "^13.13.1"` (or appropriate Expo SDK 54 version) to `mobile/package.json` dependencies.
2. Create and deploy the `map.html` page to the GitHub Pages CDN repository: `https://haetae05.github.io/Anyway_the_Sea/map.html`.
3. Set up the Kakao Developers Console Web platform domains: add the GitHub Pages URL and `http://localhost:8081`.
4. Refactor `mobile/app/(tabs)/map.tsx` to render the `<WebView>` and wire up message handling.
5. Add real `latitude`/`longitude` fields to the place model items.
6. Populate `local_places.ts` and `home_screen.tsx` with baseline coordinate structures.
