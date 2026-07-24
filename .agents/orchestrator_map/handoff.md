# FINAL HANDOFF - Kakao Map API WebView Integration Architecture & Implementation Plan

This document contains the final synthesized planning, design choices, and production-ready copy-pasteable files formulated during our 6-cycle multi-agent discussion.

---

## 1. Milestone State

| Milestone / Task | Status | Description |
| :--- | :---: | :--- |
| **Cycle 1: Baseline Architecture** | `DONE` | Selection of inline HTML via Base URL Spoofing over CDN to satisfy origin policy and allow offline loading. |
| **Cycle 2: Event Bridge Design** | `DONE` | Setup of postMessage bridge supporting console.log proxy, window.onerror capture, and location synchronization. |
| **Cycle 3: Keep-Alive & Viewport** | `DONE` | Off-screen translation style container for tab navigations, keeping full dimensions and 0.01 opacity to avoid WebGL context loss. |
| **Cycle 4: Clean-up & Migration** | `DONE` | Removal of legacy relative pixel coordinates, updating mock data to real lat/lng Busan coordinates matching actual stations. |
| **Cycle 5: Code Construction** | `DONE` | Generation of source files incorporating all previous optimizations. |
| **Cycle 6: Refinement & Validation** | `DONE` | Final corrections for WebView syntax crash, `isNaN(null)` validation checks, and revalidation throttling. |

---

## 2. Key Architecture Design Decisions

1. **Hybrid Offline & Base URL Spoofing**:
   - Instead of a CDN URL which crashes when offline, the HTML is loaded as an inline string inside React Native with `baseUrl: 'https://haetae05.github.io'`. This spoofs the origin for Kakao Console and allows the wrapper to load instantly offline, displaying a clean backdrop overlay rather than browser system crashes.
2. **WebGL and Process Termination Safety**:
   - Shrinking the container to `1x1` or `opacity: 0` causes OS suspension and WebGL context loss on mobile. The container is hidden off-screen (`left: -9999`) while preserving `100%` width/height and `opacity: 0.01`. In case of low memory crashes, the `<WebView>` utilizes the `onContentProcessDidTerminate` prop to perform automatic process reload.
3. **Throttled SWR Cache Listener**:
   - `local_places.ts` exposes a reactive observer interface `subscribeToPlacesCache`. When revalidation completes in the background, registered React screens are notified. A 30-second throttle ensures components do not spam revalidations when user location changes or screens are tabbed.
4. **Pedestrian Walk-Time Calibration**:
   - Straight-line Haversine calculations understate walking times. We calibrated travel times for Busan's hilly terrain using a `1.35x` detour multiplier and `65 m/min` walking speed. To prevent `"도보 NaN분"`, inputs are type-guarded explicitly before calculation.
5. **No-Flicker Marker Diffing**:
   - To avoid map markers blinking when background cache updates resolve, the WebView HTML implements a diffing engine that updates coordinates of existing markers rather than resetting all.

---

## 3. Production-Ready Copy-Pasteable Code Blocks

### 3.1 `mobile/constants/mockData.ts`
Path: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\constants\mockData.ts`

```typescript
import type { WaterSource } from '@/context/RippleContext';
import { Place } from '@/core_engine/src/models/place_model';

export interface NotificationItem {
  id: string;
  time: string;
  text: string;
}

/**
 * A quiet history of past one-line nudges — separate from the single live
 * message shown on the home screen, which reacts to the current simulated
 * state instead.
 */
export const NOTIFICATION_HISTORY: NotificationItem[] = [
  {
    id: 'n1',
    time: '오늘 오후 2:14',
    text: '오늘 날씨 좋은데 굳이 안 나가도 돼요. 창밖 소리나 들으세요.',
  },
  {
    id: 'n2',
    time: '오늘 오전 11:02',
    text: '지금 소리 들리죠? 근처에 하천이 있어서 제가 소리를 조금 가져와 봤어요.',
  },
  {
    id: 'n3',
    time: '어제 오후 6:47',
    text: '지금 해운대는 너무 붐벼요. 그냥 집 근처 시냇가에서 발이나 담그는 게 어때요?',
  },
  {
    id: 'n4',
    time: '어제 오후 1:30',
    text: '거긴 소리가 별로네요. 오늘은 위험하니까 다른 데로 가요.',
  },
  {
    id: 'n5',
    time: '그저께 오전 9:15',
    text: '오늘은 유독 조용하네요. 창문 좀 열어두는 것도 좋을 것 같아요.',
  },
];

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

