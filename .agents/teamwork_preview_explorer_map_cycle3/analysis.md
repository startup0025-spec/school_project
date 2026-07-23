# Kakao Map WebView Keep-Alive & Performance Optimization Strategy

This document details the design, layout strategies, and performance optimizations required to keep the Kakao Map WebView component alive (mounted in memory) across tab transitions in Expo Router, while protecting the Kakao Map daily API quota and ensuring a fluid, native-like user experience.

---

## 1. Keep-Alive Strategy & Quota Protection

### 1.1 The Quota Exhaustion Problem
The Kakao Maps JavaScript API is metered based on map initialization. Every time `new kakao.maps.Map()` is executed and the SDK is loaded, it counts as one API request against the daily quota (300,000 free requests per day).
- **Default Tab Behavior**: In React Navigation / Expo Router, when navigating between tabs, if screens are unmounted or if the native views are detached (via `react-native-screens`), the native WebView context is destroyed.
- **Result**: When the user returns to the Map tab, the WebView is forced to reload the HTML page, re-fetch the Kakao Maps script, and re-instantiate the map. If 10,000 users switch tabs 10 times a day, it consumes 100,000 requests, representing a massive waste of API quota.

### 1.2 Keep-Alive Resolution
To achieve a **single initialization per app session**, we must ensure the WebView is never unmounted or native-detached. Once loaded, the map remains active in the background, consuming zero additional API requests when switching tabs.

We propose two primary layout architectures for the Keep-Alive strategy:

---

### 1.3 Layout Strategy Comparison

| Feature / Criteria | Option A: Screen-Level Keep-Alive with Off-screen Transition | Option B: Root-Level Persistent WebView Layout (Global Portal) |
|---|---|---|
| **Location** | Inside `app/(tabs)/map.tsx` | Inside `app/(tabs)/_layout.tsx` (Root tab layout) |
| **Tab Navigation Config** | Set `detachInactiveScreens: false` on the Tab Navigator. | Default behavior (`detachInactiveScreens: true` allowed). |
| **Transition Style** | Toggle styling of WebView container between absolute fill and absolute off-screen (`left: -99999`) based on screen focus. | Toggle positioning between absolute fill and off-screen (`left: 100000`) based on active route path. |
| **State Coordination** | Simple. All state and event bridges live inside the same `MapScreen` file. | Complex. Requires React Context, a global state, or event emitters to sync data (e.g., spot click) with `MapScreen`. |
| **Resource Usage** | Slightly higher baseline since all tab screens are kept native-attached. | Highly optimized. Only the WebView is kept globally persistent; other screens can detach safely. |
| **WebGL Context Safety** | High, since the screen and WebView are kept native-attached. | High, since the WebView is never removed from the root hierarchy. |

#### Why `display: 'none'` is Forbidden
In React Native, setting `display: 'none'` on a native WebView (or rendering it conditionally via `{isFocused && <WebView />}`) has severe drawbacks:
1. **State Loss**: Conditional rendering (`{isFocused && ...}`) completely unmounts the WebView, destroying the JavaScript state, DOM, and map cache.
2. **WebGL Context Crash**: On Android, toggling `display: 'none'` or changing dimensions to `width: 0, height: 0` causes the native view to detach from the window. This triggers WebGL context loss, halts JS execution, and frequently causes the WebView to display a blank screen or reload upon re-focus.
3. **WKWebView Suspension**: On iOS, setting `display: 'none'` tells the system layout engine to mark the WebView as inactive. The OS may suspend the web process to save memory, resulting in lag or reload delays when the tab is clicked.

#### Recommended Layout Strategy: Off-screen Absolute Positioning
Rather than hiding the WebView or changing its size to zero, we transition its container stylesheet:
- **Active State**: Absolute fill over the map viewport (`flex: 1` or `{ ...StyleSheet.absoluteFillObject }`).
- **Inactive State**: Positioned absolutely off-screen (`position: 'absolute', top: -9999, left: -9999, width: 1, height: 1, opacity: 0`).
This keeps the WebView attached to the native window hierarchy, preserving its memory, DOM, and WebGL state, while ensuring it uses zero rendering/compositing resources and blocks no user interactions.

---

## 2. Viewport Configurations & Touch Interactions

To provide a smooth, native-like map experience, we must prevent default web browser interactions (like page zooming, bounce scrolling, and text selection) while preserving Kakao Map’s internal pan/pinch gestures.

### 2.1 Viewport Configuration Breakdown

#### 1. React Native WebView: `scalesPageToFit={false}`
- **Purpose**: Controls whether the WebView scales web content to fit the screen.
- **Setting**: `scalesPageToFit={false}`
- **Rationale**: Setting it to `false` prevents the native WebView from auto-scaling layout elements, ensuring that 1 CSS pixel in the web content maps exactly to 1 Density-Independent Pixel (dp) in React Native. This maintains clean, crisp rendering of map markers, text, and custom overlays.

