# Kakao Map & UGC Pivot - Technical Analysis Report
**Cycle 2: Web-Native Bridge, Script Loading, and Keep-Alive Verification**

## Executive Summary
This report analyzes the Kakao Map Web SDK integration in `mobile/app/(tabs)/map.tsx`, focusing on security, event bridging, and performance optimization. We address:
1. **Kakao Map SDK Loading & Domain Security**: Clarifying how `appkey` and `baseUrl` are applied, and explaining Kakao developer console whitelisting requirements.
2. **postMessage Bridge Extension**: Proposing a protocol extension for UGC to enable diary logging at specific map places and coordinates-based user spot generation (saved locally in `AsyncStorage`).
3. **WebView Keep-Alive Review**: Evaluating the off-screen rendering strategy (`-9999` offset, `0.01` opacity) and documenting memory, CPU, and rendering risks.

---

## 1. Kakao Map Web SDK Script Loading & Domain Whitelisting

### 1.1 Script Loading and Appkey Insertion
Inside the `KAKAO_MAP_HTML` template (lines 140–143 of `map.tsx`), the Kakao Maps Javascript SDK script tag is declared with a placeholder:
```html
<script 
  src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_JS_API_KEY&autoload=false" 
  onerror="handleScriptError()"
></script>
```
*Note the parameter `autoload=false` is used to prevent race conditions during script loading. The map is manually initialized after `window.onload` via `kakao.maps.load(callback)`.*

At runtime, the React Native component reads the Kakao JS API key from the environment and replaces the placeholder:
```typescript
const apiKey = process.env.EXPO_PUBLIC_KAKAO_MAP_API_KEY || 'MOCK_KEY';
const htmlContent = KAKAO_MAP_HTML.replace('YOUR_JS_API_KEY', apiKey);
```
This substituted HTML string is then passed to the `WebView` as an inline document:
```typescript
source={{ html: htmlContent, baseUrl: 'https://haetae05.github.io' }}
```

### 1.2 Domain Restrictions & `baseUrl` Role
Kakao's security policy requires that all Web SDK requests originate from an authorized site domain registered in the developer console to prevent API key hijacking.
1. **WebView Origin Issue**: By default, React Native WebView loads inline HTML with a null or local origin (`about:blank` or `file://`). Kakao's servers immediately reject these origins, throwing a `401 Unauthorized` error.
2. **Forced Origin Injection**: The `baseUrl: 'https://haetae05.github.io'` prop forces the WebView to treat the inline HTML as if it were served directly from the domain `https://haetae05.github.io`.
3. **Console Registration Requirement**: In the Kakao Developers Console under **Platform Settings > Web > Site Domain**, the domain `https://haetae05.github.io` must be explicitly added to the whitelist. If this domain is not whitelisted, the map will fail to initialize.

---

## 2. postMessage Bridge Extensions for UGC

To pivot from a read-only map view to user-generated content (UGC), the communication bridge must support diary logging and custom place creation.

```
+------------------+                   +------------------+
|   WebView (JS)   | -- postMessage -> | React Native App |
| (Map UI Context) |                   |  (State & DB)    |
+------------------+                   +------------------+
  - Long Press:                          - Prompt Modal
    MAP_LONG_CLICKED                       (Name/Desc)
  - Log Diary:                           - Write DB (AsyncStorage)
    CREATE_DIARY_ENTRY                   - updateSpots() inject JS
```

### 2.1 Extension Scenario 1: Creating a Diary Entry for a Place
We can implement this using two complementary approaches:

