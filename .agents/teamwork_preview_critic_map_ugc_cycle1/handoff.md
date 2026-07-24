# Handoff Report — Lead Critic (Cycle 1)

## 1. 관찰 내용 (Observation)

- **Grayscale CSS 위치**: `mobile/app/(tabs)/map.tsx` 파일 내 인라인 HTML 스타일 정의 (lines 38-44):
  ```css
  38:     /* Apply grayscale filter strictly to tile assets to preserve custom marker images */
  39:     #map img[src*="daumcdn.net"], 
  40:     #map img[src*="maps.daumcdn.net"] {
  41:       filter: grayscale(100%) opacity(0.8) contrast(1.1);
  42:       will-change: filter;
  43:       transform: translate3d(0, 0, 0); /* Promote to GPU layer for panning speed */
  44:     }
  ```
- **Android 설정 상태**: `mobile/app.json` 파일의 `android` 섹션 (lines 26-35)에서 패키지 쿼리 선언(`queries`)이 완전히 부재한 것을 확인함.
- **사용자 위치 마커 코드**: `map.tsx` 파일 내 `updateUserLocation` (lines 204-208)에서 data URI를 사용하여 마커 이미지를 정의하고 있음:
  ```javascript
  204:         var markerImage = new kakao.maps.MarkerImage(
  205:           'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="%23007AFF" stroke="white" stroke-width="2"/><circle cx="10" cy="10" r="10" fill="%23007AFF" opacity="0.25"/></svg>',
  206:           imageSize,
  207:           imageOption
  208:         );
  ```
- **WebView Ready 처리 로직**: `map.tsx` 파일 내 `handleMessage` (lines 447-450)에서 `MAP_READY` 이벤트 수신 시 `isMapReady`를 단독 활성화함:
  ```typescript
  447:         case 'MAP_READY':
  448:           setIsMapReady(true);
  449:           setIsSdkFailed(false);
  450:           break;
  ```

---

## 2. 논리 체인 (Logic Chain)

1. **관찰 1 & 3**: Grayscale CSS 필터는 Daum/Kakao 이미지 CDN 경로(`daumcdn.net`, `maps.daumcdn.net`)를 타겟으로 지정하는 반면, 사용자 위치 표시 마커는 로컬 SVG Data URI(`data:image/svg+xml`) 소스를 기반으로 렌더링됩니다.
2. **추론 1**: 따라서 Grayscale 필터 제거를 위한 스타일 주역 처리는 사용자 마커의 표시 형태나 렌더링에 부정적인 부작용을 일으키지 않습니다.
3. **관찰 2**: Android 11(API Level 30) 이상부터는 Package Visibility 제한 정책이 기본 적용되나, `app.json` 파일 내에 `<queries>` 선언 필드가 부재합니다.
4. **추론 2**: 이로 인해 Android 환경에서 `Linking.canOpenURL('kakaomap://')` 호출 시 기기에 실제 카카오맵 앱이 설치되어 있더라도 항상 `false`가 반환되어, 무조건 모바일 웹 fallback 경로로 동작하게 됩니다. 이를 예방하기 위해 Expo `app.json` 내부의 `android.queries` 배열 설정에 `kakaomap` 스키마 등록이 강제됩니다.
5. **관찰 4**: React Native에서 `isMapReady` 상태 변화 감지 직후 비동기 방식으로 themeColors 주입 명령(`injectJavaScript`)을 전달하고 있습니다.
6. **추론 3**: 비동기 IPC 동작에 의해 마커 핀 데이터를 맵에 반영하는 `updateSpots` 메서드가 테마 색상 설정 코드보다 먼저 처리될 경우 마커가 일시적으로 초기 기본 Teal 계열 색상으로 그려진 뒤 곧바로 테마 색상으로 변경되는 플리커링(Flickering) 현상이 일어납니다. 따라서 `MAP_READY`를 수신하자마자 `isMapReady = true` 상태를 전환하기 직전에 `themeColors` 정보를 먼저 주입해 두는 절차 보장이 요구됩니다.

---

## 3. 주의 사항 (Caveats)

- 본 분석은 코드에 실제 변경사항을 적용하지 않고 가상 시뮬레이션 및 코드 정밀 추적을 기반으로 작성되었습니다. 카카오맵 앱이 기기 내부에서 도보 방향 탐색(`by=FOOT`)을 온전히 수행할 수 없는 경로나 위치 관계가 존재할 경우, 외부 카카오맵 앱 내부 에러 핸들러 동작 방식으로 인한 화면 이탈이 발생할 수 있습니다.
- Android Emulator 및 iOS Simulator 내에서 `canOpenURL`이 호출될 경우, 기기 내에 실제 외부 브라우저 외 카카오맵 네이티브 어플리케이션이 설치되어 있지 않으므로 항시 fallback URL로 실행됩니다. 이는 에뮬레이터 환경의 정상적인 제한 동작입니다.

---

## 4. 결론 (Conclusion)

- **Grayscale Filter 제거**: lines 38-44 스타일 블록 주석 처리 시, 렌더링 버퍼 오버헤드 해소로 줌/패닝 프레임 성능이 향상되며 사용자 마커 렌더링 영향도 없어 완전 승인 가능합니다.
- **Dynamic Colors Custom SVG Markers**: 초기 화면 렌더링 불일치(깜빡임) 방지를 위해 `MAP_READY` 수신과 동시에 `themeColors`를 인젝션한 이후 `isMapReady` 상태를 승인하도록 수정 제안합니다. 또한, 각 SVG 구성 코드 내에 안전한 테마 프로퍼티 Fallback 값 바인딩이 누락되지 않도록 해야 합니다.
- **Kakao Map Deep Link**: 카카오맵 URL Scheme 구조는 정확하지만 Android 11+ Package Visibility를 준수하기 위해 `app.json`의 `"android.queries"` 설정 수정이 필수적입니다. 아울러 좌표 오염 상황에서의 비정상 외부 딥링크 호출을 방지하기 위해 호출부 진입 전 좌표 값 `NaN`, `null`, `0` 값에 대한 유효성 가드 로직을 삽입해야 합니다.

---

## 5. 검증 방법 (Verification Method)

1. **AndroidManifest / app.json 정적 구조 확인**:
   - `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app.json`에 `android.queries` 배열과 `ios.infoPlist.LSApplicationQueriesSchemes` 배열에 각각 `"kakaomap"` 문자열이 존재하는지 검사합니다.
2. **코드 레벨 절차 보장 검사**:
   - `map.tsx`의 `handleMessage` 내 `MAP_READY` 콜백 구문에서 `webViewRef.current?.injectJavaScript` 테마 색상 설정 호출이 `setIsMapReady(true)`보다 순서적으로 상위에 선언되어 있는지 정적으로 확인합니다.
3. **가드 로직 배치 분석**:
   - `openKakaoMapNavigation`의 위도(`latitude`) 및 경도(`longitude`)가 숫자가 아닌 상태(`isNaN`) 또는 Nullable 형태일 경우 딥링크 수행을 취소하고 사용자 안내를 띄우는 예외 분기가 함수 시작 단에 위치하는지 검사합니다.
