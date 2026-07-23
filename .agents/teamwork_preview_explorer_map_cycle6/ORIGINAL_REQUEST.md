## 2026-07-16T00:25:15Z
You are teamwork_preview_explorer. Your working directory is C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle6\.
Your task is to correct and finalize the Kakao Map API Integration code files based on the Cycle 5 Critic's feedback.

Your objective for Cycle 6:
1. Address the following code corrections in `map.tsx`, `local_places.ts`, and `mockData.ts`:
   - **`local_places.ts` (Revalidation Rate Limit)**: Introduce a timestamp-based rate limit (`FRESHNESS_THRESHOLD = 30000` ms) in `getPlaces()` to prevent redundant CDN fetches when switching tabs or layout changes occur sequentially. Add a developer warning guard if cache listener size exceeds 15 to prevent memory leaks.
   - **`map.tsx` (Direct Object Script Injection)**: Instead of passing a stringified JSON wrapped in single quotes, change the WebView interface function `window.updateSpots` to accept a parsed JavaScript array directly:
     ```javascript
     window.updateSpots = function(spots) {
       // 'spots' is a direct JavaScript array, no JSON.parse needed!
       ...
     };
     ```
     On the React Native side, inject it directly:
     ```typescript
     const spotsData = places.map((s) => ({
       id: s.id,
       name: s.name,
       latitude: s.latitude,
       longitude: s.longitude,
     }));
     const injectScript = `if(window.updateSpots){window.updateSpots(${JSON.stringify(spotsData)});};true;`;
     ```
     This completely eliminates single/double quote nesting syntax errors!
   - **`map.tsx` (Marker Cleanup & Prototype Protection)**: In the WebView HTML, call `kakao.maps.event.clearInstanceListeners(markers[id])` before calling `markers[id].setMap(null)` to prevent memory leaks. Wrap the `for (var id in markers)` cleanup loops with `hasOwnProperty` checks to avoid prototype pollution crashes.
   - **`map.tsx` (Process Crash Recovery)**: Remove the ineffective WebGL context loss listener code (since Kakao Maps uses 2D canvas/SVG rendering). Add the `onContentProcessDidTerminate` callback on the React Native `<WebView>` component to reload the map if the OS terminates the WebContent process.
   - **`map.tsx` (Double NaN and Bounds Guarding)**: Fix `getHaversineDistance` to check coordinates explicitly against null, undefined, or non-number types. In `getWalkTime`, return `'도보 2시간 이상'` (or the fallback `place.walk`) if walking minutes exceed 120 to provide a clean UX for distant locations.
2. Output the corrected copy-pasteable files and verify their compilation correctness.
3. Save the finalized files to C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle6\.
Report back with send_message once done.
