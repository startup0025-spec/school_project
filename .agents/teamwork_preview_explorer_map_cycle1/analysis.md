# Kakao Map WebView Integration Strategy & Baseline Architecture

This document presents the detailed findings and architectural design proposal for integrating the Kakao Map API into the *Anyway, the Sea* React Native Expo mobile application. 

---

## 1. Core Objectives & Architectural Shift
In previous iterations, the map screen (`map.tsx`) rendered a static illustration map (`quiet-map.png`) with coordinate relative pins. However, to eliminate coordinate mapping errors (e.g., GPS-to-pixel projection math) and to support precise pathing and real-world water space identification in Busan, the decision has been made to integrate the **Kakao Map JavaScript SDK** via **React Native WebView**.

This strategy provides:
1. **Accurate Coordinates**: Dynamic rendering of real-world latitude/longitude pins from `getPlaces()`.
2. **Real-world Walk Times**: Future expansion can leverage Kakao's routing APIs rather than straight-line Haversine math.
3. **Calm, Distraction-Free UX**: Commercial and busy map elements can be visually suppressed via CSS filtering, preserving the app's clean, non-intrusive aesthetic.

---

## 2. Why React Native WebView (`react-native-webview`)?
React Native does not have an official, native Kakao Map SDK wrapper. While community native libraries exist, they present major drawbacks for Expo projects:
* **Expo Go Compatibility**: Native libraries require custom native code changes (Android Gradle/iOS Cocoapods modifications), which break compatibility with Expo Go. Using `react-native-webview` utilizes a standard Expo-supported library, preserving the **Managed Workflow** and allowing immediate testing in Expo Go.
* **Unified Cross-Platform Interface**: WebView displays identically across iOS and Android, removing platform-specific rendering issues.
* **Low Maintenance Overhead**: Directly loading the official JS SDK through HTML/CSS/JS isolates mapping logic from OS-level changes, reducing build dependencies.

---

## 3. WebView Hosting & Bundling Options
To run the Kakao Map JS SDK, the WebView must load an HTML file. We evaluate three options for hosting this HTML:

| Option | Implementation | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **A: CDN-Hosted HTML** *(Recommended)* | Host `map.html` on a stable domain (e.g. GitHub Pages: `https://haetae05.github.io/Anyway_the_Sea/map.html`) and load it via `{ uri: '...' }`. | 1. **Extremely stable origin authorization** in Kakao Developers Console.<br>2. Updates to map features/JS can be deployed instantly without app store releases. | Requires internet to load the HTML wrapper itself (though the Kakao JS SDK always requires internet to load map tiles). |
| **B: Local Asset Bundling** | Bundle the HTML file as a local resource: `require('@/assets/map.html')` and load it. | Loads the local HTML wrapper instantly even with intermittent networks. | Kakao Maps SDK requires a registered web origin. In local files (`file://`), origins differ between iOS and Android, which makes domain configuration in the Kakao Console extremely difficult or impossible. |
| **C: Inline HTML with Base URL Spoofing** | Render the HTML as a string inside React Native and set the `baseUrl` prop: `source={{ html: htmlString, baseUrl: 'https://haetae05.github.io' }}`. | Single codebase; no external CDN files to manage. | 1. Managing large HTML/JS code inside TypeScript string literals is error-prone.<br>2. `baseUrl` origin matching behaves inconsistently between iOS and Android. |

### Architectural Recommendation: **Option A (CDN-Hosted HTML)**
For maximum stability and simple domain registration, we recommend hosting the HTML wrapper on a CDN (like GitHub Pages/Vercel) and loading it via URI. For local offline failover, the app can display a graceful overlay if network requests fail.

---