#### Option A (WebView-Driven)
The user selects a marker, opening an info window with a button "기록 남기기" (Leave Record). When tapped, the WebView sends a message to React Native:
```javascript
sendToRN('CREATE_DIARY_ENTRY', {
  placeId: spot.id,
  placeName: spot.name,
  waterType: spot.waterType || 'none'
});
```
On the React Native side, in `handleMessage(event)` in `map.tsx`:
```typescript
case 'CREATE_DIARY_ENTRY': {
  const { placeName, waterType } = message.payload;
  
  // 1. Map waterType to RippleContext WaterSource type
  const waterSourceMap: Record<string, WaterSource> = {
    stream: 'stream',
    river: 'river',
    sea: 'sea'
  };
  const mappedSource = waterSourceMap[waterType] || 'stream';
  
  // 2. Format a custom detail string
  const customDetail = `"${placeName}"에서 10분을 머물렀어요.`;
  
  // 3. Save to database using RippleContext
  addDiaryEntry(customDetail); // Requires addDiaryEntry to support an optional customDetail parameter
  break;
}
```

#### Option B (Native-Driven)
Keep the Web context lean. When the WebView fires `SPOT_SELECTED` on marker click, the native application updates its focused state (`currentPlace`). We display a native button in the bottom drawer card:
```tsx
<Pressable onPress={() => addDiaryEntry(`"${currentPlace.name}"에서 10분을 머물렀어요.`)}>
  <Text>이 장소 머무름 기록하기</Text>
</Pressable>
```
*Option B is the recommended design because it maintains a native look-and-feel, reduces complexity in the WebView, and adheres to clean separation of concerns.*

---

### 2.2 Extension Scenario 2: Adding a Custom "User Spot" (UGC Marker)
To allow arbitrary map clicks/long-presses to register custom locations:

#### 1. Long-Press Event Detection in WebView (JS)
Since Kakao Map SDK does not offer a native `longclick` event on the Map object, we simulate it via touch timers in the document body:
```javascript
var touchTimer;
var startCoords = { x: 0, y: 0 };

var container = document.getElementById('map');
container.addEventListener('touchstart', function(e) {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    startCoords = { x: touch.clientX, y: touch.clientY };
    
    touchTimer = setTimeout(function() {
      // Map projection converts screen coordinates to LatLng coordinates
      var proj = map.getProjection();
      var containerPoint = new kakao.maps.Coords(touch.clientX, touch.clientY);
      var latlng = proj.coordsToLatLng(containerPoint);
      
      sendToRN('MAP_LONG_CLICKED', {
        latitude: latlng.getLat(),
        longitude: latlng.getLng()
      });
    }, 600); // 600ms long-press threshold
  }
});

container.addEventListener('touchmove', function(e) {
  // Clear if user drags finger (panning map)
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - startCoords.x);
    const dy = Math.abs(touch.clientY - startCoords.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(touchTimer);
    }
  }
});

container.addEventListener('touchend', function() {
  clearTimeout(touchTimer);
});
```

#### 2. Native Side Handler and AsyncStorage Integration
In React Native `map.tsx`'s `handleMessage`:
```typescript
case 'MAP_LONG_CLICKED': {
  const { latitude, longitude } = message.payload;
  // Trigger a native form dialog to enter spot name and description
  showAddCustomSpotModal(latitude, longitude);
  break;
}
```

To support local saving and reactive synchronization of these custom places:
- **Database Extension (`local_places.ts`)**: Maintain a secondary key `@anywayTheSea:custom_places` in `AsyncStorage`.
```typescript
const CUSTOM_PLACES_KEY = '@anywayTheSea:custom_places';

export const saveCustomPlace = async (newPlace: Place): Promise<void> => {
  const raw = await AsyncStorage.getItem(CUSTOM_PLACES_KEY);
  const existing: Place[] = raw ? JSON.parse(raw) : [];
  const updated = [...existing, newPlace];
  await AsyncStorage.setItem(CUSTOM_PLACES_KEY, JSON.stringify(updated));
  
  // Trigger reactive cache update so all screens (including map) repaint
  const allPlaces = await getPlaces();
  notifyListeners(allPlaces); 
};
```
- **Merging Local UGC & CDN Places**: Update the main fetch function:
```typescript
export const getPlaces = async (): Promise<Place[]> => {
  // ... Fetch CDN/bundle places ...
  const cdnPlaces = await getCdnOrBundlePlaces();
  
  // Retrieve and merge local custom places
  const rawCustom = await AsyncStorage.getItem(CUSTOM_PLACES_KEY);
  const customPlaces: Place[] = rawCustom ? JSON.parse(rawCustom) : [];
  
  return [...cdnPlaces, ...customPlaces];
};
```
- **Dynamic Render**: When `places` change, the existing dynamic synchronization effect in `map.tsx` will automatically serialize the updated places list (including the new custom spot) and call:
```typescript
webViewRef.current?.injectJavaScript(`window.updateSpots(${JSON.stringify(spotsData)});true;`);
```
This forces the WebView to draw the new marker instantly without reloading the page.

