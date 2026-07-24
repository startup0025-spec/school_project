# Kakao Map Integration: Data Clean-up & Migration Plan (Cycle 4)

This analysis document formulates the design, implementation requirements, and verification plan for transitioning the Anyway, the Sea mobile map module from static mock coordinate rendering to a dynamic, production-grade Kakao Map API Integration utilizing the core engine's SWR data pattern.

---

## 1. Cleanup of Dummy Rendering Data

### 1.1 The Legacy Coordinate System
The current implementation in `app/(tabs)/map.tsx` relies on a relative, screen-percentage coordinate system:
- **Data Model**: `pin: { x: number; y: number }` in `QuietSpot` (with values like `{ x: 0.52, y: 0.4 }`).
- **Layout Method**: An absolute wrapper (`styles.pinWrap`) positioned using percentage values:
  ```typescript
  style={[
    styles.pinWrap,
    { left: `${spot.pin.x * 100}%` as const, top: `${spot.pin.y * 100}%` as const },
  ]}
  ```
- **Underlying Layout**: A static map illustration `quiet-map.png` serving as a backdrop, with a custom React Native pulsating circle overlayed on top.

### 1.2 The Cleanup Design
With the Kakao Map API WebView integration (Option A keep-alive), the map is rendered dynamically inside an HTML-based WebView. Marker placements, user location pins, and panning actions are managed directly by the Kakao Maps JavaScript SDK via geographic latitude and longitude coordinates. 

To clean up the dummy rendering data, we will perform the following steps:
1. **Remove `pin` from the interface**: Remove `pin: { x: number; y: number }` from the `QuietSpot` interface inside `mobile/constants/mockData.ts`.
2. **Remove `pin` from mock data arrays**: Remove all `pin` properties from elements in `QUIET_SPOTS`.
3. **Strip layout overlays in `map.tsx`**:
   - Delete the static backdrop `<Image source={require('@/assets/images/quiet-map.png')} ... />`.
   - Remove the `pinWrap` container `<View>` and its child elements (including the pulsating `Animated.View` and `pinDot` View).
   - Delete Reanimated hooks and shared values: `pulse`, `pulseStyle`, `withRepeat`, and `Easing`.
   - Delete styles: `pinWrap`, `pinPulse`, `pinDot` from the stylesheet.
4. **Offline Mode Fallback Design**:
   - If the Kakao SDK fails to load (`isSdkFailed === true`), the app falls back to an offline layout.
   - Without the `pin` coordinates, the app will render the static illustration `quiet-map.png` as a beautiful visual placeholder (without a physical dot) and overlay an explanatory notice: `"[오프라인 모드] 지도 기능을 이용하려면 네트워크 연결을 확인해 주세요."`
   - The location information card below will remain fully functional, displaying the fallback spot's name, description, and walking time. This avoids coordinate projection errors and ensures a polished, non-broken look.

---

## 2. Mock Data Update with Real coordinates

We will update the `QuietSpot` interface and `QUIET_SPOTS` array to use real `latitude` and `longitude` fields based on actual Busan coordinates near the water stations declared in `scripts/pipeline/data/water_stations.js`.

### 2.1 Water Stations Coordinates reference
From `water_stations.js`, we have verified the following real locations:
- **부곡교** (온천천, 금정구): `latitude: 35.2318`, `longitude: 129.0843`
- **세병교** (온천천, 연제구): `latitude: 35.1978`, `longitude: 129.0837`
- **이섭교** (온천천, 연제구): `latitude: 35.1851`, `longitude: 129.0756`
- **동천교** (수영강, 해운대구): `latitude: 35.1978`, `longitude: 129.1323`
- **세월교** (수영강, 해운대구): `latitude: 35.2031`, `longitude: 129.1198`

### 2.2 Alignment with the `Place` Model
To make mock data fully interchangeable with the core engine's place database, the `QuietSpot` interface is refactored to extend the core engine's `Place` model. The legacy `note` field is renamed to `description` to match `Place.description`.

