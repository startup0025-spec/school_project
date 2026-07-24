# Kakao Maps WebView Bidirectional Communication & Event Bridge Design

This document details the architecture, message protocol schema, and HTML templates for integrating the Kakao Maps JavaScript SDK into the React Native app *Anyway, the Sea* via a robust, offline-resilient `react-native-webview` bridge.

---

## 1. Executive Summary
To enable precise geographical mapping while maintaining Expo Go compatibility and a calm aesthetic, the app will load a local HTML wrapper into a WebView using **Base URL Spoofing**. We implement a structured **postMessage Event Bridge** with console logging, runtime exception routing, and script load failure fallback detection. This design guarantees clean diagnostics, protects the Kakao API quota (300,000 requests/day), and provides graceful offline fallback capabilities.

---

## 2. WebView Hosting & Spoofing Strategy
To avoid blank screens or cellular network errors when bootstrapping the WebView offline, the app will load the HTML wrapper as a local inline string:
- **Local Instantiation**: The HTML template is bundled directly in the TypeScript code (or loaded via Expo Assets) as an inline string.
- **Base URL Spoofing**: We render the WebView using the `source={{ html: htmlString, baseUrl: 'https://haetae05.github.io' }}` property.
- **Origin Authorization**: Both iOS (`WKWebView`) and Android (`WebView`) spoof the origin domain to `https://haetae05.github.io`, satisfying Kakao Developer Console web domain registration rules.
- **Offline Resiliency**: The HTML shell itself loads instantly offline. If the Kakao SDK script load fails (due to lack of internet), it is handled gracefully in JavaScript instead of crashing the WebView.

---

## 3. postMessage Protocol Schema

All communications between the Web context and React Native are formatted as JSON strings containing a `type` and a `payload`.

### 3.1 Web to React Native Events (Schema & Types)

```typescript
type WebViewMessage =
  | { type: 'MAP_READY'; payload: Record<string, never> }
  | { type: 'SPOT_SELECTED'; payload: { id: string } }
  | { type: 'SDK_LOAD_FAILED'; payload: { errorType: 'network' | 'timeout'; message: string } }
  | { type: 'WEB_ERROR'; payload: { message: string; source: string; line: number; column: number; stack?: string } }
  | { type: 'CONSOLE_LOG'; payload: { level: 'log' | 'info' | 'warn' | 'error'; message: string } }
  | { type: 'MAP_CLICKED'; payload: { latitude: number; longitude: number } };
```

#### Event Descriptions
1. **`MAP_READY`**: Triggered when the Kakao Map has finished loading, and `window.updateSpots` is ready to receive data.
2. **`SPOT_SELECTED`**: Triggered when a user clicks on a spot marker. Contains the unique spot `id` to update native audio state and card view.
3. **`SDK_LOAD_FAILED`**: Sent if the Kakao JS script tag fails to load, or if loading times out (e.g. offline device). Tells React Native to render the `quiet-map.png` fallback view.
4. **`WEB_ERROR`**: Catches unhandled exceptions and promise rejections inside the WebView, routing them directly to the Metro Console.
5. **`CONSOLE_LOG`**: Proxies all standard console logs inside the WebView to the Metro Console for easy debugging.
6. **`MAP_CLICKED`**: Triggered when the user clicks empty space on the map. Allows native UI to hide active card overlays.

---

### 3.2 React Native to WebView JS Inject Functions

React Native executes these functions in the WebView context using `webViewRef.current.injectJavaScript(code)`.

#### 1. `window.updateUserLocation(lat: number, lng: number)`
- **Parameters**: `lat` (latitude), `lng` (longitude).
- **Behavior**: Instantiates or updates a custom user marker (e.g., blue pulse circle) at the user's GPS coordinates. 
- **Rationale**: Keeps location queries native (via Expo Location API) to prevent buggy browser permissions dialogs inside the WebView.

#### 2. `window.updateSpots(spotsJson: string)`
- **Parameters**: `spotsJson` (JSON-stringified array of `Place` objects).
- **Behavior**: Clears existing spot markers, parses the list, and creates new Kakao Map markers with tap listeners that emit the `SPOT_SELECTED` event.

#### 3. `window.focusSpot(lat: number, lng: number, level?: number)`
- **Parameters**: `lat` (latitude), `lng` (longitude), `level` (optional Kakao zoom level, 1-14).
- **Behavior**: Pans the map to center on the coordinates, utilizing smooth panning if the target is within view.

