# Kakao Map & UGC Pivot Cycle 1 분석 보고서

본 보고서는 **Anyway, the Sea (잔물결)** 프로젝트의 1단계 Kakao Map 및 UGC 피벗 구현 계획에 따른 탐색 결과를 정리한 것입니다. 코드베이스를 수정하지 않고 분석만 수행했습니다.

---

## 1. Kakao Map Grayscale 필터 분석 및 제거 방법 (Task 1)

### 1.1 대상 파일 및 라인
- **파일 경로**: `mobile/app/(tabs)/map.tsx`
- **대상 코드**: `lines 38-44` (CSS Style Block 내 타일 커스텀 필터)

### 1.2 코드 상태 분석
`map.tsx` 파일 내 인라인 HTML 상수 `KAKAO_MAP_HTML` 정의부에 다음과 같은 CSS 코드가 존재하여 Kakao Map 타일을 회색(grayscale) 톤으로 만들고 있습니다.
```css
38:     /* Apply grayscale filter strictly to tile assets to preserve custom marker images */
39:     #map img[src*="daumcdn.net"], 
40:     #map img[src*="maps.daumcdn.net"] {
41:       filter: grayscale(100%) opacity(0.8) contrast(1.1);
42:       will-change: filter;
43:       transform: translate3d(0, 0, 0); /* Promote to GPU layer for panning speed */
44:     }
```

### 1.3 제거 및 주석 처리 방법
오리지널 지도의 색상을 복원하기 위해 해당 CSS 스타일 설정을 무력화해야 합니다. 다음과 같은 세 가지 접근 방식 중 선택할 수 있습니다:

1. **전체 스타일 블록 주석 처리 (권장)**: CSS 타일 이미지에 불필요한 GPU 렌더링 전환(`transform`, `will-change`)과 opacity/contrast 필터를 모두 제거하여 순수 지도로 복구합니다.
   ```css
   /* Apply grayscale filter strictly to tile assets to preserve custom marker images */
   /*
   #map img[src*="daumcdn.net"], 
   #map img[src*="maps.daumcdn.net"] {
     filter: grayscale(100%) opacity(0.8) contrast(1.1);
     will-change: filter;
     transform: translate3d(0, 0, 0);
   }
   */
   ```
2. **필터 속성만 개별 주석 처리**: 타일의 렌더링 성능 최적화 옵션(GPU 레이어 격리)은 남겨두고 색상 필터링만 해제합니다.
   ```css
   #map img[src*="daumcdn.net"], 
   #map img[src*="maps.daumcdn.net"] {
     /* filter: grayscale(100%) opacity(0.8) contrast(1.1); */
     will-change: filter;
     transform: translate3d(0, 0, 0); /* Promote to GPU layer for panning speed */
   }
   ```

---

## 2. 동적 테마 색상 전달 및 커스텀 SVG 마커 구현 (Task 2)

### 2.1 useColors() 동적 테마 색상 WebView 연동

`mobile/hooks/useColors.ts`는 기기의 라이트/다크 모드에 맞춰 `mobile/constants/colors.ts`에 정의된 색상 팔레트(`colors.light` 등)를 반환하는 역할을 수행합니다.

이 테마 색상을 WebView에 동적으로 전달하려면 **React Native -> WebView JavaScript Bridge**를 활용해야 합니다. `MapScreen` 내에 `colors` 상태의 변화를 감지하여 WebView 내부로 테마 객체를 주입해 주는 `useEffect` 훅을 구현합니다.

