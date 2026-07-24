# Cycle 5 Kakao Map & UGC Pivot - Final Implementation Plan

This report presents the comprehensive final implementation plan for Cycle 5 of the Kakao Map & UGC Pivot in the *Anyway, the Sea* mobile app. It details the restoration of the pure Kakao Map, the UGC Personal Diary modal integration on the map card, and the walking navigation deep link integration. It also addresses BERRY's technical questions and proposes defensive patterns against asynchronous state loading race conditions.

---

## 1. Pure Kakao Map Restoration & Dynamic SVG Markers

### 1.1 Restoring Pure Map Tiles
To remove the dark/grayscale theme filter applied to the Kakao Map tiles and restore the colorful default styling of Kakao Map:
1. Locate the HTML string `KAKAO_MAP_HTML` inside `mobile/app/(tabs)/map.tsx`.
2. Delete the CSS rule that applies the grayscale filter to map images:
   ```css
   /* BEFORE */
   #map img[src*="daumcdn.net"], 
   #map img[src*="maps.daumcdn.net"] {
     filter: grayscale(100%) opacity(0.8) contrast(1.1);
     will-change: filter;
     transform: translate3d(0, 0, 0);
   }

   /* AFTER: CSS block is entirely deleted or changed to */
   #map img[src*="daumcdn.net"], 
   #map img[src*="maps.daumcdn.net"] {
     will-change: filter;
     transform: translate3d(0, 0, 0);
   }
   ```

### 1.2 Dynamic SVG Marker Styling via WebView Injected Scripts
Instead of static Kakao Map markers, the spots will be styled dynamically as custom SVG markers. When the active spot changes, the WebView updates the markers using injected JS to toggle between an "active" highlighted SVG and an "inactive" styled SVG.

Update the `updateSpots` function within `KAKAO_MAP_HTML`:
```javascript
var activeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">' +
  '<path d="M18 0C8.1 0 0 8.1 0 18c0 12.6 18 24 18 24s18-11.4 18-24c0-9.9-8.1-18-18-18zm0 25c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z" fill="%23007AFF" stroke="white" stroke-width="2"/>' +
  '</svg>';

var inactiveSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 30 36">' +
  '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 21 15 21s15-10.5 15-21c0-8.3-6.7-15-15-15zm0 21c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="%235A6E85" stroke="white" stroke-width="1.5"/>' +
  '</svg>';

window.updateSpots = function(spots, activeSpotId) {
  if (!map) return;
  if (!spots || !Array.isArray(spots)) return;
  
  var activeMarkerImage = new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(activeSvg),
    new kakao.maps.Size(36, 42),
    { offset: new kakao.maps.Point(18, 42) }
  );

  var inactiveMarkerImage = new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(inactiveSvg),
    new kakao.maps.Size(30, 36),
    { offset: new kakao.maps.Point(15, 36) }
  );

  var newMarkers = {};

  spots.forEach(function(spot) {
    var latLon = new kakao.maps.LatLng(spot.latitude, spot.longitude);
    var isSpotActive = spot.id === activeSpotId;
    var image = isSpotActive ? activeMarkerImage : inactiveMarkerImage;

    if (markers[spot.id]) {
      markers[spot.id].setPosition(latLon);
      markers[spot.id].setImage(image);
      markers[spot.id].setTitle(spot.name);
      newMarkers[spot.id] = markers[spot.id];
      delete markers[spot.id];
    } else {
      var marker = new kakao.maps.Marker({
        position: latLon,
        image: image,
        title: spot.name
      });
      marker.setMap(map);
      newMarkers[spot.id] = marker;

      kakao.maps.event.addListener(marker, 'click', function() {
        sendToRN('SPOT_SELECTED', { id: spot.id });
      });
    }
  });

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
```
In React Native `MapScreen`, the dynamic marker update effect is triggered when `places` or `activeIndex` changes:
```typescript
useEffect(() => {
  if (isPlacesLoaded && isMapReady && !isSdkFailed && places.length > 0) {
    const spotsData = places.map((s) => ({
      id: s.id,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
    }));
    const activeSpotId = currentPlace?.id || null;
    const injectScript = `if(window.updateSpots){window.updateSpots(${JSON.stringify(spotsData)}, "${activeSpotId}");};true;`;
    webViewRef.current?.injectJavaScript(injectScript);
  }
}, [isPlacesLoaded, isMapReady, isSdkFailed, places, activeIndex]);
```

---

## 2. UGC Personal Diary Pivot Integration

### 2.1 Updating `RippleContext.tsx`
Modify `DiaryEntry` interface and update `addDiaryEntry` to accept custom inputs while retaining ambient fallbacks for backward compatibility:

```typescript
export interface DiaryEntry {
  id: string;
  label: string;
  detail: string;
  placeId?: string;
  placeName?: string;
}

// In RippleContextValue interface:
addDiaryEntry: (customText?: string, placeId?: string, placeName?: string) => void;

// In RippleProvider implementation:
const addDiaryEntry = useCallback((
  customText?: string,
  placeId?: string,
  placeName?: string
) => {
  const label = formatTimeLabel(new Date());
  
  // UGC custom text fallback to ambient message if empty
  const detail = customText && customText.trim().length > 0 
    ? customText.trim() 
    : SOURCE_DIARY_DETAIL[waterSource];

  const entry: DiaryEntry = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    label,
    detail,
    ...(placeId ? { placeId } : {}),
    ...(placeName ? { placeName } : {}),
  };

  setDiaryEntries((prev) => {
    const next = [entry, ...prev];
    // Non-blocking optimistic write to AsyncStorage
    AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(next)).catch((e) =>
      console.warn('[RippleContext] 일기장 저장 에러:', e)
    );
    return next;
  });
}, [waterSource]);
```

### 2.2 Adding Native Text Input Modal in `map.tsx` Place Card
We add a button row in the place card `renderCard` containing "기록하기" (Log Diary) and "길찾기" (Directions). The "기록하기" button opens a native modal directly on the screen.

```tsx
// Inside MapScreen:
const { addDiaryEntry } = useRipple();
const [isDiaryModalVisible, setIsDiaryModalVisible] = useState(false);
const [diaryText, setDiaryText] = useState('');

// Inside renderCard():
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

      {/* Action Buttons: Directions & Diary Modal Trigger */}
      <View style={styles.actionButtonRow}>
        <Pressable
          onPress={() => handleOpenDirections(currentPlace)}
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
        >
          <Feather name="navigation" size={16} color="#FFF" />
          <Text style={styles.actionButtonText}>길찾기</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsDiaryModalVisible(true);
          }}
          style={[styles.actionButton, { backgroundColor: colors.secondary }]}
        >
          <Feather name="edit-3" size={16} color={colors.primary} />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>기록하기</Text>
        </Pressable>
      </View>

      {/* Native Modal for custom Diary Entry */}
      <Modal
        visible={isDiaryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDiaryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              📍 {currentPlace.name}에서의 생각 기록
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="지금 머물며 느낀 감상이나 소리를 적어보세요."
              placeholderTextColor={colors.mutedForeground}
              multiline={true}
              numberOfLines={4}
              maxLength={200}
              value={diaryText}
              onChangeText={setDiaryText}
            />
            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => {
                  setIsDiaryModalVisible(false);
                  setDiaryText('');
                }}
                style={[styles.modalButton, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.modalButtonText, { color: colors.foreground }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (diaryText.trim()) {
                    addDiaryEntry(diaryText, currentPlace.id, currentPlace.name);
                    setIsDiaryModalVisible(false);
                    setDiaryText('');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>기록 완료</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

---

## 3. Deep Linking & Routing Integration

### 3.1 Custom Scheme & Fallback Logic
When directions are requested, the app will check if the native Kakao Map scheme `kakaomap://` can be opened. If so, it launches walking navigation. If not, it opens the official web URL fallback in a browser.

```typescript
import { Linking, Alert } from 'react-native';

const handleOpenDirections = async (place: Place) => {
  const ep = `${place.latitude},${place.longitude}`;
  const epName = encodeURIComponent(place.name); // Correct URL-encoding
  const nativeUrl = `kakaomap://route?ep=${ep}&epName=${epName}&by=FOOT`;
  const webFallbackUrl = `https://map.kakao.com/link/to/${epName},${place.latitude},${place.longitude}`;

  try {
    const canOpen = await Linking.canOpenURL('kakaomap://');
    if (canOpen) {
      await Linking.openURL(nativeUrl);
    } else {
      await Linking.openURL(webFallbackUrl);
    }
  } catch (error) {
    console.warn('[MapScreen] Failed to open map URL:', error);
    Alert.alert('알림', '지도를 열 수 없습니다. 웹 주소로 재시도합니다.');
    Linking.openURL(webFallbackUrl).catch((err) =>
      console.error('[MapScreen] Fallback failed:', err)
    );
  }
};
```

---

## 4. Technical Explanations (Response to BERRY's Interrogations)

### 4.1 iOS `LSApplicationQueriesSchemes` configuration in `app.json`
* **Purpose**: Since iOS 9, Apple restricts apps from querying the presence of other third-party apps via custom URI schemes for privacy reasons. If `LSApplicationQueriesSchemes` is not defined in the application's configuration, calls to `Linking.canOpenURL('kakaomap://')` will silently return `false`, preventing the app from launching native navigation and forcing it to always open the web browser.
* **Layout**: To whitelist the scheme in Expo, it must be added to `app.json` under the `expo.ios.infoPlist` configuration:
  ```json
  "ios": {
    "infoPlist": {
      "LSApplicationQueriesSchemes": [
        "kakaomap"
      ]
    }
  }
  ```

### 4.2 URL-Encoding of `epName` Parameter
* **Critical Requirement**: Under URI generic syntax rules (RFC 3986), non-ASCII characters (such as Korean characters) are illegal in URI query strings. If a raw string like `세병교` is passed directly in the deep link parameters, the operating system or the target application (Kakao Map) will fail to parse the URI, resulting in silent failures, runtime crashes, or rendering broken character encoding (mojibake).
* **Implementation**: We must use JavaScript's built-in `encodeURIComponent()` function to percent-encode all custom spot/place names (e.g., `encodeURIComponent('세병교')` becomes `%EC%84%B8%EB%B3%91%EA%B5%90`).

### 4.3 AsyncStorage Non-Blocking UI Writes (Optimistic State Update Pattern)
* **Design Pattern**: Storing data on disk using `AsyncStorage.setItem()` is an asynchronous, I/O-bound promise operation. Waiting for this write to complete before updating the UI introduces significant UI lag (freeze). To deliver a smooth, zero-latency user experience, we use an **Optimistic Update Pattern**:
  1. **Immediate State Change**: Modify the React state `diaryEntries` immediately with the new entry structure. This instantly triggers a re-render, closing the diary modal and adding the entry to the list in under 16ms.
  2. **Asynchronous Background Write**: Fire the `AsyncStorage.setItem` call concurrently without `await` and catch exceptions using `.catch()`. If an error occurs, it is logged, and the user interface remains unaffected.
  ```typescript
  setDiaryEntries((prev) => {
    const next = [entry, ...prev];
    // Background write - non-blocking
    AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(next))
      .catch((e) => console.warn('[Storage Error]:', e));
    return next; // Return immediately to update UI
  });
  ```

---

## 5. Defense Logic for Asynchronous State Loading Race Conditions

### 5.1 In-Memory Map Caching in `local_places.ts`
To avoid repetitive, asynchronous disk reading and JSON deserialization from AsyncStorage, we introduce a static, in-memory Cache Map:

```typescript
// mobile/core_engine/src/database/local_places.ts