### 2.3 Proposed Code Replacement for `mobile/constants/mockData.ts`

```typescript
import { Place } from '@/core_engine/src/models/place_model';

export interface QuietSpot extends Place {
  /** The walking time description (e.g. '도보 12분') - retained for mock backward compatibility */
  walk: string;
}

export const QUIET_SPOTS: QuietSpot[] = [
  {
    id: 's1',
    name: '수성천 산책로',
    description: '여기 지금 사람 아무도 없대요. 혹시 근처면 그냥 한 번 가보든가요.',
    walk: '도보 12분',
    latitude: 35.2031, // 세월교 (수영강)
    longitude: 129.1198,
    waterType: 'river',
    geofenceRadius: 4000,
    district: '해운대구',
    waterStationName: '세월교'
  },
  {
    id: 's2',
    name: '온천천 하류길',
    description: '오늘은 물소리가 유독 좋대요. 잠깐 들러도 괜찮을 것 같아요.',
    walk: '도보 18분',
    latitude: 35.1978, // 세병교 (온천천)
    longitude: 129.0837,
    waterType: 'river',
    geofenceRadius: 3000,
    district: '연제구',
    waterStationName: '세병교'
  },
  {
    id: 's3',
    name: '장전천 벤치',
    description: '사람도 없고 그늘도 있어서 앉아있기 딱 좋대요.',
    walk: '도보 9분',
    latitude: 35.2318, // 부곡교 (온천천/장전천 인근)
    longitude: 129.0843,
    waterType: 'stream',
    geofenceRadius: 3000,
    district: '금정구',
    waterStationName: '부곡교'
  },
];
```

---

## 3. Core Engine Alignment & SWR Loading Strategy

We align `map.tsx` with the core engine SWR loading strategy using `getPlaces()` from `core_engine/src/database/local_places.ts`.

### 3.1 SWR Loading Flow in `map.tsx`
At runtime, `map.tsx` will query `getPlaces()` which performs a dual-channel load:
1. Returns AsyncStorage cached places immediately (Stale).
2. Background revalidation queries the GitHub Pages CDN for the latest `busan_places_master.json`.
3. If no cache exists, it falls back to the bundled master JSON in `assets/data/`.
4. If `getPlaces()` returns non-empty places, `map.tsx` mounts them as markers.
5. If `getPlaces()` returns an empty array (due to network failure, corrupted local storage, or empty bundle), it gracefully falls back to the updated `QUIET_SPOTS` array containing real Busan coordinates.

```
       [map.tsx Mount]
              │
              ▼
      [Call getPlaces()]
              │
      ┌───────┴───────┐
      ▼               ▼
[Cache / CDN / Bundle] [Empty/Error]
  (Return Place[])       (Catch / None)
      │                       │
      ▼                       ▼
 [setPlaces(data)]   [setPlaces(QUIET_SPOTS)]
      │                       │
      └───────┬───────────────┘
              │
              ▼
    [Render Kakao Map]
```

### 3.2 Dynamic Walk Time Calculation
Since the core `Place` model does not contain a static `walk` field, we implement a dynamic calculation in `map.tsx`. When user location is available, we calculate the Haversine distance to the spot and compute walking minutes. If location is unavailable, we fallback to a default or static mock walking time.

```typescript
// Haversine distance helper (meters)
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate walk time dynamically or fallback
const getWalkTime = (place: Place, userCoords?: { latitude: number; longitude: number } | null): string => {
  if ('walk' in place) {
    return (place as any).walk; // Use mock field if available
  }
  if (userCoords) {
    const distance = getHaversineDistance(userCoords.latitude, userCoords.longitude, place.latitude, place.longitude);
    const minutes = Math.round(distance / 80); // Assuming 80 meters per minute (approx. 4.8 km/h)
    if (minutes <= 1) return '도보 1분 이내';
    return `도보 ${minutes}분`;
  }
  return '도보 15분'; // Default fallback
};
```