## 4. Kakao Developer Console Configuration
Because the Kakao Map JS SDK checks the origin domain of the requesting page, you must configure the **Web Platform Domain** in the [Kakao Developers Console](https://developers.kakao.com/):

1. **Register the App**: Create an application in the console and copy the **JavaScript Key**.
2. **Configure Platform Domains**: Go to *Settings -> Platform -> Web (웹)* and add:
   * `https://haetae05.github.io` (or the custom domain where the CDN HTML page is hosted).
   * `http://localhost:8081` (required for testing web output in Metro bundler).
3. **Allow Location Permissions**: Ensure the app request permissions for location (Expo's `Location.requestForegroundPermissionsAsync()`), as the WebView may query the browser's Geolocation API.

---

## 5. Map Styling & Aesthetic Customization (Calm UX)
The Kakao Map JS SDK does not support Google-Maps-style JSON theme configurations. However, we can satisfy the **Calm UX Guidelines** (reducing commercial clutter and visual noise) using **CSS Filters** on the map container:

### Grayscale Calm Mode
Suppresses neon commercial icons and brings a serene, unified aesthetic:
```css
#map {
  width: 100%;
  height: 100%;
  filter: grayscale(100%) opacity(0.85) contrast(1.1);
}
```

### Indigo Dark Mode (Match "Anyway, the Sea" theme)
Transforms the bright white background into a deep marine tone:
```css
#map {
  width: 100%;
  height: 100%;
  filter: invert(90%) hue-rotate(180deg) brightness(0.8) contrast(1.2);
}
```

---

## 6. Bridge Communication & Quota Optimization
Rerendering a WebView triggers a full reload of the Kakao Map SDK script. This triggers Kakao Map initialization again, draining battery and **rapidly consuming the daily free API quota (300,000 requests/day)**.

To optimize performance and quota usage, we implement a **Keep-Alive Bridge**:
1. **Memoize the WebView**: Ensure the WebView component's `source` prop remains static so it renders only once.
2. **RN-to-Web (PostMessage / injectJavaScript)**: Use the WebView reference to inject JS calls when coordinates or active spots change, instead of refetching the HTML.
3. **Web-to-RN (PostMessage)**: Emit messages back to React Native when markers are tapped or the map is dragged.

### HTML Wrapper Template (`map.html` hosted on CDN)
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #0b132b; /* Deep Indigo Fallback */
    }
    /* Calm UX Grayscale/Inversion Filter */
    #map {
      filter: grayscale(100%) opacity(0.8) contrast(1.1);
    }
  </style>
  <script type="text/javascript" src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_JS_API_KEY"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var markers = {};

    // 1. Initialize Map
    var container = document.getElementById('map');
    var options = {
      center: new kakao.maps.LatLng(35.1795543, 129.0756416), // Default: Busan City Hall
      level: 4
    };
    map = new kakao.maps.Map(container, options);

    // Send status back to React Native
    function sendToRN(type, payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
      }
    }

    // Notify RN that map is ready
    sendToRN('MAP_READY', {});

    // 2. JavaScript Interface (Invoked via injectJavaScript)
    window.updateSpots = function(spotsJson) {
      // Clear existing markers
      for (var id in markers) {
        markers[id].setMap(null);
      }
      markers = {};

      var spots = JSON.parse(spotsJson);
      spots.forEach(function(spot) {
        var markerPosition = new kakao.maps.LatLng(spot.latitude, spot.longitude);
        var marker = new kakao.maps.Marker({
          position: markerPosition,
          title: spot.name
        });
        marker.setMap(map);
        markers[spot.id] = marker;

        // Tapping marker sends event back to React Native
        kakao.maps.event.addListener(marker, 'click', function() {
          sendToRN('SPOT_SELECTED', { id: spot.id });
        });
      });
    };

    window.focusSpot = function(lat, lng, level) {
      var moveLatLon = new kakao.maps.LatLng(lat, lng);
      map.panTo(moveLatLon);
      if (level) map.setLevel(level);
    };
  </script>
</body>
</html>
```

### React Native Integration (`map.tsx` Implementation sketch)
```typescript
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { getPlaces } from '@/core_engine/src/database/local_places';
import { Place } from '@/core_engine/src/models/place_model';
import { useColors } from '@/hooks/useColors';

export default function MapScreen() {
  const colors = useColors();
  const webViewRef = useRef<WebView>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  // Fetch places on mount
  useEffect(() => {
    getPlaces().then((data) => {
      setPlaces(data);
    });
  }, []);

  // Update markers when places are fetched and map is ready
  useEffect(() => {
    if (isMapReady && places.length > 0) {
      const spotsJson = JSON.stringify(places);
      const script = `window.updateSpots('${spotsJson.replace(/'/g, "\\'")}'); true;`;
      webViewRef.current?.injectJavaScript(script);
    }
  }, [isMapReady, places]);

  // Handle messages coming from WebView
  const handleMessage = (event: any) => {
    try {
      const { type, payload } = JSON.parse(event.nativeEvent.data);
      if (type === 'MAP_READY') {
        setIsMapReady(true);
      } else if (type === 'SPOT_SELECTED') {
        const spotId = payload.id;
        console.log('Selected spot in React Native:', spotId);
        // Trigger audio parameters change or UI focus here
      }
    } catch (err) {
      console.warn('WebView Message Parse Error:', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://haetae05.github.io/Anyway_the_Sea/map.html' }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={StyleSheet.absoluteFillObject}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
});
```

---

## 7. Refactoring Scope (Impact Analysis)
Transitioning to the Kakao Map WebView API requires updates across the following files:

1. **`mobile/package.json`**:
   * **Change**: Add `"react-native-webview": "^13.13.1"` (or appropriate Expo SDK 54 version) to `dependencies`.
   * **Reason**: Installs the webview component required to embed the HTML map.

2. **`mobile/app/(tabs)/map.tsx`**:
   * **Change**: Remove the relative static image (`quiet-map.png`) and relative `pin: { x, y }` math. Render the `<WebView>` mapping layout with custom CSS filters. Keep the bottom card overlay, but wire its active index to the `SPOT_SELECTED` webview events.
   * **Reason**: Implements the actual live Kakao Map interface.

3. **`mobile/lib/views/home_screen.tsx`**:
   * **Change**: Define this component as the main setup/control screen or remove it if redundant. According to the blueprint, `home_screen.tsx` handles "평온 장소 지도 및 앱 설정 화면 UI". The integration must clarify if a secondary map preview goes here or if it acts as a tab delegate.
   * **Reason**: Resolves the empty file state and conforms to the layout plan.

4. **`mobile/constants/mockData.ts`**:
   * **Change**: Clean up `QUIET_SPOTS` relative coordinates (`pin: { x, y }`). If kept as fallback, add valid `latitude` and `longitude` fields conforming to the `Place` schema.
   * **Reason**: Resolves type mismatches and outdated UI mock configurations.

5. **`mobile/core_engine/src/database/local_places.ts`**:
   * **Change**: Populate the local storage fallback with valid geographical coordinates (Busan water spots) rather than empty arrays.
   * **Reason**: Ensures the map load events actually find pins to place.
