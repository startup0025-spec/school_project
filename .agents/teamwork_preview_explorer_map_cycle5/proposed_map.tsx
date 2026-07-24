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
import { getPlaces, subscribeToPlacesCache } from '@/core_engine/src/database/local_places';
import { Place } from '@/core_engine/src/models/place_model';

// Inline HTML with optimized viewport configurations, grayscale filter, and event bridge
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
      background-color: #0b132b; /* Deep Indigo fallback */
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
      -webkit-text-size-adjust: 100%;
      -webkit-tap-highlight-color: rgba(0,0,0,0);
    }
    #map {
      touch-action: none; /* Passes all gestures directly to Kakao Map SDK */
    }
    /* Target ONLY map background tiles to avoid color distortion on custom markers or logos */
    #map img[src*="daumcdn.net"], 
    #map img[src*="maps.daumcdn.net"] {
      filter: grayscale(100%) opacity(0.8) contrast(1.1);
      will-change: filter;
      transform: translate3d(0, 0, 0); /* GPU acceleration */
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
            originalConsole.apply(originalConsole, arguments);
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

    // WebGL Context Loss listener
    window.addEventListener('webglcontextlost', function(e) {
      sendToRN('WEBGL_CONTEXT_LOST', {});
      e.preventDefault();
    }, false);
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
    var isMapFocused = true;

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
        center: new kakao.maps.LatLng(35.1978, 129.0837), // Default: Sebyeonggyo
        level: 5
      };
      
      map = new kakao.maps.Map(container, options);
      map.setZoomable(true);

      // Add click handler to notify native UI of empty space taps
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
    window.setIsFocused = function(focused) {
      isMapFocused = focused;
    };

    window.addEventListener('resize', function() {
      if (isMapFocused && map && map.relayout) {
        map.relayout();
      }
    });

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

    window.updateSpots = function(spotsJson) {
      if (!map) return;
      
      var spots = JSON.parse(spotsJson);
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

      // Clear removed markers
      for (var id in markers) {
        markers[id].setMap(null);
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

// Haversine distance helper (meters)
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
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
  if (userCoords && userCoords.latitude && userCoords.longitude) {
    const distance = getHaversineDistance(userCoords.latitude, userCoords.longitude, place.latitude, place.longitude);
    if (isNaN(distance)) {
      return '도보 15분';
    }
    const estimatedActualDistance = distance * 1.35; // Urban routing multiplier
    const minutes = Math.round(estimatedActualDistance / 65); // Realistic walking speed on Busan terrain
    if (isNaN(minutes) || minutes < 0) {
      return '도보 15분';
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

  // 4. Synchronize Spot Markers with WebView
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
        case 'WEBGL_CONTEXT_LOST':
          console.warn('[WebView] WebGL/Canvas context lost. Requesting map relayout.');
          webViewRef.current?.injectJavaScript(`if(map && map.relayout){map.relayout();};true;`);
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
