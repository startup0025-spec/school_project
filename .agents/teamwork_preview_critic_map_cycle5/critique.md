# Critique Report — Cycle 5 Proposed Map Design

**Verdict**: REQUEST_CHANGES

This review assesses the quality, correctness, and safety of the proposed Map implementation files (`proposed_map.tsx`, `proposed_local_places.ts`, and `proposed_mockData.ts`) generated in Cycle 5.

---

## 1. SWR Cache Reactive Subscription

### [Medium Finding] Lack of Revalidation Throttling / Rate-Limiting
- **Location**: `proposed_local_places.ts` (lines 70–77)
- **Problem**: 
  The function `getPlaces()` triggers `revalidateData()` on every call if `!isRevalidating`. 
  While `isRevalidating` acts as a concurrent lock (preventing simultaneous network requests), it does not enforce a minimum cache freshness duration. If `getPlaces()` is called sequentially (e.g., when the user switches tabs, triggers location updates, or causes component remounts), a fresh network request is fired every single time. This can cause redundant network traffic, draining cellular data and potentially getting rate-limited by the GitHub Pages CDN.
- **Suggestion**: 
  Introduce a timestamp-based rate limit to ensure network revalidation only runs if a minimum period (e.g., 30 seconds) has elapsed since the last request:
  ```typescript
  let lastFetchTime = 0;
  const FRESHNESS_THRESHOLD = 30000; // 30 seconds

  export const getPlaces = async (): Promise<Place[]> => {
    const now = Date.now();
    if (!isRevalidating && now - lastFetchTime > FRESHNESS_THRESHOLD) {
      isRevalidating = true;
      revalidateData()
        .then(() => { lastFetchTime = Date.now(); })
        .finally(() => { isRevalidating = false; });
    }
    // ... Stale/Fallback logic
  };
  ```

### [Minor Finding] Developer Safety Guard in Subscription
- **Location**: `proposed_local_places.ts` (lines 17–22)
- **Problem**: 
  If a developer mistakenly calls `subscribeToPlacesCache` directly within the render body of a component (instead of wrapping it in `useEffect`), a new listener is added to the global `Set` on every render. Because the cleanup function goes uncalled, the listener list grows infinitely, leading to memory leaks and severe performance degradation.
- **Suggestion**: 
  Add a warning guard if `listeners.size` exceeds a sanity threshold:
  ```typescript
  export const subscribeToPlacesCache = (listener: CacheUpdateListener): (() => void) => {
    if (listeners.size > 15) {
      console.warn('[local_places] Warning: High number of active cache listeners detected. Possible memory leak.');
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  ```

---

## 2. Marker Diffing

### [Critical Finding] JSON String Injection Syntax Error Bug (Double Quotes)
- **Location**: `proposed_map.tsx` (line 415)
- **Problem**: 
  The marker synchronization logic injects data as follows:
  ```typescript
  const injectScript = `if(window.updateSpots){window.updateSpots('${spotsJson.replace(/'/g, "\\'")}');};true;`;
  ```
  If any spot name or description contains double quotes (`"`), `JSON.stringify` produces `\"` inside the JSON string.
  When evaluating this string literal in the WebView's JS engine wrapped in single quotes (`'...'`), the JS compiler interprets the single backslash in `\"` as an escape character, outputting a raw double quote (`"`). 
  As a result, the parsed string argument passed to `window.updateSpots` contains unescaped double quotes (e.g. `{"name":"Sea "Blue""}`), which causes `JSON.parse` to crash with a `SyntaxError: Unexpected identifier`.
- **Suggestion**: 
  Double-escape the backslashes in the JSON string *before* escaping the single quotes to ensure the JS compiler receives proper escape sequences:
  ```typescript
  const escapedSpotsJson = spotsJson
    .replace(/\\/g, '\\\\') // 1. Double escape backslashes
    .replace(/'/g, "\\'");  // 2. Escape single quotes
  const injectScript = `if(window.updateSpots){window.updateSpots('${escapedSpotsJson}');};true;`;
  ```

### [Minor Finding] Missing Event Listener Cleanup (Memory Leak)
- **Location**: `proposed_map.tsx` (lines 267–270)
- **Problem**: 
  When a spot marker is removed from the map via `markers[id].setMap(null)`, the click event listener registered via `kakao.maps.event.addListener` is not explicitly unbound. If the Kakao Maps SDK internally caches listener bindings or marker instances, this omission prevents garbage collection.
