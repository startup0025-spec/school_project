# Anyway, the Sea (잔물결) - Kakao Map & UGC Pivot Final Implementation Plan

본 계획서는 **Anyway, the Sea (잔물결)** 모바일 앱 프로젝트의 Kakao Map 순정 복구, UGC 개인 일기장 피벗, 그리고 외주 길찾기 딥링크 연동을 위한 최종 아키텍처 및 코드 구현 계획입니다.

---

## 1. 순정 Kakao Map 복원 및 동적 SVG 마커 적용 계획

### 1.1 Grayscale 필터 스타일 제거
`mobile/app/(tabs)/map.tsx` 내의 HTML 템플릿인 `KAKAO_MAP_HTML`에서 타일을 흑백화하는 CSS 규칙을 제거하여 원래 지도의 화사한 색상과 렌더링 성능을 복원합니다.

**제거할 코드 블록 (`map.tsx` lines 38-44):**
```css
#map img[src*="daumcdn.net"], 
#map img[src*="maps.daumcdn.net"] {
  filter: grayscale(100%) opacity(0.8) contrast(1.1);
  will-change: filter;
  transform: translate3d(0, 0, 0);
}
```
**복원 후 코드 블록:**
```css
#map img[src*="daumcdn.net"], 
#map img[src*="maps.daumcdn.net"] {
  will-change: filter;
  transform: translate3d(0, 0, 0); /* GPU 가속 레이어 유지 */
}
```

### 1.2 동적 커스텀 SVG 마커 연동
테마 색상에 맞는 커스텀 마커 이미지를 렌더링하기 위해 SVG 데이터를 URI로 동적 변환하여 사용합니다. 마커 이미지 생성 시의 메모리 누수와 오버헤드를 막기 위해, `MarkerImage` 인스턴스를 전역에 선언하여 재사용합니다.

또한, URL 인코딩 시 `#` 기호가 중복 이스케이프되어 마커 색상이 정상적으로 나오지 않는 현상을 방지하기 위해 JavaScript SVG 템플릿에 literal `#`을 사용합니다.

**HTML `<script>` 태그 내 구현:**
```javascript
// 전역에 마커 이미지 캐시 선언 (메모리 누수 방지)
var activeMarkerImage = null;
var inactiveMarkerImage = null;
var markers = {};
var userLocationMarker = null;

function initMarkerImages() {
  var activeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">' +
    '<path d="M18 0C8.1 0 0 8.1 0 18c0 12.6 18 24 18 24s18-11.4 18-24c0-9.9-8.1-18-18-18zm0 25c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z" fill="#2F6F6B" stroke="white" stroke-width="2"/>' +
    '</svg>';

  var inactiveSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 30 36">' +
    '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 21 15 21s15-10.5 15-21c0-8.3-6.7-15-15-15zm0 21c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="#5A6E85" stroke="white" stroke-width="1.5"/>' +
    '</svg>';

  activeMarkerImage = new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(activeSvg),
    new kakao.maps.Size(36, 42),
    { offset: new kakao.maps.Point(18, 42) }
  );

  inactiveMarkerImage = new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(inactiveSvg),
    new kakao.maps.Size(30, 36),
    { offset: new kakao.maps.Point(15, 36) }
  );
}

window.updateSpots = function(spots, activeSpotId) {
  if (!map) return;
  if (!activeMarkerImage) {
    initMarkerImages();
  }
  
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

  // 제거된 마커들 클리어 및 리스너 해제
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

---

## 2. UGC 개인 일기장 피벗 및 상태 관리 계획

사용자가 지도 카드의 특정 장소에서 나만의 리뷰(기록)를 텍스트로 작성하면, 해당 텍스트와 장소의 정보를 `RippleContext`의 일기장 상태 데이터(`diaryEntries`)로 바인딩하여 AsyncStorage에 저장합니다.

### 2.1 RippleContext.tsx 구조 개편

1. **`DiaryEntry` 인터페이스 확장**:
   선택적 필드로 `placeId`와 `placeName`을 추가하여 기존에 저장된 데이터 형식과 완전히 하위 호환되도록 만듭니다.
2. **`addDiaryEntry` 서명 변경**:
   새로운 서명 `(customText?: string, placeId?: string, placeName?: string) => void`을 제공합니다.
3. **Optimistic State Update & Non-Blocking Write**:
   사용자 경험의 반응성을 최대화하기 위해 state를 동기적으로 선행 업데이트하고, AsyncStorage 쓰기 로직은 Promise 대기(await) 없이 백그라운드 스레드로 처리합니다.
4. **역사적 데이터 검증(Sanitization)**:
   AsyncStorage 로드 시 데이터 오염으로 인한 렌더링 에러를 예방하기 위해 타입 가드 필터링을 탑재합니다.

**`RippleContext.tsx` 구현안:**
```typescript
import { getPlaceByIdSync } from '@/core_engine/src/database/local_places';