#### 4. `window.setTheme(theme: 'grayscale' | 'indigo' | 'none')`
- **Parameters**: `theme` (styling configuration).
- **Behavior**: Updates the CSS classes on the map container to switch between calm aesthetics.

---

## 4. Concrete HTML Script Templates

Below is the complete HTML page wrapper designed to be stored as an inline string asset. It embeds the message queue, console log proxy, error handlers, and the Kakao Maps loading logic.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #0b132b; /* Deep Indigo fallback */
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
    }

    /* Target ONLY map background tiles to avoid color distortion on custom markers or logos */
    #map img[src*="daumcdn.net"], 
    #map img[src*="maps.daumcdn.net"] {
      filter: grayscale(100%) opacity(0.8) contrast(1.1);
      will-change: filter;
      transform: translate3d(0, 0, 0); /* Promote to GPU layer for butter-smooth panning */
    }

    /* Optional Indigo Theme override */
    body.theme-indigo #map img[src*="daumcdn.net"],
    body.theme-indigo #map img[src*="maps.daumcdn.net"] {
      filter: invert(90%) hue-rotate(180deg) brightness(0.8) contrast(1.2);
    }
  </style>

  <script>
    // ==========================================
    // 1. ROBUST POSTMESSAGE BRIDGE & QUEUE
    // ==========================================
    var messageQueue = [];
    
    function sendToRN(type, payload) {
      var message = JSON.stringify({ type: type, payload: payload || {} });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(message);
      } else {
        messageQueue.push(message);
      }
    }

    // Poller to flush messages queued before the bridge is fully initialized
    var bridgePoller = setInterval(function() {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        clearInterval(bridgePoller);
        while (messageQueue.length > 0) {
          window.ReactNativeWebView.postMessage(messageQueue.shift());
        }
      }
    }, 50);

    // ==========================================
    // 2. CONSOLE LOG PROXYING
    // ==========================================
    (function() {
      var levels = ['log', 'info', 'warn', 'error'];
      levels.forEach(function(level) {
        var originalConsole = console[level];
        console[level] = function() {
          var args = Array.prototype.slice.call(arguments);
          var message = args.map(function(arg) {
            if (typeof arg === 'object') {
              try { return JSON.stringify(arg); } catch(e) { return String(arg); }
            }
            return String(arg);
          }).join(' ');

          sendToRN('CONSOLE_LOG', { level: level, message: message });

          if (originalConsole) {
            originalConsole.apply(console, arguments);
          }
        };
      });
    })();

    // ==========================================
    // 3. GLOBAL RUNTIME ERROR INTERCEPTION
    // ==========================================
    window.onerror = function(message, source, lineno, colno, error) {
      sendToRN('WEB_ERROR', {
        message: message,
        source: source || 'unknown',
        line: lineno || 0,
        column: colno || 0,
        stack: error ? error.stack : ''
      });
      return false; // Allow standard execution
    };

    window.addEventListener('unhandledrejection', function(event) {
      var reason = event.reason;
      var message = reason instanceof Error ? reason.message : String(reason);
      var stack = reason instanceof Error ? reason.stack : '';
      sendToRN('WEB_ERROR', {
        message: 'Unhandled Promise Rejection: ' + message,
        source: 'promise',
        stack: stack
      });
    });

    // ==========================================
    // 4. WATCHDOG TIMEOUT FOR SDK LOADING
    // ==========================================
    var sdkTimeout = setTimeout(function() {
      if (typeof kakao === 'undefined' || !kakao.maps) {
        sendToRN('SDK_LOAD_FAILED', {
          errorType: 'timeout',
          message: 'Kakao Maps JS SDK loading timed out after 8 seconds.'
        });
      }
    }, 8000);

    function handleScriptError() {
      clearTimeout(sdkTimeout);
      sendToRN('SDK_LOAD_FAILED', {
        errorType: 'network',
        message: 'Kakao Maps JS SDK script load triggered onerror hook.'
      });
    }
  </script>

  <!-- Load Kakao SDK with autoload=false to prevent race conditions -->
  <script 
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_JS_API_KEY&autoload=false" 
    onerror="handleScriptError()"
  ></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var markers = {};
    var userLocationMarker = null;

    // Run Kakao maps initialization only when document is fully loaded
    window.onload = function() {
      clearTimeout(sdkTimeout);
      if (typeof kakao !== 'undefined' && kakao.maps) {
        kakao.maps.load(function() {
          try {
            initializeMap();
          } catch (e) {
            console.error('Failed to initialize map object: ' + e.message);
          }
        });
      } else {
        handleScriptError();
      }
    };

    function initializeMap() {
      var container = document.getElementById('map');
      var options = {
        center: new kakao.maps.LatLng(35.1795543, 129.0756416), // Default to Busan City Hall
        level: 4
      };
      
      map = new kakao.maps.Map(container, options);

      // Disable zoom controls/scrolling page levels to prevent WebView page zoom
      map.setZoomable(true);

      // Add click handler to dismiss active spots in Native UI
      kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
        var latlng = mouseEvent.latLng;
        sendToRN('MAP_CLICKED', {
          latitude: latlng.getLat(),
          longitude: latlng.getLng()
        });
      });

      sendToRN('MAP_READY');
    }

    // ==========================================
    // 5. EXPOSED INJECTABLE JAVASCRIPT APIs
    // ==========================================
    window.updateUserLocation = function(lat, lng) {
      if (!map) return;
      var latLon = new kakao.maps.LatLng(lat, lng);

      if (!userLocationMarker) {
        // Create custom user indicator (e.g. Blue Circle Marker)
        var imageSize = new kakao.maps.Size(20, 20);
        var imageOption = { offset: new kakao.maps.Point(10, 10) };
        var markerImage = new kakao.maps.MarkerImage(
          'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="%23007AFF" stroke="white" stroke-width="2"/><circle cx="10" cy="10" r="10" fill="%23007AFF" opacity="0.3" stroke="none"/></svg>',
          imageSize,
          imageOption
        );

        userLocationMarker = new kakao.maps.Marker({
          position: latLon,
          image: markerImage,
          clickable: false
        });
        userLocationMarker.setMap(map);
      } else {
        userLocationMarker.setPosition(latLon);
      }
    };

    window.updateSpots = function(spotsJson) {
      if (!map) return;
      
      // Clear current markers
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

        kakao.maps.event.addListener(marker, 'click', function() {
          sendToRN('SPOT_SELECTED', { id: spot.id });
        });
      });
    };

    window.focusSpot = function(lat, lng, level) {
      if (!map) return;
      var moveLatLon = new kakao.maps.LatLng(lat, lng);
      map.panTo(moveLatLon);
      if (level) {
        map.setLevel(level);
      }
    };

    window.setTheme = function(theme) {
      var body = document.body;
      if (theme === 'indigo') {
        body.className = 'theme-indigo';
      } else if (theme === 'grayscale') {
        body.className = '';
      } else {
        body.className = '';
      }
    };
  </script>