---

## 4. Proposed `MapScreen` Architecture for `map.tsx`

This snippet outlines how `map.tsx` will coordinate SWR data, location watchers, and the WebView communication bridge:

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Image, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';

import { useColors } from '@/hooks/useColors';
import { QUIET_SPOTS } from '@/constants/mockData';
import { getPlaces } from '@/core_engine/src/database/local_places';
import { Place } from '@/core_engine/src/models/place_model';

// Viewport lockdown & grey tap overlay removal styling
const KAKAO_MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <style>
    html, body, #map {
      width: 100%; height: 100%; margin: 0; padding: 0;
      background-color: #0b132b; overflow: hidden;
      -webkit-user-select: none; user-select: none;
      -webkit-tap-highlight-color: rgba(0,0,0,0);
    }
    #map { touch-action: none; }
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
      sendToRN('SDK_LOAD_FAILED');
    }

    window.onload = function() {
      if (typeof kakao !== 'undefined' && kakao.maps) {
        kakao.maps.load(function() {
          var container = document.getElementById('map');
          var options = {
            center: new kakao.maps.LatLng(35.1978, 129.0837), // Default Center near Sebyeonggyo
            level: 5
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

    window.updateUserLocation = function(lat, lng) {
      if (!map) return;
      var latLon = new kakao.maps.LatLng(lat, lng);
      if (!userLocationMarker) {
        var imageSize = new kakao.maps.Size(20, 20);
        var imageOption = { offset: new kakao.maps.Point(10, 10) };
        var markerImage = new kakao.maps.MarkerImage(
          'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="7" fill="%23007AFF" stroke="white" stroke-width="2"/><circle cx="10" cy="10" r="10" fill="%23007AFF" opacity="0.25"/></svg>',
          imageSize,
          imageOption
        );
        userLocationMarker = new kakao.maps.Marker({ position: latLon, image: markerImage, clickable: false });
        userLocationMarker.setMap(map);
      } else {
        userLocationMarker.setPosition(latLon);
      }
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
  const isFocused = useIsFocused();

  const [places, setPlaces] = useState<Place[]>([]);
  const [index, setIndex] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSdkFailed, setIsSdkFailed] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // 1. Load Places via SWR Strategy
  useEffect(() => {
    async function initPlaces() {
      try {
        const data = await getPlaces();
        if (data && data.length > 0) {
          setPlaces(data);
        } else {
          setPlaces(QUIET_SPOTS);
        }
      } catch (err) {
        console.warn('[MapScreen] Error loading places, falling back to mock:', err);
        setPlaces(QUIET_SPOTS);
      }
    }
    initPlaces();
  }, []);

  const currentPlace = places[index] || QUIET_SPOTS[0];

  // 2. User Location Watcher (Stops when screen blurred to avoid leaks)
  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startWatching() {
      if (!isFocused) return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (loc) => {
          if (!active) return;
          const { latitude, longitude } = loc.coords;
          setUserLocation({ latitude, longitude });
          
          const injectScript = `if(window.updateUserLocation){window.updateUserLocation(${latitude},${longitude});};true;`;
          webViewRef.current?.injectJavaScript(injectScript);
        }
      );
    }

    startWatching();

    return () => {
      active = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isFocused]);

  // 3. Inject Places Markers into WebView
  useEffect(() => {
    if (isMapReady && !isSdkFailed && places.length > 0) {
      const spotsData = places.map((s) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
      }));
      const spotsJson = JSON.stringify(spotsData);
      const injectScript = `if(window.updateSpots){window.updateSpots('${spotsJson.replace(/'/g, "\\'")}');};true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [isMapReady, isSdkFailed, places]);

  // 4. Pan map viewport on place focus change
  useEffect(() => {
    if (isMapReady && !isSdkFailed && currentPlace) {
      const injectScript = `if(window.focusSpot){window.focusSpot(${currentPlace.latitude},${currentPlace.longitude},5);};true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [index, isMapReady, isSdkFailed, currentPlace]);

  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      switch (message.type) {
        case 'MAP_READY':
          setIsMapReady(true);
          setIsSdkFailed(false);
          break;
        case 'SPOT_SELECTED':
          const foundIdx = places.findIndex((p) => p.id === message.payload.id);
          if (foundIdx !== -1) {
            Haptics.selectionAsync();
            setIndex(foundIdx);
          }
          break;
        case 'SDK_LOAD_FAILED':
          setIsSdkFailed(true);
          break;
      }
    } catch (err) {
      console.warn('[WebView Bridge] Parsing error:', err);
    }
  };

  const apiKey = process.env.EXPO_PUBLIC_KAKAO_MAP_API_KEY || 'MOCK_KEY';
  const htmlContent = KAKAO_MAP_HTML.replace('YOUR_JS_API_KEY', apiKey);

  if (isSdkFailed) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.mapArea}>
          <Image source={require('@/assets/images/quiet-map.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <View style={[styles.mapTint, { backgroundColor: colors.foreground }]} />
          <View style={[styles.headerOverlay, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.eyebrow}>[오프라인 모드] 오늘 가기 가장 조용한 곳</Text>
          </View>
        </View>
        {renderCard()}
      </View>
    );
  }

  const webViewContainerStyle = isFocused ? styles.webViewContainerActive : styles.webViewContainerInactive;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.mapArea}>
        <View style={webViewContainerStyle}>
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
        </View>
        <View style={[styles.headerOverlay, { paddingTop: insets.top + 12, position: 'absolute', top: 0, left: 0 }]}>
          <Text style={styles.eyebrow}>오늘 가기 가장 조용한 곳</Text>
        </View>
      </View>
      {renderCard()}
    </View>
  );

  function renderCard() {
    if (!currentPlace) return null;
    const walkTime = getWalkTime(currentPlace, userLocation);
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]}>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          점심시간이 지나고 가장 한가한 시간에 딱 한 곳만 추천드려요.
        </Text>
        <Text style={[styles.spotName, { color: colors.foreground }]}>{currentPlace.name}</Text>
        <Text style={[styles.spotNote, { color: colors.mutedForeground }]}>{currentPlace.description}</Text>
        <View style={styles.spotFooter}>
          <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{walkTime}</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setIndex((i) => (i + 1) % (places.length || QUIET_SPOTS.length));
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
  webViewContainerActive: { flex: 1, width: '100%', height: '100%' },
  webViewContainerInactive: { position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, opacity: 0 },
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