#### 2. HTML Meta Viewport Tag
We configure the viewport in the inline HTML string as follows:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```
- `width=device-width`: Ensures the layout viewport matches the device screen width.
- `initial-scale=1.0`: Sets the default zoom scale when loaded.
- `maximum-scale=1.0` and `user-scalable=no`: **CRITICAL**. Disables mobile browser page-zoom. If user-scaling is allowed, the browser intercepts double-taps and pinch gestures to zoom the entire HTML page, causing text, controls, and Kakao logos to distort and scale up. Disabling it leaves all pinch and tap events for Kakao Map's JS SDK to handle internally.
- `viewport-fit=cover`: Instructs the WebView to render edge-to-edge, extending behind notches (safe areas) on iOS/Android.

#### 3. CSS `touch-action` Property
- **Setting**: `touch-action: none;` on the map container (`#map`).
- **Rationale**: The CSS `touch-action` property tells the browser how an element handles touch inputs. By setting it to `none`, we disable default mobile browser behaviors like bounce-scrolling, page panning, and tap-delay highlights. This passes all pointer events directly to the Kakao Maps gesture engines for smooth, lag-free zoom and pan interactions.

#### 4. Additional CSS Touch/Gesture Adjustments
- `-webkit-user-select: none; user-select: none;`: Prevents the iOS/Android text selection magnifying glass or copy/paste handles from showing up during long presses on the map.
- `-webkit-text-size-adjust: 100%;`: Prevents mobile browsers from resizing the page text when the device orientation changes.
- `-webkit-tap-highlight-color: rgba(0,0,0,0);`: Removes the grey tap outline highlight when clicking on map controls or markers.

---

## 3. Complete React Native Layout Architecture for `MapScreen`

The implementation below demonstrates **Option A (Screen-Level Keep-Alive)**, utilizing React Navigation's screen state and style transitions.

### 3.1 TabLayout Config (`app/(tabs)/_layout.tsx`)
To support Screen-Level Keep-Alive, the tab navigator must prevent native screen detachment:

```typescript
// Inside ClassicTabLayout in app/(tabs)/_layout.tsx
<Tabs
  screenOptions={{
    detachInactiveScreens: false, // PREVENTS WebView unmount/native detachment on Android/iOS
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.mutedForeground,
    headerShown: false,
    tabBarStyle: {
      position: 'absolute',
      backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background,
      // ...other styles
    }
  }}
>
  {/* Tab Screens */}
</Tabs>
```

---

### 3.2 Screen Implementation (`app/(tabs)/map.tsx`)

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Image, Pressable, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';

import { useColors } from '@/hooks/useColors';
import { QUIET_SPOTS } from '@/constants/mockData';