export interface DiaryEntry {
  id: string;
  label: string;
  detail: string;
  placeId?: string;
  placeName?: string;
}

// RippleProvider 내의 addDiaryEntry
const addDiaryEntry = useCallback((
  customText?: string,
  placeId?: string,
  placeName?: string
) => {
  const label = formatTimeLabel(new Date());
  
  // 텍스트가 공백일 경우 기본 앰비언트 문구로 폴백
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
    
    // Optimistic Update: 백그라운드 비동기 영속화 (UI 쓰기 블로킹 방어)
    AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(next)).catch((e) =>
      console.warn('[RippleContext] 일기장 저장 에러:', e)
    );
    return next;
  });
}, [waterSource]);

// 일기장 초기 로딩 가드
useEffect(() => {
  AsyncStorage.getItem(DIARY_STORAGE_KEY)
    .then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            // Type Sanitization 가드로 런타임 크래시 방지
            const validEntries = parsed.filter(
              (entry) =>
                entry &&
                typeof entry.id === 'string' &&
                typeof entry.label === 'string' &&
                typeof entry.detail === 'string'
            );
            setDiaryEntries(validEntries);
          }
        } catch (e) {
          console.warn('[RippleContext] 일기 데이터 파싱 실패:', e);
        }
      }
    })
    .catch((e) => console.warn('[RippleContext] 일기장 로드 에러:', e));
}, []);
```

### 2.2 장소 카드 내 리뷰 작성 Modal 레이아웃 계획 (`map.tsx`)

지도 하단 장소 카드(`renderCard`)에 "기록하기" 단추를 구현하고, 탭했을 때 네이티브 입력창을 띄우는 모달 구조를 설계합니다. 키보드가 제출 단추를 덮는 현상을 해결하기 위해 `KeyboardAvoidingView`를 감싸 작은 화면 기기에서도 안전하게 폼을 조작할 수 있도록 보완합니다.

**`map.tsx` 상단에 추가할 React Native 컴포넌트 임포트:**
```typescript
import { Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
```

**`renderCard()` 함수 내 UI 결합안:**
```tsx
// MapScreen 컴포넌트 내 상태
const [isDiaryModalVisible, setIsDiaryModalVisible] = useState(false);
const [diaryText, setDiaryText] = useState('');

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
        
        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setIsDiaryModalVisible(true);
            }}
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="edit-3" size={14} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>기록하기</Text>
          </Pressable>
          
          <Pressable
            onPress={() => handleOpenDirections(currentPlace)}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="navigation" size={14} color="#FFFFFF" />
            <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>길찾기</Text>
          </Pressable>
        </View>
      </View>

      {/* UGC 감상 작성 Native Modal */}
      <Modal
        visible={isDiaryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDiaryModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
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
                style={[styles.modalBtn, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>취소</Text>
              </Pressable>
              
              <Pressable
                onPress={() => {
                  if (diaryText.trim().length === 0) {
                    Alert.alert('알림', '기록할 내용을 적어주세요.');
                    return;
                  }
                  addDiaryEntry(diaryText, currentPlace.id, currentPlace.name);
                  setIsDiaryModalVisible(false);
                  setDiaryText('');
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>기록 완료</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
```

**추가 스타일 정의 (`styles` StyleSheet):**
```typescript
const styles = StyleSheet.create({
  // ... 기존 스타일 ...
  buttonRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  actionBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 24, borderWidth: 1, padding: 24, gap: 16 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  modalInput: { height: 100, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, fontFamily: 'Inter_400Regular', textAlignVertical: 'top' },
  modalActionRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, minWidth: 80, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
```

---

## 3. 외부 "길찾기" (Navigation) 딥링크 및 패키지 가시성 계획

### 3.1 딥링크 라우팅 로직 구현

길찾기 버튼 액션 시, Kakao Map의 커스텀 딥링크 스키마를 통해 네이티브 앱 도보 길찾기 화면을 직접 호출합니다. 

* **Native App URI**: `kakaomap://route?ep=${lat},${lng}&epName=${encodeURIComponent(destinationName)}&by=FOOT`
* **Web Fallback URL**: `https://map.kakao.com/link/to/${encodeURIComponent(destinationName)},${lat},${lng}`
* **안전 예외 처리 가드**: 경위도 값이 비정상적인 값(`NaN`, `0`, `null`, `undefined`)일 때의 앱 크래시를 방지하기 위해 가드 조건을 적용합니다.

**`handleOpenDirections` 구현안:**
```typescript
const handleOpenDirections = async (place: Place) => {
  const { latitude, longitude, name } = place;

  // 1. 위경도 유효성 검증 가드 (Crash 방어)
  if (
    latitude === null || latitude === undefined || isNaN(latitude) ||
    longitude === null || longitude === undefined || isNaN(longitude) ||
    latitude === 0 || longitude === 0
  ) {
    Alert.alert('길찾기 실패', '장소의 위치 정보가 정확하지 않습니다.');
    return;
  }

  const ep = `${latitude},${longitude}`;
  const epName = encodeURIComponent(name); // 한글 장소명 URL-Encoding 보증
  const nativeUrl = `kakaomap://route?ep=${ep}&epName=${epName}&by=FOOT`;
  const webFallbackUrl = `https://map.kakao.com/link/to/${epName},${latitude},${longitude}`;

  try {
    const canOpen = await Linking.canOpenURL('kakaomap://');
    if (canOpen) {
      await Linking.openURL(nativeUrl);
    } else {
      await Linking.openURL(webFallbackUrl);
    }
  } catch (error) {
    console.warn('[MapScreen] Navigation failed, fallback to Web:', error);
    Linking.openURL(webFallbackUrl).catch((err) =>
      console.error('[MapScreen] Web fallback open failed:', err)
    );
  }
};
```

### 3.2 `app.json` 외부 쿼리 선언 (iOS & Android)

디바이스 쿼리 제한을 우회하여 `Linking.canOpenURL`이 기기의 앱 설치 상태를 정상 판단할 수 있도록 `app.json`에 관련 쿼리 필드를 추가합니다.

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "LSApplicationQueriesSchemes": [
          "kakaomap"
        ]
      }
    },
    "android": {
      "queries": [
        {
          "package": "net.daum.android.map"
        },
        {
          "intent": {
            "action": "android.intent.action.VIEW",
            "data": {
              "scheme": "kakaomap"
            }
          }
        }
      ]
    }
  }
}
```

---

## 4. 비동기 레이스 컨디션 및 캐시 일관성 방어 설계

### 4.1 local_places.ts 메모리 맵 캐싱 및 SWR 결합
실시간 지오펜싱 트래킹 이벤트 발생 시 디스크 I/O 병목을 해결하기 위해 메모리 기반 $O(1)$ 캐시 구조를 적용합니다. SWR의 실시간 동기화 상태와 백그라운드 재유효화(`revalidateData`) 동작 역시 보장하여 데이터 유실을 차단합니다.

**`local_places.ts` 개편안:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from '../models/place_model';

const CACHE_KEY = '@anywayTheSea:places_cache';
const CDN_URL = 'https://haetae05.github.io/Anyway_the_Sea/data/busan_places_master.json';

// In-Memory cache 변수 및 동기식 Lookup Map 선언
let inMemoryPlaces: Place[] | null = null;
const inMemoryMap = new Map<string, Place>();

// 모달 초기 로드 및 오프라인 첫 부팅 시의 fallback을 위한 seed 데이터 로딩
const bundledData = require('../../../assets/data/busan_places_master.json');

const updateInMemoryCache = (placesList: Place[]) => {
  inMemoryPlaces = placesList;
  inMemoryMap.clear();
  placesList.forEach((p) => inMemoryMap.set(p.id, p));
};

// 모듈 초기 구동 시 번들 데이터 기반으로 memory cache 동기 구성
if (bundledData && Array.isArray(bundledData.places)) {
  updateInMemoryCache(bundledData.places);
}

export const getPlaceByIdSync = (id: string): Place | null => {
  return inMemoryMap.get(id) || null;
};

export const getPlaces = async (): Promise<Place[]> => {
  const now = Date.now();
  if (!isRevalidating && now - lastFetchTime > FRESHNESS_THRESHOLD) {
    isRevalidating = true;
    lastFetchTime = now;
    revalidateData().finally(() => {
      isRevalidating = false;
    });
  }

  // 1. 메모리 캐시 사용
  if (inMemoryPlaces) {
    return inMemoryPlaces;
  }

  // 2. 디스크 캐시 사용
  try {
    const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && Array.isArray(parsed.places) && parsed.places.length > 0) {
        updateInMemoryCache(parsed.places);
        return parsed.places;
      }
    }
  } catch (error) {
    console.warn('[local_places] AsyncStorage read error:', error);
  }

  // 3. 번들 데이터 사용
  return bundledData.places || [];
};

async function revalidateData(): Promise<void> {
  try {
    const response = await fetch(CDN_URL, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    if (json && Array.isArray(json.places) && json.places.length > 0) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json));
      
      // Cache Consistency 보장: 메모리 캐시도 즉시 최신화
      updateInMemoryCache(json.places);
      notifyListeners(json.places);
    }
  } catch (error) {
    console.warn('[local_places] SWR revalidation failed:', error);
  }
}
```

### 4.2 WebView 렌더링 락 및 순차 로드 시퀀스 (`map.tsx`)
웹뷰가 장소 데이터를 그리거나 카메라 초점을 이동시키기 전, 캐시 데이터 로드가 끝났는지를 판단하는 플래그(`isPlacesLoaded`)와 맵 초기화 상태(`isMapReady`)를 동시 대조하여 런타임 Null 에러를 방어합니다.

두 개의 `useEffect`에 의해 마커 갱신과 뷰포트 정렬 스크립트가 꼬이는 레이스 컨디션을 막기 위해, 마커 동기화와 하이라이트 설정을 **단일 훅**으로 병합합니다.

**`map.tsx` 렌더링 동기화 훅:**
```typescript
const [places, setPlaces] = useState<Place[]>([]);
const [isPlacesLoaded, setIsPlacesLoaded] = useState(false);
const [isMapReady, setIsMapReady] = useState(false);

// 1. 초기 로드 시 places와 isPlacesLoaded 상태를 맞춤
useEffect(() => {
  async function initPlaces() {
    try {
      const data = await getPlaces();
      setPlaces(data && data.length > 0 ? data : QUIET_SPOTS);
    } catch (err) {
      setPlaces(QUIET_SPOTS);
    } finally {
      setIsPlacesLoaded(true);
    }
  }
  initPlaces();
}, []);

// 2. 단일 훅 결합: 맵 로딩, 데이터 준비, 액티브 핀 변경에 따른 동적 업데이트
useEffect(() => {
  if (!isPlacesLoaded || !isMapReady || isSdkFailed || places.length === 0) return;

  const spotsData = places.map((s) => ({
    id: s.id,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
  }));
  const activeSpotId = currentPlace?.id || null;

  // 마커를 새로 그리거나 activeSpotId 마커 이미지를 교체함
  const injectSpotsScript = `
    if(window.updateSpots){
      window.updateSpots(${JSON.stringify(spotsData)}, ${JSON.stringify(activeSpotId)});
    }
    true;
  `;
  webViewRef.current?.injectJavaScript(injectSpotsScript);

  // 카메라 포커싱도 순차적으로 한 번에 처리
  if (currentPlace) {
    const injectCameraScript = `
      if(window.focusSpot){
        window.focusSpot(${currentPlace.latitude},${currentPlace.longitude},5);
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(injectCameraScript);
  }
}, [isPlacesLoaded, isMapReady, isSdkFailed, places, activeIndex]);
```

### 4.3 Keep-Alive 백그라운드 리소스 동결 스크립트
비활성 탭 상태(`isFocused === false`)가 되면 GPU 및 CPU 연산 스레드를 동결하여 불필요한 배터리 소모를 완전 방지합니다.

**`map.tsx` focus 변경 훅:**
```typescript
useEffect(() => {
  if (!isMapReady) return;

  // 비활성화 시 requestAnimationFrame을 가짜 더미 함수로 바꿔서 루프 차단 및 visibility: hidden 적용
  const freezeScript = `
    if (!window.originalRAF) {
      window.originalRAF = window.requestAnimationFrame;
    }
    var mapContainer = document.getElementById('map');
    if (${isFocused}) {
      window.requestAnimationFrame = window.originalRAF;
      if (mapContainer) mapContainer.style.visibility = 'visible';
      if (map && map.relayout) map.relayout();
    } else {
      window.requestAnimationFrame = function() {}; // RAF freeze
      if (mapContainer) mapContainer.style.visibility = 'hidden'; // GPU 합성 제거
    }
    true;
  `;
  webViewRef.current?.injectJavaScript(freezeScript);
}, [isFocused, isMapReady]);
```

### 4.4 package.json dependency 누락 해결
동작 환경에서 빌드 시 타입 에러를 차단하기 위해 `mobile/package.json` 파일에 사용 중인 Expo 필수 모듈 의존성들을 선언해 둡니다.
```json
"dependencies": {
  "axios": "^1.6.0",
  "expo-av": "~14.0.0",
  "expo-file-system": "~17.0.0",
  "expo-task-manager": "~14.0.0",
  "expo-notifications": "~0.28.0"
}
```