```typescript
// mobile/app/(tabs)/map.tsx 내 MapScreen 컴포넌트 내부 추가 제안

const colors = useColors();

useEffect(() => {
  if (isMapReady && !isSdkFailed) {
    const themeColors = {
      primary: colors.primary,
      secondary: colors.secondary,
      accent: colors.accent,
      background: colors.background,
      foreground: colors.foreground,
      mutedForeground: colors.mutedForeground,
      border: colors.border
    };
    
    // WebView 전역 window 객체에 테마 색상 주입
    // 주입 후 기존 마커들을 새로 고침하여 동적으로 테마 색상을 반영하도록 함
    const injectColorsScript = `
      window.themeColors = ${JSON.stringify(themeColors)};
      if (window.updateSpots && window.lastSpots) {
        window.updateSpots(window.lastSpots);
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(injectColorsScript);
  }
}, [colors, isMapReady, isSdkFailed]);
```

### 2.2 updateSpots를 통한 동적 SVG 마커 생성 프로포절

WebView 내부의 `window.updateSpots` 함수에서 주입된 `window.themeColors` 값을 읽어와 인라인 SVG의 `fill` 및 `stroke` 색상에 바인딩합니다. 

```javascript
// map.tsx 내 KAKAO_MAP_HTML의 window.updateSpots 함수 개선 제안

window.updateSpots = function(spots) {
  if (!map) return;
  if (!spots || !Array.isArray(spots)) return;
  
  // 테마 변경 시 재사용을 위해 spots 캐싱
  window.lastSpots = spots;
  
  var newMarkers = {};
  
  // 주입된 테마 색상 가져오기 (기본값 설정 포함)
  var theme = window.themeColors || { primary: '#2F6F6B', accent: '#C9A876' };

  spots.forEach(function(spot) {
    var latLon = new kakao.maps.LatLng(spot.latitude, spot.longitude);
    
    // 1. 동적 테마 색상을 적용한 SVG 마커 문자열 구성
    // (URI 인코딩을 위해 hex의 # 기호는 %23으로 표기하거나 encodeURIComponent 사용)
    var svgString = 
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">' +
      '  <path d="M16 0C7.2 0 0 7.2 0 16c0 11.2 14.5 22.8 15.1 23.3a1.2 1.2 0 0 0 1.8 0C17.5 38.8 32 27.2 32 16 32 7.2 24.8 0 16 0z" fill="' + theme.primary + '" stroke="#FFFFFF" stroke-width="2"/>' +
      '  <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>' +
      '</svg>';

    var imageSize = new kakao.maps.Size(32, 40);
    var imageOption = { offset: new kakao.maps.Point(16, 40) };
    
    // 2. Data URI 형태로 MarkerImage 객체 인스턴스화
    var markerImage = new kakao.maps.MarkerImage(
      'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString),
      imageSize,
      imageOption
    );

    if (markers[spot.id]) {
      // 기존 마커 업데이트 (flickering 예방)
      markers[spot.id].setPosition(latLon);
      markers[spot.id].setTitle(spot.name);
      markers[spot.id].setImage(markerImage); // 변경된 테마 이미지 적용
      newMarkers[spot.id] = markers[spot.id];
      delete markers[spot.id];
    } else {
      // 신규 마커 생성
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

  // 제거된 마커 클리어 및 리스너 해제
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

## 3. 외부 "길찾기" (Navigation) 딥링크 구현 계획 (Task 3)

### 3.1 React Native Linking을 활용한 분기 로직

카카오맵 앱 스키마(`kakaomap://`)를 통해 네이티브 길찾기를 시도하고, 앱 미설치 기기일 경우 웹 브라우저(`https://map.kakao.com/`)로 경로 탐색을 띄우는 이중 폴백 구조를 구현합니다.

- **App Deep Link URI**:
  `kakaomap://route?sp=&ep=${latitude},${longitude}&by=FOOT&en=${encodeURIComponent(destinationName)}`
  - `sp=`: 출발지는 공백으로 두어 사용자의 실시간 현재 위치를 기본값으로 사용합니다.
  - `by=FOOT`: 걷는 여정에 알맞은 도보(FOOT) 길찾기 모드를 타깃으로 삼습니다. (필요 시 CAR 또는 PUBLICTRANSIT로 대체 가능)
- **Web Fallback URL**:
  `https://map.kakao.com/link/to/${encodeURIComponent(destinationName)},${latitude},${longitude}`

```typescript
// mobile/app/(tabs)/map.tsx 상단에 import 추가
import { Linking, Alert } from 'react-native';

// MapScreen 컴포넌트 내부에 길찾기 공통 함수 정의
const openKakaoMapNavigation = async (latitude: number, longitude: number, destinationName: string) => {
  const appUrl = `kakaomap://route?ep=${latitude},${longitude}&by=FOOT&en=${encodeURIComponent(destinationName)}`;
  const webUrl = `https://map.kakao.com/link/to/${encodeURIComponent(destinationName)},${latitude},${longitude}`;

  try {
    // 1. 카카오맵 앱 호출 가능 여부 조회
    const canOpen = await Linking.canOpenURL('kakaomap://');
    if (canOpen) {
      await Linking.openURL(appUrl);
    } else {
      // 2. 미설치 시 웹 브라우저 fallback 이동
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    console.warn('[Navigation] App open failed, falling back to Web URL:', error);
    try {
      await Linking.openURL(webUrl);
    } catch (webError) {
      console.error('[Navigation] Web open failed:', webError);
      Alert.alert('길찾기 실패', '지도 링크를 열 수 없습니다. 브라우저 권한 설정을 확인해 주세요.');
    }
  }
};
```

### 3.2 필수 플랫폼 연동 설정 (iOS LSApplicationQueriesSchemes)

**중요한 제약 사항**:
iOS 9 이상 환경에서는 `Linking.canOpenURL()`이 특정 커스텀 URL 스키마에 대해 정상작동하도록 하기 위해, iOS `Info.plist`에 해당 스키마를 사전에 명시해 두어야 합니다. 누락될 경우 앱이 깔려있음에도 항상 `canOpenURL`이 `false`를 리턴해 웹 브라우저로만 실행됩니다.

- **Expo 프로젝트 설정 변경 (`app.json`)**:
  ```json
  {
    "expo": {
      "ios": {
        "infoPlist": {
          "LSApplicationQueriesSchemes": [
            "kakaomap"
          ]
        }
      }
    }
  }
  ```

### 3.3 Place Card UI 컴포넌트 마운트 연동

`map.tsx` 하단 `renderCard()` 함수에 '길찾기' 버튼 인터랙션을 추가합니다.

```typescript
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
        
        {/* 길찾기 & 리프레시 버튼 행 */}
        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              openKakaoMapNavigation(currentPlace.latitude, currentPlace.longitude, currentPlace.name);
            }}
            style={styles.navButton}
          >
            <Feather name="navigation" size={14} color={colors.primary} />
            <Text style={[styles.navText, { color: colors.primary }]}>길찾기</Text>
          </Pressable>

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
    </View>
  );
}