let inMemoryPlaces: Place[] | null = null;
const inMemoryMap = new Map<string, Place>();

// Rebuilds the fast O(1) memory lookup index
const updateInMemoryCache = (placesList: Place[]) => {
  inMemoryPlaces = placesList;
  inMemoryMap.clear();
  placesList.forEach((place) => {
    inMemoryMap.set(place.id, place);
  });
};

export const getPlaces = async (): Promise<Place[]> => {
  // 1. Check in-memory cache first
  if (inMemoryPlaces) {
    return inMemoryPlaces;
  }

  // 2. Fall back to AsyncStorage
  try {
    const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && Array.isArray(parsed.places)) {
        updateInMemoryCache(parsed.places);
        return parsed.places;
      }
    }
  } catch (error) {
    console.warn('[local_places] AsyncStorage error:', error);
  }

  // 3. Fall back to Bundled JSON Asset
  try {
    const bundledData = require('../../../assets/data/busan_places_master.json');
    if (bundledData && Array.isArray(bundledData.places)) {
      updateInMemoryCache(bundledData.places);
      return bundledData.places;
    }
  } catch (e) {
    console.warn('[local_places] Bundled JSON error:', e);
  }

  return [];
};

// High-speed, synchronous O(1) in-memory lookup
export const getPlaceByIdSync = (id: string): Place | null => {
  return inMemoryMap.get(id) || null;
};
```

### 5.2 WebView Marker Initialization Guard Sequence
To prevent race conditions where the WebView loads and attempts to update/focus markers before the AsyncStorage cache fetch returns, we design a strict initialization guard sequence:

1. **State Flags**: Define `isPlacesLoaded` alongside `isMapReady`:
   ```typescript
   const [places, setPlaces] = useState<Place[]>([]);
   const [isPlacesLoaded, setIsPlacesLoaded] = useState(false);
   const [isMapReady, setIsMapReady] = useState(false);
   ```
2. **Sequential Load Guard**:
   - Only fetch spots in `useEffect` and set `isPlacesLoaded = true` when done.
   - Guard the WebView marker loading effect:
     ```typescript
     useEffect(() => {
       // Only update spots when BOTH map is ready and places are fully loaded
       if (isPlacesLoaded && isMapReady && !isSdkFailed && places.length > 0) {
         const spotsData = places.map((s) => ({
           id: s.id,
           name: s.name,
           latitude: s.latitude,
           longitude: s.longitude,
         }));
         const injectScript = `if(window.updateSpots){window.updateSpots(${JSON.stringify(spotsData)});};true;`;
         webViewRef.current?.injectJavaScript(injectScript);
       }
     }, [isPlacesLoaded, isMapReady, isSdkFailed, places]);
     ```
   - Guard viewport camera centering:
     ```typescript
     useEffect(() => {
       if (isPlacesLoaded && isMapReady && !isSdkFailed && currentPlace) {
         const injectScript = `if(window.focusSpot){window.focusSpot(${currentPlace.latitude},${currentPlace.longitude},5);};true;`;
         webViewRef.current?.injectJavaScript(injectScript);
       }
     }, [isPlacesLoaded, activeIndex, isMapReady, isSdkFailed, currentPlace]);
     ```
3. **UI Blocking Overlay**:
   Do not render the interactive map components or places cards until `isPlacesLoaded` is true. An elegant Calm UX loading screen (blur or spinner) is shown to shield the user from empty/invalid map views.
