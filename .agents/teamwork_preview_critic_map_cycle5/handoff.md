# Handoff Report — Cycle 5 Map Review

## 1. Observation
I directly observed the proposed files under `.agents/teamwork_preview_explorer_map_cycle5/` and noticed the following:

- **SWR Cache Subscription & Revalidation Lock** in `proposed_local_places.ts`:
  - Lines 17–22:
    ```typescript
    export const subscribeToPlacesCache = (listener: CacheUpdateListener): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    };
    ```
  - Lines 70–77:
    ```typescript
    export const getPlaces = async (): Promise<Place[]> => {
      // 1. 백그라운드 갱신 트리거 (동시 다발적 요청 방지 Lock)
      if (!isRevalidating) {
        isRevalidating = true;
        revalidateData().finally(() => {
          isRevalidating = false;
        });
      }
    ```

- **Marker Diffing & Script Injection** in `proposed_map.tsx`:
  - Line 415:
    ```typescript
    const injectScript = `if(window.updateSpots){window.updateSpots('${spotsJson.replace(/'/g, "\\'")}');};true;`;
    ```
  - Lines 238–272:
    ```javascript
    window.updateSpots = function(spotsJson) {
      if (!map) return;
      var spots = JSON.parse(spotsJson);
      ...
      for (var id in markers) {
        markers[id].setMap(null);
      }
      markers = newMarkers;
    };
    ```

- **WebGL context loss listener** in `proposed_map.tsx`:
  - Lines 143–146:
    ```javascript
    window.addEventListener('webglcontextlost', function(e) {
      sendToRN('WEBGL_CONTEXT_LOST', {});
      e.preventDefault();
    }, false);
    ```
  - Lines 457–460:
    ```typescript
    case 'WEBGL_CONTEXT_LOST':
      console.warn('[WebView] WebGL/Canvas context lost. Requesting map relayout.');
      webViewRef.current?.injectJavaScript(`if(map && map.relayout){map.relayout();};true;`);
      break;
    ```

- **Walk-time NaN Guarding** in `proposed_map.tsx`:
  - Lines 288–291:
    ```typescript
    function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
      if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        return NaN;
      }
    ```

---

## 2. Logic Chain
Based on these observations:
1. **SWR Subscription & Revalidation**:
   - The returned function `() => listeners.delete(listener)` from `subscribeToPlacesCache` successfully removes the callback reference from the global `Set` during unmount.
   - However, a developer warning is missing if multiple listeners are registered during render (leading to leak).
   - `getPlaces()` has no rate-limiting, so frequent caller-side invocation will flood the CDN with network fetches, since only active concurrent requests are locked.
2. **Marker Diffing & Script Injection**:
   - In `window.updateSpots`, the `for...in` loop on `markers` lacks `hasOwnProperty` guards, risking prototype pollution crashes.
   - Removing markers with `setMap(null)` without calling `kakao.maps.event.clearInstanceListeners` leaks the closure event listener callbacks in memory.
   - In `injectScript`, replacing only `'` with `\'` on the JSON string will fail if the JSON has double quotes (`\"`). In JS execution, `\"` within `'...'` evaluates to `"`, making the passed string invalid JSON (`{"name": "Sea "Blue""}`), causing `JSON.parse` to crash.
3. **WebGL context loss**:
   - `webglcontextlost` is canvas-scoped and does not bubble. A listener on `window` will never trigger.
   - Kakao Maps SDK does not use WebGL context, so no WebGL event exists.
   - Process crashes must be caught using the `onContentProcessDidTerminate` WebView prop on the React Native side.
4. **Walk-time NaN Guarding**:
   - In JS, `isNaN(null)` is `false`. If coordinates are `null`, the function calculates a valid distance to Null Island `(0, 0)`, returning an absurd walk time in the UI (e.g., `"도보 199385분"`).

---

## 3. Caveats
- I did not test this code in a live emulator environment because no emulator/device is running.
- I assumed standard behavior of Kakao Maps JS SDK v2 regarding graphics contexts and event listeners.

---

## 4. Conclusion
The proposed files from Cycle 5 are not ready for merging and require changes (`REQUEST_CHANGES` verdict). Specifically:
1. Double-escape backslashes in JSON script injections to prevent SyntaxErrors.
2. Fix `getHaversineDistance` to reject `null` values using explicit type/null checks.
3. Remove the dead `webglcontextlost` event listener and add `onContentProcessDidTerminate` on the RN WebView.
4. Add `hasOwnProperty` and `clearInstanceListeners` in `window.updateSpots`.
5. Add throttling to SWR `getPlaces()` network revalidations.

---

## 5. Verification Method
To verify these conclusions:
1. Run a JS environment (e.g. node) and execute `isNaN(null)`. It evaluates to `false`.
2. Evaluate `'{"name": "Sea \"Blue\""}'.replace(/'/g, "\\'")` inside a JS engine. The result is `"{"name": "Sea "Blue""}"`. Try running `JSON.parse` on it; it will fail with `SyntaxError: Unexpected identifier`.
3. Try calling `window.addEventListener('webglcontextlost', ...)` on a canvas element and trigger context loss. Confirm the listener on `window` does not capture the event.
