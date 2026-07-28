import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Image, Pressable, Linking, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as Location from 'expo-location';

let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColors } from '@/hooks/useColors';
import { QUIET_SPOTS } from '@/constants/mockData';
import { getPlaces, subscribeToPlacesCache } from '@/core_engine/src/database/local_places';
import { Place } from '@/core_engine/src/models/place_model';
import { useRipple } from '@/context/RippleContext';
import {
  getHaversineDistance,
  sortPlacesByDistance,
  isValidCoordinate,
} from '@/core_engine/src/utils/haversine';

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
    #map img[src*="daumcdn.net"], 
    #map img[src*="maps.daumcdn.net"] {
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

    var bridgePollerCount = 0;
    var bridgePoller = setInterval(function() {
      bridgePollerCount++;
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        clearInterval(bridgePoller);
        while (messageQueue.length > 0) {
          window.ReactNativeWebView.postMessage(messageQueue.shift());
        }
      } else if (bridgePollerCount >= 200) {
        clearInterval(bridgePoller);
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

    window.updateSpots = function(spots, activeSpotId) {
      if (!map) return;
      if (!spots || !Array.isArray(spots)) return;
      
      var newMarkers = {};

      spots.forEach(function(spot) {
        var latLon = new kakao.maps.LatLng(spot.latitude, spot.longitude);
        var isActive = (activeSpotId === spot.id);
        
        var imageSize = new kakao.maps.Size(24, 35);
        var imageOption = { offset: new kakao.maps.Point(12, 35) };
        var svgStr = isActive 
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="35" viewBox="0 0 24 35"><path fill="%23007AFF" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 23 12 23s12-14 12-23c0-6.6-5.4-12-12-12zm0 17c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="35" viewBox="0 0 24 35"><path fill="%2394a3b8" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 23 12 23s12-14 12-23c0-6.6-5.4-12-12-12zm0 17c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>';
        var markerImage = new kakao.maps.MarkerImage('data:image/svg+xml;charset=UTF-8,' + svgStr, imageSize, imageOption);

        if (markers[spot.id]) {
          // Update existing marker to avoid flickering
          markers[spot.id].setPosition(latLon);
          markers[spot.id].setTitle(spot.name);
          markers[spot.id].setImage(markerImage);
          newMarkers[spot.id] = markers[spot.id];
          delete markers[spot.id];
        } else {
          // Create new marker
          var marker = new kakao.maps.Marker({
            position: latLon,
            title: spot.name,
            image: markerImage
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
  const webViewRef = useRef<InstanceType<typeof WebView>>(null);
  const isFocused = useIsFocused();
  const { addDiaryEntry } = useRipple();

  const [places, setPlaces] = useState<Place[]>([]);
  const [index, setIndex] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSdkFailed, setIsSdkFailed] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [diaryModalVisible, setDiaryModalVisible] = useState(false);
  const [diaryText, setDiaryText] = useState('');

  const SORT_COOLDOWN_MS = 180000;
  const lastSortTimeRef = useRef<number>(0);
  const indexRef = useRef<number>(index);
  indexRef.current = index;
  const placesRef = useRef<Place[]>(places);
  placesRef.current = places;
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(userLocation);
  userLocationRef.current = userLocation;

  // 1. Initial Places Cache Fetch & Background Location Read (R1, R2)
  useEffect(() => {
    async function initPlaces() {
      try {
        const data = await getPlaces();
        const initialPlaces = data && data.length > 0 ? data : QUIET_SPOTS;

        const storedStateRaw = await AsyncStorage.getItem('@anywayTheSea:bg_location_state');
        if (storedStateRaw) {
          const storedState = JSON.parse(storedStateRaw);
          if (
            storedState?.lastLatitude != null &&
            storedState?.lastLongitude != null &&
            isValidCoordinate(storedState.lastLatitude, storedState.lastLongitude)
          ) {
            const { lastLatitude, lastLongitude } = storedState;
            setUserLocation({ latitude: lastLatitude, longitude: lastLongitude });

            const sortedPlaces = sortPlacesByDistance(initialPlaces, {
              latitude: lastLatitude,
              longitude: lastLongitude,
            });

            setPlaces(sortedPlaces);
            setIndex(0);
            lastSortTimeRef.current = Date.now();
            return;
          }
        }

        setPlaces(initialPlaces);
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
        const currentLocation = userLocationRef.current;
        const currentPlaces = placesRef.current;
        const currentSelectedId = currentPlaces[indexRef.current]?.id;

        if (currentLocation && isValidCoordinate(currentLocation.latitude, currentLocation.longitude)) {
          const sorted = sortPlacesByDistance(updatedPlaces, currentLocation);
          const newIdx = currentSelectedId ? sorted.findIndex((p) => p.id === currentSelectedId) : -1;
          setPlaces(sorted);
          setIndex(newIdx !== -1 ? newIdx : 0);
        } else {
          const newIdx = currentSelectedId ? updatedPlaces.findIndex((p) => p.id === currentSelectedId) : -1;
          setPlaces(updatedPlaces);
          setIndex(newIdx !== -1 ? newIdx : 0);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const activeIndex = index >= 0 && index < places.length ? index : 0;
  const currentPlace = places[activeIndex] || QUIET_SPOTS[0];

  // 3. Focus-Aware User Location Watcher (R3: 3-min cooldown & safe activeIndex management)
  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startWatching() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) return;

      const sub = await Location.watchPositionAsync(
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

          // R3: 3-minute cooldown re-sorting & safe activeIndex preservation
          const now = Date.now();
          if (lastSortTimeRef.current === 0 || now - lastSortTimeRef.current >= SORT_COOLDOWN_MS) {
            const currentPlaces = placesRef.current;
            if (currentPlaces && currentPlaces.length > 0) {
              const currentSelectedId = currentPlaces[indexRef.current]?.id;
              const sorted = sortPlacesByDistance(currentPlaces, { latitude, longitude });
              const newIdx = currentSelectedId ? sorted.findIndex((p) => p.id === currentSelectedId) : -1;

              setPlaces(sorted);
              setIndex(newIdx !== -1 ? newIdx : 0);
              lastSortTimeRef.current = now;
            }
          }
        }
      );

      if (!active) {
        sub.remove();
      } else {
        subscription = sub;
      }
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
      const activeSpotId = currentPlace?.id || null;
      const injectScript = `if(window.updateSpots){window.updateSpots(${JSON.stringify(spotsData)}, ${JSON.stringify(activeSpotId)});};true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [isMapReady, isSdkFailed, places, activeIndex]);

  // 5. Camera Viewport Focusing on activeIndex/isMapReady/isSdkFailed change (Interaction-Aware)
  useEffect(() => {
    if (isMapReady && !isSdkFailed && currentPlace) {
      const injectScript = `if(window.focusSpot){window.focusSpot(${currentPlace.latitude},${currentPlace.longitude},5);};true;`;
      webViewRef.current?.injectJavaScript(injectScript);
    }
  }, [activeIndex, isMapReady, isSdkFailed, places]);

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

  const handleDeepLink = async () => {
    if (!currentPlace) return;
    const { name, latitude, longitude } = currentPlace;
    const urlEncodedName = encodeURIComponent(name);
    const schemeUrl = `kakaomap://route?ep=${latitude},${longitude}&epName=${urlEncodedName}&by=FOOT`;
    const webFallbackUrl = `https://map.kakao.com/link/to/${urlEncodedName},${latitude},${longitude}`;

    try {
      const canOpen = await Linking.canOpenURL('kakaomap://');
      if (canOpen) {
        await Linking.openURL(schemeUrl);
      } else {
        await Linking.openURL(webFallbackUrl);
      }
    } catch (error) {
      console.warn('[MapScreen] Deep link error, falling back to web:', error);
      await Linking.openURL(webFallbackUrl);
    }
  };

  const handleSaveDiary = () => {
    if (!currentPlace) return;
    if (diaryText.trim().length === 0) {
      Alert.alert('알림', '기록할 내용을 적어주세요.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addDiaryEntry(diaryText, currentPlace.id, currentPlace.name);
    setDiaryModalVisible(false);
    setDiaryText('');
  };

  const apiKey = process.env.EXPO_PUBLIC_KAKAO_MAP_API_KEY || 'MOCK_KEY';
  if (apiKey === 'MOCK_KEY') {
    console.warn('[MapScreen] EXPO_PUBLIC_KAKAO_MAP_API_KEY is missing. Using MOCK_KEY which will cause a 401 error.');
  }
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
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={htmlContent}
              style={{ width: '100%', height: '100%', border: 'none' } as any}
              title="Kakao Map"
            />
          ) : (
            WebView && (
              <WebView
                ref={webViewRef}
                source={{ html: htmlContent, baseUrl: 'https://startup0025-spec.github.io' }}
                originWhitelist={['*']}
                mixedContentMode="always"
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
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
            )
          )}
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
      <>
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
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => setDiaryModalVisible(true)} style={styles.actionButton}>
              <Feather name="edit-3" size={14} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>기록하기</Text>
            </Pressable>
            <Pressable onPress={handleDeepLink} style={styles.actionButton}>
              <Feather name="map" size={14} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>길찾기</Text>
            </Pressable>
            {process.env.EXPO_PUBLIC_BUILD_MODE !== 'PRODUCTION' && (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setIndex((i) => (i + 1) % (places.length || QUIET_SPOTS.length));
                }}
                style={styles.refreshButton}
                testID="next-spot"
              >
                <Feather name="refresh-ccw" size={14} color={colors.primary} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <Modal 
        visible={diaryModalVisible} 
        animationType="fade" 
        transparent={true}
        onRequestClose={() => setDiaryModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{currentPlace?.name}에서의 기록</Text>
            <TextInput
              style={[styles.diaryInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="이곳에서의 감상을 남겨보세요..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              value={diaryText}
              onChangeText={setDiaryText}
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setDiaryModalVisible(false)} style={styles.modalCancel}>
                <Text style={{ color: colors.mutedForeground }}>취소</Text>
              </Pressable>
              <Pressable onPress={handleSaveDiary} style={[styles.modalSave, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.primaryForeground }}>저장</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  refreshButton: { padding: 4 },
  offlineNotice: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#E0E0E0',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 16, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  diaryInput: { height: 120, borderWidth: 1, borderRadius: 8, padding: 12, textAlignVertical: 'top', fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalSave: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});