// 스타일 추가 시 buttonRow, navButton, navText 추가 필요
```

---

## 4. 8세 아이를 위한 비유적 설명 (Metaphoric Explanation) 👶

우리는 지금 멋진 장난감 로봇 조종기를 만들고 있어요!
1. **지도의 색깔 입히기**: 예전에는 지도 도화지가 어둡고 까만색으로만 칠해져 있었어요(grayscale 필터). 우리는 그 까만 크레파스 칠을 살살 지워서(lines 38-44 제거), 알록달록 원래 지도의 예쁜 색깔을 다시 찾아줄 거예요!
2. **카멜레온 로봇 눈 만들기**: 우리 조종기가 어두운 방(다크모드)이나 밝은 거실(라이트모드)로 이동할 때마다 조종기 단추 색깔이 바뀌어요(useColors). 그 색깔을 컴퓨터 화면(WebView)에 쏙 넣어줄 거예요. 그러면 화면 속 물길 깃발들(SVG markers)이 신기하게도 조종기 단추 색깔과 똑같이 변신하는 카멜레온 눈을 가지게 된답니다!
3. **비밀 포탈로 순간이동 시키기**: 물길 카드를 보다가 "여기 어떻게 가지?"라고 궁금해할 때 조종기의 **길찾기** 버튼을 꾹 누르면, 휴대폰 안에 숨어있는 카카오맵이라는 튼튼한 네비게이션 기차가 쓩 나타나서 길을 안내해 줘요! 만약 그 기차가 휴대폰에 없더라도 걱정 마세요. 인터넷 우주선(웹 브라우저)을 얼른 불러와서 똑같이 지도를 찾아 보여줄 테니까요!