// Inline HTML with optimized viewport configurations and styling
const KAKAO_MAP_HTML = `
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
      background-color: #0b132b;
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
      -webkit-text-size-adjust: 100%;
      -webkit-tap-highlight-color: rgba(0,0,0,0);
    }
    #map {
      touch-action: none; /* Passes all gestures directly to Kakao Map SDK */
    }
    #map img[src*="daumcdn.net"], 
    #map img[src*="maps.daumcdn.net"] {
      filter: grayscale(100%) opacity(0.8) contrast(1.1);
      will-change: filter;
      transform: translate3d(0, 0, 0); /* GPU acceleration */
    }
  </style>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_JS_API_KEY&autoload=false" onerror="handleScriptError()"></script>
  <script>
    var map;
    var markers = {};
    var userLocationMarker = null;

    function sendToRN(type, payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload || {} }));
      }
    }

    function handleScriptError() {
      sendToRN('SDK_LOAD_FAILED', { message: 'Kakao script failed to load' });
    }

    window.onload = function() {
      if (typeof kakao !== 'undefined' && kakao.maps) {
        kakao.maps.load(function() {
          var container = document.getElementById('map');
          var options = {
            center: new kakao.maps.LatLng(35.1795543, 129.0756416),
            level: 4
          };
          map = new kakao.maps.Map(container, options);
          map.setZoomable(true);

          kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
            sendToRN('MAP_CLICKED', {
              latitude: mouseEvent.latLng.getLat(),
              longitude: mouseEvent.latLng.getLng()
            });
          });

          sendToRN('MAP_READY');
        });
      } else {
        handleScriptError();
      }
    };

    window.updateUserLocation = function(lat, lng) {
      if (!map) return;
      var latLon = new kakao.maps.LatLng(lat, lng);
      if (!userLocationMarker) {
        var imageSize = new kakao.maps.Size(20, 20);
        var imageOption = { offset: new kakao.maps.Point(10, 10) };
        var markerImage = new kakao.maps.MarkerImage(
          'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="%23007AFF" stroke="white" stroke-width="2"/><circle cx="10" cy="10" r="10" fill="%23007AFF" opacity="0.3"/></svg>',
          imageSize,
          imageOption
        );
        userLocationMarker = new kakao.maps.Marker({ position: latLon, image: markerImage, clickable: false });
        userLocationMarker.setMap(map);
      } else {
        userLocationMarker.setPosition(latLon);
      }
    };

    window.updateSpots = function(spotsJson) {
      if (!map) return;
      for (var id in markers) { markers[id].setMap(null); }
      markers = {};
      var spots = JSON.parse(spotsJson);
      spots.forEach(function(spot) {
        var marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(spot.latitude, spot.longitude),
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
      map.panTo(new kakao.maps.LatLng(lat, lng));
      if (level) map.setLevel(level);
    };
  </script>
</head>
<body>
  <div id="map"></div>
</body>
</html>
`;

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  
  // Navigation focus state
  const isFocused = useIsFocused();

  const [index, setIndex] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSdkFailed, setIsSdkFailed] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);

  const spot = QUIET_SPOTS[index];

  // 1. Geolocation Watcher
  useEffect(() => {
    let active = true;
    async function startWatchingLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (loc) => {
          if (!active) return;
          const { latitude, longitude } = loc.coords;
          const injectScript = `if(window.updateUserLocation){window.updateUserLocation(${latitude},${longitude});};true;`;
          webViewRef.current?.injectJavaScript(injectScript);
        }
      );

      if (active) setLocationSubscription(subscription);
      else subscription.remove();
    }

    startWatchingLocation();
    return () => {
      active = false;
      locationSubscription?.remove();
    };
  }, []);

  // 2. Spots Synchronization
  useEffect(() => {
    if (isMapReady && !isSdkFailed) {
      const spotsData = QUIET_SPOTS.map((s) => ({
        id: s.id,
        name: s.name,
        latitude: s.pin.x * 0.05 + 35.17, // Mock coords projection
        longitude: s.pin.y * 0.05 + 129.07,
      }));
      const spotsJson = JSON.stringify(spotsData);
      const injectScript = `if(window.updateSpots){window.updateSpots('${spotsJson.replace(/'/g, "\\'")}');};true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [isMapReady, isSdkFailed]);

  // 3. Move Camera on Spot Change
  useEffect(() => {
    if (isMapReady && !isSdkFailed) {
      const lat = spot.pin.x * 0.05 + 35.17;
      const lng = spot.pin.y * 0.05 + 129.07;
      const injectScript = `if(window.focusSpot){window.focusSpot(${lat},${lng},4);};true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [index, isMapReady, isSdkFailed]);

  // 4. WebView Event Bridge Handler
  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      switch (message.type) {
        case 'MAP_READY':
          setIsMapReady(true);
          setIsSdkFailed(false);
          break;
        case 'SPOT_SELECTED':
          const foundIndex = QUIET_SPOTS.findIndex((s) => s.id === message.payload.id);
          if (foundIndex !== -1) {
            Haptics.selectionAsync();
            setIndex(foundIndex);
          }
          break;
        case 'SDK_LOAD_FAILED':
          setIsSdkFailed(true);
          break;
      }
    } catch (err) {
      console.warn('[WebView Bridge] Error parsing message:', err);
    }
  };

  const apiKey = process.env.EXPO_PUBLIC_KAKAO_MAP_API_KEY || 'MOCK_KEY';
  const htmlContent = KAKAO_MAP_HTML.replace('YOUR_JS_API_KEY', apiKey);

  // If loading failed (offline fallback)
  if (isSdkFailed) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.mapArea}>
          <Image source={require('@/assets/images/quiet-map.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <View style={[styles.mapTint, { backgroundColor: colors.foreground }]} />
          <View style={[styles.pinWrap, { left: `${spot.pin.x * 100}%` as const, top: `${spot.pin.y * 100}%` as const }]}>
            <View style={[styles.pinDot, { backgroundColor: colors.primary, borderColor: colors.card }]} />
          </View>
          <View style={[styles.headerOverlay, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.eyebrow}>[오프라인 모드] 오늘 가기 가장 조용한 곳</Text>
          </View>
        </View>
        {renderCard()}
      </View>
    );
  }

  // Active/Inactive Style Transition
  const webViewContainerStyle = isFocused ? styles.webViewContainerActive : styles.webViewContainerInactive;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.mapArea}>
        {/* The WebView wrapper container transitions style on blur/focus */}
        <View style={webViewContainerStyle}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent, baseUrl: 'https://haetae05.github.io' }}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={false} // Viewport lock
            style={styles.webView}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          />
        </View>
        
        <View style={[styles.headerOverlay, { paddingTop: insets.top + 12, position: 'absolute', top: 0, left: 0 }]}>
          <Text style={styles.eyebrow}>오늘 가기 가장 조용한 곳</Text>
        </View>
      </View>

      {renderCard()}
    </View>
  );

  function renderCard() {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]}>
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
  headerOverlay: { paddingHorizontal: 24, zIndex: 10 },
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
  
  // WebView layout transition states
  webViewContainerActive: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webViewContainerInactive: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    opacity: 0,
  },
  
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
    zIndex: 20,
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

---

## 4. Summary & Verification

By combining:
1. `detachInactiveScreens: false` (ensuring native layouts remain in memory),
2. Off-screen absolute transitions (`left: -9999`) on blur (preventing layout/WebGL teardowns),
3. Viewport lockdowns (`scalesPageToFit={false}`, `user-scalable=no`, and `touch-action: none`),

the Kakao Map WebView behaves like a native map component. It provides butter-smooth pan and zoom performance without interfering with mobile browser layouts, while guaranteeing that the Kakao Maps daily API quota is protected.