## 5. Migration Checklist & Action Plan

| Task ID | Component | Action Description | Target File | Status |
| :--- | :--- | :--- | :--- | :--- |
| **MIG-01** | Data Model | Redefine `QuietSpot` interface and align it with `Place` model | `mobile/constants/mockData.ts` | Proposed |
| **MIG-02** | Data Model | Remove relative `pin: {x,y}` property and update elements to include actual `latitude`/`longitude` matching `water_stations.js` | `mobile/constants/mockData.ts` | Proposed |
| **MIG-03** | View Layout | Clean up legacy React Native backdrop image, coordinate mapping wrappers (`pinWrap`), Reanimated values, and styling hooks | `mobile/app/(tabs)/map.tsx` | Proposed |
| **MIG-04** | Data Stream | Query core engine's SWR database `getPlaces()` inside `useEffect` hook, and fallback to `QUIET_SPOTS` when results are empty | `mobile/app/(tabs)/map.tsx` | Proposed |
| **MIG-05** | View Logic | Implement dynamic walk time calculation via Haversine distance when GPS coords are active | `mobile/app/(tabs)/map.tsx` | Proposed |
| **MIG-06** | View WebView | Load dynamic HTML page, inject place markers into map WebView, coordinate viewport focusing, and bind bridge events | `mobile/app/(tabs)/map.tsx` | Proposed |