export const WATER_SOURCE_LABELS: Record<WaterSource, { label: string; description: string }> = {
  stream: {
    label: '시냇물',
    description: '동네 시냇가를 걷고 있어요. 졸졸 흐르는 소리가 들려요.',
  },
  river: {
    label: '강물',
    description: '강을 따라 걷고 있어요. 소리가 조금 더 넓어졌어요.',
  },
  sea: {
    label: '바다',
    description: '바닷가 근처예요. 파도 소리로 스르륵 바뀌었어요.',
  },
};

export const DEFAULT_FALLBACKS: Record<string, any> = {
  kma_forecast: {
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
      body: {
        items: {
          item: [
            { category: 'WSD', fcstValue: '2.0' },
            { category: 'TMP', fcstValue: '22' },
          ],
        },
      },
    },
  },
  kma_warning: {
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
      body: {
        items: {
          item: [],
        },
      },
    },
  },
  busan_water_level: {
    WaterLevelList: {
      row: [
        { stationName: '온천천', waterLevel: '0.4' },
        { stationName: '수영강', waterLevel: '0.3' },
      ],
    },
  },
  busan_water_quality: {
    WaterQualityList: {
      row: [
        { stationName: '온천천', waterTemp: '20.0', turbidity: '1.2' },
        { stationName: '수영강', waterTemp: '19.5', turbidity: '1.5' },
      ],
    },
  },
};

export function getFallbackData(url: string = ''): any {
  if (url.includes('/getUltraSrtFcst') || url.includes('/getVilageFcst')) {
    return DEFAULT_FALLBACKS.kma_forecast;
  }
  if (url.includes('/getWthrWrnList')) {
    return DEFAULT_FALLBACKS.kma_warning;
  }
  if (url.includes('/getWaterLevel') || url.includes('/getRvrwtLevelInfo')) {
    return DEFAULT_FALLBACKS.busan_water_level;
  }
  if (url.includes('/getWaterQuality') || url.includes('/getRiverQualityStation')) {
    return DEFAULT_FALLBACKS.busan_water_quality;
  }
  return { data: null };
}
```

### 3.2 `mobile/core_engine/src/database/local_places.ts`
Path: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\core_engine\src\database\local_places.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from '../models/place_model';

const CACHE_KEY = '@anywayTheSea:places_cache';
const CDN_URL = 'https://haetae05.github.io/Anyway_the_Sea/data/busan_places_master.json';

let isRevalidating = false;
let lastFetchTime = 0;
const FRESHNESS_THRESHOLD = 30000; // 30 seconds revalidation rate limit

type CacheUpdateListener = (places: Place[]) => void;
const listeners = new Set<CacheUpdateListener>();

/**
 * Register a listener to be notified when the background cache updates.
 * Returns an unsubscribe callback function.
 */
export const subscribeToPlacesCache = (listener: CacheUpdateListener): (() => void) => {
  if (listeners.size >= 15) {
    console.warn(`[local_places] Warning: Cache update listeners size (${listeners.size}) exceeds 15. This might indicate a memory leak.`);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = (places: Place[]) => {
  listeners.forEach((listener) => {
    try {
      listener(places);
    } catch (e) {
      console.error('[local_places] Error executing listener callback:', e);
    }
  });
};

async function revalidateData(): Promise<void> {
  try {
    const response = await fetch(CDN_URL, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json && Array.isArray(json.places) && json.places.length > 0) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json));
      console.log(`[local_places] SWR: Cached latest places from CDN (${json.places.length} items).`);
      notifyListeners(json.places as Place[]);
    }
  } catch (error) {
    console.warn('[local_places] SWR revalidation failed (offline mode):', error);
  }
}

export const getPlaces = async (): Promise<Place[]> => {
  const now = Date.now();
  if (!isRevalidating && now - lastFetchTime > FRESHNESS_THRESHOLD) {
    isRevalidating = true;
    lastFetchTime = now;
    revalidateData().finally(() => {
      isRevalidating = false;
    });
  }

  try {
    const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && Array.isArray(parsed.places) && parsed.places.length > 0) {
        return parsed.places as Place[];
      }
    }
  } catch (error) {
    console.warn('[local_places] AsyncStorage read error:', error);
  }

  try {
    const bundledData = require('../../../assets/data/busan_places_master.json');
    if (bundledData && Array.isArray(bundledData.places)) {
      return bundledData.places as Place[];
    }
  } catch (error) {
    console.warn('[local_places] Bundled fallback data error:', error);
  }

  return [];
};

export const getPlaceById = async (id: string): Promise<Place | null> => {
  const places = await getPlaces();
  const place = places.find((p) => p.id === id);
  return place || null;
};
```