- **Suggestion**: 
  Call `kakao.maps.event.clearInstanceListeners(marker)` prior to setting it to `null`:
  ```javascript
  // Clear removed markers
  for (var id in markers) {
    if (Object.prototype.hasOwnProperty.call(markers, id)) {
      kakao.maps.event.clearInstanceListeners(markers[id]);
      markers[id].setMap(null);
    }
  }
  ```

### [Minor Finding] Prototype Pollution Vulnerability in `for...in` Loop
- **Location**: `proposed_map.tsx` (lines 268–270)
- **Problem**: 
  The marker clean-up loop uses `for (var id in markers)`. In JS, this iterates over prototype chains. If any polyfill or package extends `Object.prototype`, the loop will attempt to invoke `.setMap(null)` on non-marker methods, causing a crash.
- **Suggestion**: 
  Guard with `hasOwnProperty`:
  ```javascript
  for (var id in markers) {
    if (Object.prototype.hasOwnProperty.call(markers, id)) {
      markers[id].setMap(null);
    }
  }
  ```

---

## 3. WebGL Context Restoration

### [Major Finding] Ineffective Context Loss Listener & Missing WKWebView Crash Recovery
- **Location**: `proposed_map.tsx` (lines 143–146, 457–460)
- **Problem**:
  1. **Event Scope**: The `webglcontextlost` event is a canvas-level event that does **not** bubble. Binding it to the `window` object (`window.addEventListener('webglcontextlost', ...)`) is ineffective; it will never be called.
  2. **SDK Architecture**: Kakao Maps JS SDK v2 uses HTML5 `<canvas>` (2D context) and SVG/DOM elements. It **does not use WebGL**, meaning no WebGL context is ever initialized or lost.
  3. **Insufficient Recovery**: Calling `map.relayout()` does not restore a lost graphics context or recover a crashed process. Under memory pressure, iOS and Android WebViews will suspend or terminate the WebContent process (causing a white screen). `relayout()` cannot recover from this.
- **Suggestion**:
  - Remove the dead code related to `webglcontextlost` in the HTML string and on the RN message handler.
  - To recover from WebContent process terminations (low memory crashes), register the `onContentProcessDidTerminate` callback on the React Native `WebView` component to reload it:
    ```typescript
    onContentProcessDidTerminate={() => {
      console.warn('[MapScreen] WebView content process terminated. Reloading...');
      webViewRef.current?.reload();
    }}
    ```

---

## 4. Double NaN Guarding

### [Major Finding] `isNaN(null)` Type Coercion Bypass
- **Location**: `proposed_map.tsx` (lines 289–291)
- **Problem**: 
  The helper function `getHaversineDistance` uses `isNaN(val)` to validate coordinates. However, in JavaScript, `isNaN(null)` is `false` because `null` is coerced to `0`. 
  If `place.latitude` or `place.longitude` is `null` (e.g. from API database corruption), `isNaN` will pass, and the helper will compute a distance to the equator coordinates `(0, 0)` (Null Island). This results in a distance of ~9.6 million meters.
  `getWalkTime` rounds the division of this distance, returning a valid, non-negative number like `"도보 199385분"`.
- **Suggestion**: 
  Check explicitly for `null`/`undefined` and type-check inputs to prevent coercion:
  ```typescript
  function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (
      lat1 === null || lon1 === null || lat2 === null || lon2 === null ||
      typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
      typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
      isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
    ) {
      return NaN;
    }
    // ...
  }
  ```

### [Medium Finding] Walk Time Cap (UX range limit)
- **Location**: `proposed_map.tsx` (lines 304–323)
- **Problem**: 
  If the user is far away from the selected location (e.g. they are in Seoul, ~320 km away from Busan), `getWalkTime` computes a walking time of thousands of minutes, yielding `"도보 6646분"` on the UI. This is bad UX.
- **Suggestion**: 
  Introduce a threshold (e.g., 2 hours / 10 km) beyond which it displays a capped label or falls back to the static walk description:
  ```typescript
  if (minutes > 120) {
    return '도보 2시간 이상'; // Or return place.walk if available
  }
  ```