---

## 3. Review of the WebView Keep-Alive State Mechanism

### 3.1 Mechanism Breakdown
To prevent WebKit from destroying rendering contexts, `map.tsx` dynamically switches styles based on the React Navigation focus state:
```typescript
const webViewContainerStyle = isFocused ? styles.webViewContainerActive : styles.webViewContainerInactive;
```
When `isFocused` is false, it applies the inactive style:
```typescript
webViewContainerInactive: {
  position: 'absolute',
  left: -9999,
  top: -9999,
  width: '100%',  // Maintain size to prevent WebGL context discard
  height: '100%', // Maintain size to prevent WebKit process suspension
  opacity: 0.01,  // Keep opacity above 0 to bypass WebKit freeze
}
```

### 3.2 Evaluation of Robustness
This is a standard workaround in hybrid applications for the following reasons:
- **WebGL Context Discard Prevention**: If a canvas or WebView is resized to `0x0` or unmounted, the OS graphics layer immediately garbage-collects the WebGL context. Keeping `width: 100%` and `height: 100%` prevents context loss.
- **Process Suspension Bypass**: WebKit (iOS) and Chrome (Android WebView) aggressively freeze JS execution loops and stop timers for hidden WebViews (where `opacity: 0` or `display: none` is set). A non-zero opacity (`0.01`) forces the system compositor to keep the web process active.

### 3.3 Critical Risks & Edge Cases

| Risk Category | Details / Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **1. Memory Leak & OOM Crashes** | Kakao Map caches image tiles and keeps multiple WebGL buffers loaded in RAM. Keeping the WebView alive while the user is elsewhere prevents this RAM from being released. On low-end devices (e.g. 2GB RAM), navigating to other heavy screens may trigger OS Out-Of-Memory (OOM) termination. | Implement a manual memory threshold warning. If the app detects high memory pressure, force-unmount the WebView and accept a reload penalty on focus. |
| **2. Background CPU & Battery Drain** | Because JS execution is not suspended, background timer loops, user location coordinate rendering (`updateUserLocation`), and Kakao SDK internal redraw requests continue to consume CPU cycles even when the tab is inactive. | Halt React Native telemetry updates to the WebView when `isFocused` is false. The current `useEffect` for location watcher does this (`if (!isFocused) return`), but we should also explicitly toggle off Kakao Map features inside the WebView (e.g. `map.setCursor('default')` or stop animations) via injected scripts. |
| **3. WebGL Context Loss under GPU Stress** | Even with offscreen rendering, WebKit will still forcibly discard the WebGL context if the device experiences extreme system-wide GPU memory pressure. In this case, returning to the map will show a blank canvas. | Implement a listener for the WebGL context lost event (`webglcontextlost`) in the HTML code and automatically trigger `window.location.reload()` if detected. |
| **4. Layout Flash / Jitter on Refocus** | Snapping the container from `left: -9999` to `0` triggers a synchronous layout reflow. If the map layout recalculation takes time, the user will see a gray blank box or misaligned tiles. | The app calls `map.relayout()` on refocus. To make this smoother, apply a short fade-in transition (`opacity` from `0.01` to `1.0` over 150ms) to mask the reflow jitter. |