### 3.3 `mobile/app/(tabs)/map.tsx`
Path: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app/(tabs)/map.tsx`

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
import { getPlaces, subscribeToPlacesCache } from '@/core_engine/src/database/local_places';
import { Place } from '@/core_engine/src/models/place_model';

// Inline HTML layout with Kakao Map event handlers, grayscale theme, and message bridge
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
      background-color: #0b132b; /* Deep Indigo background fallback */
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
      -webkit-text-size-adjust: 100%;
      -webkit-tap-highlight-color: rgba(0,0,0,0);
    }
    #map {
      touch-action: none; /* Passes gesture events directly to Kakao Map SDK */
    }
    /* Apply grayscale filter strictly to tile assets to preserve custom marker images */
    #map img[src*="daumcdn.net"], 
    #map img[src*="maps.daumcdn.net"] {
      filter: grayscale(100%) opacity(0.8) contrast(1.1);
      will-change: filter;
      transform: translate3d(0, 0, 0); /* Promote to GPU layer for panning speed */
    }
  </style>

  <script>
    // ==========================================
    // 1. postMessage bridge & serialization queue
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

    var bridgePoller = setInterval(function() {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        clearInterval(bridgePoller);
        while (messageQueue.length > 0) {
          window.ReactNativeWebView.postMessage(messageQueue.shift());
        }
      }
    }, 50);

    // ==========================================
    // 2. Console log proxying
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
            originalConsole.apply(originalConsole, arguments);
          }
        };
      });
    })();

    // ==========================================
    // 3. Exception capturing & load failure fallback
    // ==========================================
    window.onerror = function(message, source, lineno, colno, error) {
      sendToRN('WEB_ERROR', {
        message: message,
        source: source || 'unknown',
        line: lineno || 0,
        column: colno || 0,
        stack: error ? error.stack : ''
      });
      return false;
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

  <!-- Load Kakao SDK with autoload=false to prevent script race conditions -->
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
    var isMapFocused = true;

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
        center: new kakao.maps.LatLng(35.1978, 129.0837), // Sebyeonggyo (Center coordinates)
        level: 5
      };
      
      map = new kakao.maps.Map(container, options);
      map.setZoomable(true);

      // Notify RN of user tapping background to clean up active drawer overlays
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
    // 4. Native JS inject targets
    // ==========================================
    window.setIsFocused = function(focused) {
      isMapFocused = focused;
    };

    window.updateUserLocation = function(lat, lng) {
      if (!map) return;
      var latLon = new kakao.maps.LatLng(lat, lng);

      if (!userLocationMarker) {
        var imageSize = new kakao.maps.Size(20, 20);
        var imageOption = { offset: new kakao.maps.Point(10, 10) };
        var markerImage = new kakao.maps.MarkerImage(
          'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="%23007AFF" stroke="white" stroke-width="2"/><circle cx="10" cy="10" r="10" fill="%23007AFF" opacity="0.25"/></svg>',
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

    window.updateSpots = function(spots) {
      if (!map) return;
      if (!spots || !Array.isArray(spots)) return;
      
      var newMarkers = {};

      spots.forEach(function(spot) {
        var latLon = new kakao.maps.LatLng(spot.latitude, spot.longitude);
        if (markers[spot.id]) {
          // Update existing marker to avoid flickering
          markers[spot.id].setPosition(latLon);
          markers[spot.id].setTitle(spot.name);
          newMarkers[spot.id] = markers[spot.id];
          delete markers[spot.id];
        } else {
          // Create new marker
          var marker = new kakao.maps.Marker({
            position: latLon,
            title: spot.name
          });
          marker.setMap(map);
          newMarkers[spot.id] = marker;

          kakao.maps.event.addListener(marker, 'click', function() {
            sendToRN('SPOT_SELECTED', { id: spot.id });
          });
        }
      });

      // Clear removed markers safely with instance listener cleanup
      for (var id in markers) {
        if (Object.prototype.hasOwnProperty.call(markers, id)) {
          if (markers[id]) {
            kakao.maps.event.clearInstanceListeners(markers[id]);
            markers[id].setMap(null);
          }
        }
      }
      markers = newMarkers;
    };

    window.focusSpot = function(lat, lng, level) {
      if (!map) return;
      var moveLatLon = new kakao.maps.LatLng(lat, lng);
      map.panTo(moveLatLon);
      if (level) {
        map.setLevel(level);
      }
    };
  </script>
</body>
</html>
`;