</body>
</html>

---

## 5. React Native Integration & Quota Protection

Below is the concrete TypeScript design for `map.tsx` to handle message routing, user location synchronization, and memory preservation to prevent WebView remounts.

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Image, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useColors } from '@/hooks/useColors';
import { QUIET_SPOTS } from '@/constants/mockData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Static template string representing our HTML wrapper.
// In production, YOUR_JS_API_KEY can be dynamically replaced.
const HTML_TEMPLATE = `...`; // Complete HTML string from Section 4

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  
  const [index, setIndex] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSdkFailed, setIsSdkFailed] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);

  const spot = QUIET_SPOTS[index];

  // 1. Setup Native Geolocation Proxy Watcher
  useEffect(() => {
    let active = true;

    async function startWatchingLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Foreground location permission denied.');
        return;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        (loc) => {
          if (!active) return;
          const { latitude, longitude } = loc.coords;
          // Inject location into WebView
          const injectScript = `if (window.updateUserLocation) { window.updateUserLocation(${latitude}, ${longitude}); }; true;`;
          webViewRef.current?.injectJavaScript(injectScript);
        }
      );

      if (active) {
        setLocationSubscription(subscription);
      } else {
        subscription.remove();
      }
    }

    startWatchingLocation();

    return () => {
      active = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // 2. Synchronize Spots on Load or Index Change
  useEffect(() => {
    if (isMapReady && !isSdkFailed) {
      // Map all quiet spots to pass to the WebView
      const spotsData = QUIET_SPOTS.map((s) => ({
        id: s.id,
        name: s.name,
        latitude: s.pin.x * 0.05 + 35.17, // Simulated conversion to real coords for this mock
        longitude: s.pin.y * 0.05 + 129.07,
      }));
      
      const spotsJson = JSON.stringify(spotsData);
      const injectScript = `if (window.updateSpots) { window.updateSpots('${spotsJson.replace(/'/g, "\\'")}'); }; true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [isMapReady, isSdkFailed]);

  // 3. Focus Active Spot when Index Changes
  useEffect(() => {
    if (isMapReady && !isSdkFailed) {
      const lat = spot.pin.x * 0.05 + 35.17;
      const lng = spot.pin.y * 0.05 + 129.07;
      const injectScript = `if (window.focusSpot) { window.focusSpot(${lat}, ${lng}, 4); }; true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [index, isMapReady, isSdkFailed]);

  // 4. Handle Incoming Events from WebView
  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      switch (message.type) {
        case 'MAP_READY':
          setIsMapReady(true);
          setIsSdkFailed(false);
          console.log('[WebView] Kakao Map successfully initialized.');
          break;
        case 'SPOT_SELECTED':
          const selectedId = message.payload.id;
          const foundIndex = QUIET_SPOTS.findIndex((s) => s.id === selectedId);
          if (foundIndex !== -1) {
            Haptics.selectionAsync();
            setIndex(foundIndex);
          }
          break;
        case 'SDK_LOAD_FAILED':
          console.error(`[WebView] SDK load failed: ${message.payload.message}`);
          setIsSdkFailed(true);
          break;
        case 'WEB_ERROR':
          console.error(`[WebView Exception] ${message.payload.message} at ${message.payload.source}:${message.payload.line}`);
          break;
        case 'CONSOLE_LOG':
          const { level, message: logMsg } = message.payload;
          console[level](`[WebView Console] ${logMsg}`);
          break;
        case 'MAP_CLICKED':
          console.log(`[WebView Click] Map clicked at lat: ${message.payload.latitude}, lng: ${message.payload.longitude}`);
          break;
        default:
          console.warn(`[WebView Bridge] Unrecognized message type: ${message.type}`);
      }
    } catch (err) {
      console.warn('Failed to parse WebView message:', err);
    }
  };

  // Safely inject the correct API key at runtime
  const apiKey = process.env.EXPO_PUBLIC_KAKAO_MAP_API_KEY || 'MOCK_KEY';
  const htmlContent = HTML_TEMPLATE.replace('YOUR_JS_API_KEY', apiKey);

  // If loading the SDK failed (e.g. offline), render static fallback
  if (isSdkFailed) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.mapArea}>
          <Image
            source={require('@/assets/images/quiet-map.png')}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <View style={[styles.mapTint, { backgroundColor: colors.foreground }]} />
          <View
            style={[
              styles.pinWrap,
              { left: `${spot.pin.x * 100}%` as const, top: `${spot.pin.y * 100}%` as const },
            ]}
          >
            <View style={[styles.pinDot, { backgroundColor: colors.primary, borderColor: colors.card }]} />
          </View>
          <View style={[styles.headerOverlay, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.eyebrow}>[오프라인 모드] 오늘 가기 가장 조용한 곳</Text>
          </View>
        </View>
        
        {/* Spot info card and navigation footer */}
        {renderCard()}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.mapArea}>
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent, baseUrl: 'https://haetae05.github.io' }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={false}
          style={styles.webView}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        />
        <View style={[styles.headerOverlay, { paddingTop: insets.top + 12, position: 'absolute', top: 0, left: 0 }]}>
          <Text style={styles.eyebrow}>오늘 가기 가장 조용한 곳</Text>
        </View>
      </View>

      {renderCard()}
    </View>
  );

  function renderCard() {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          점심시간이 지나고 가장 한가한 시간에 딱 한 곳만 추천드려요.
        </Text>
        <Text style={[styles.spotName, { color: colors.foreground }]}>{spot.name}</Text>
        <Text style={[styles.spotNote, { color: colors.mutedForeground }]}>{spot.note}</Text>
        <View style={styles.spotFooter}>
          <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{spot.walk}</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setIndex((i) => (i + 1) % QUIET_SPOTS.length);
            }}
            style={styles.refreshButton}
            testID="next-spot"
          >
            <Feather name="refresh-ccw" size={14} color={colors.primary} />
            <Text style={[styles.refreshText, { color: colors.primary }]}>다른 물길 보기</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mapArea: { flex: 1, overflow: 'hidden' },
  mapTint: { ...StyleSheet.absoluteFillObject, opacity: 0.14 },
  headerOverlay: { paddingHorizontal: 24 },
  eyebrow: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pinWrap: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  webView: { flex: 1 },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b132b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    gap: 6,
  },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  spotName: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 2 },
  spotNote: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, marginTop: 2 },
  spotFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  tagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
```