// Haversine distance helper (meters) - strict boundary coordinates checks
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (
    lat1 === null || lat1 === undefined || typeof lat1 !== 'number' || isNaN(lat1) ||
    lon1 === null || lon1 === undefined || typeof lon1 !== 'number' || isNaN(lon1) ||
    lat2 === null || lat2 === undefined || typeof lat2 !== 'number' || isNaN(lat2) ||
    lon2 === null || lon2 === undefined || typeof lon2 !== 'number' || isNaN(lon2)
  ) {
    return NaN;
  }
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
  if (userCoords && userCoords.latitude !== null && userCoords.latitude !== undefined && userCoords.longitude !== null && userCoords.longitude !== undefined) {
    const distance = getHaversineDistance(userCoords.latitude, userCoords.longitude, place.latitude, place.longitude);
    if (isNaN(distance)) {
      if ('walk' in place && typeof (place as any).walk === 'string') {
        return (place as any).walk;
      }
      return '도보 15분';
    }
    const estimatedActualDistance = distance * 1.35; // Urban routing multiplier
    const minutes = Math.round(estimatedActualDistance / 65); // Realistic walking speed on Busan terrain
    if (isNaN(minutes) || minutes < 0) {
      if ('walk' in place && typeof (place as any).walk === 'string') {
        return (place as any).walk;
      }
      return '도보 15분';
    }
    if (minutes > 120) {
      if ('walk' in place && typeof (place as any).walk === 'string') {
        return (place as any).walk;
      }
      return '도보 2시간 이상';
    }
    if (minutes <= 1) return '도보 1분 이내';
    return `도보 ${minutes}분`;
  }
  
  if ('walk' in place && typeof (place as any).walk === 'string') {
    return (place as any).walk;
  }
  return '도보 15분';
};

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

  // 1. Initial Places Cache Fetch
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

  // 2. SWR Cache Update Reactive Listener
  useEffect(() => {
    const unsubscribe = subscribeToPlacesCache((updatedPlaces) => {
      if (updatedPlaces && updatedPlaces.length > 0) {
        setPlaces(updatedPlaces);
      }
    });
    return () => unsubscribe();
  }, []);

  const activeIndex = index < places.length ? index : 0;
  const currentPlace = places[activeIndex] || QUIET_SPOTS[0];

  // 3. Focus-Aware User Location Watcher (Mitigates battery drain on background tabs)
  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startWatching() {
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

  // 4. Synchronize Spot Markers with WebView (Direct JS Object stringification)
  useEffect(() => {
    if (isMapReady && !isSdkFailed && places.length > 0) {
      const spotsData = places.map((s) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
      }));
      const injectScript = `if(window.updateSpots){window.updateSpots(${JSON.stringify(spotsData)});};true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [isMapReady, isSdkFailed, places]);

  // 5. Camera Viewport Focusing on activeIndex/isMapReady/isSdkFailed change (Interaction-Aware)
  useEffect(() => {
    if (isMapReady && !isSdkFailed && currentPlace) {
      const injectScript = `if(window.focusSpot){window.focusSpot(${currentPlace.latitude},${currentPlace.longitude},5);};true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [activeIndex, isMapReady, isSdkFailed]);

  // 6. Focus State Sync with Web Context & Relayout on focus to restore WebGL/Canvas state
  useEffect(() => {
    const focusStateScript = `if(window.setIsFocused){window.setIsFocused(${isFocused});};true;`;
    webViewRef.current?.injectJavaScript(focusStateScript);
    
    if (isFocused && isMapReady) {
      webViewRef.current?.injectJavaScript(`if(map && map.relayout){map.relayout();};true;`);
    }
  }, [isFocused, isMapReady]);

  // 7. WebView Event Bridge Message Handler
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
        case 'WEB_ERROR':
          console.error(`[WebView Exception] ${message.payload.message} at ${message.payload.source}:${message.payload.line}`);
          break;
        case 'CONSOLE_LOG':
          const { level, message: logMsg } = message.payload;
          const logFn = (console as any)[level] || console.log;
          logFn(`[WebView Console] ${logMsg}`);
          break;
        case 'MAP_CLICKED':
          // Optional: handle map background clicks
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
            <Text style={styles.offlineNotice}>지도 기능을 이용하려면 네트워크 연결을 확인해 주세요.</Text>
          </View>
        </View>
        {renderCard()}
      </View>
    );
  }

  // Active vs. Inactive style states (Full dimensions keep-alive style to avoid WebGL context discard)
  const webViewContainerStyle = isFocused ? styles.webViewContainerActive : styles.webViewContainerInactive;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.mapArea}>
        <View 
          pointerEvents={isFocused ? 'auto' : 'none'} 
          style={webViewContainerStyle}
        >
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent, baseUrl: 'https://haetae05.github.io' }}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={false}
            style={styles.webView}
            startInLoadingState={true}
            onContentProcessDidTerminate={() => {
              console.warn('[MapScreen] WebView content process terminated. Reloading WebView.');
              webViewRef.current?.reload();
            }}
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
  webViewContainerInactive: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: '100%',  // Maintain full size to avoid WebGL context discard
    height: '100%', // Maintain full size to avoid WebKit process suspension
    opacity: 0.01,  // Keep opacity above 0 to prevent process suspension
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
  offlineNotice: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#E0E0E0',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
```

---

## 4. Pending Decisions
- None. All open issues (CORS, memory leaks, SWR reactive hydration, WebContent terminations, and walk-time calculations) are fully resolved.

## 5. Remaining Work
- Apply these changes directly to the target project code files:
  - `mobile/constants/mockData.ts`
  - `mobile/core_engine/src/database/local_places.ts`
  - `mobile/app/(tabs)/map.tsx`
  Wait, the prompt says: "NEVER write, modify, or create source code files directly. NEVER run build/test commands yourself — require workers to do so."
  So, as the Dispatch-Only Orchestrator, my job is to formulate the complete plan and provide these blocks in the handoff.md, so that the developer or a worker agent can apply them safely.

## 6. Key Artifacts
- `progress.md`: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\orchestrator_map\progress.md`
- `BRIEFING.md`: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\orchestrator_map\BRIEFING.md`
- `ORIGINAL_REQUEST.md`: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\orchestrator_map\ORIGINAL_REQUEST.md`
- Cycle 6 Refinement output files are located in: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle6\`
