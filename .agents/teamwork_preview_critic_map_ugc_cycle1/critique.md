# Kakao Map & UGC Pivot Cycle 1 검토 및 스트레스 테스트 보고서 (Critique)

본 보고서는 **Anyway, the Sea (잔물결)** 프로젝트의 1단계 Kakao Map 및 UGC 피벗 구현 계획에 대해 Lead Explorer가 제시한 분석 보고서(`analysis.md`)를 비판적으로 검토하고 스트레스 테스트하여 작성한 결과물입니다. 코드베이스에 대한 변경은 일절 수행하지 않았습니다.

---

## 1. 품질 검토 결과 (Quality Review)

### 1.1 종합 판정 (Verdict)
**REQUEST_CHANGES** (Android queries 설정 누락 보완 및 위경도 유효성 검증 추가 필요)

### 1.2 주요 발견 사항 (Findings)

#### 🔴 [Major] 발견 사항 1: Android 패키지 가시성(Queries) 설정 누락
- **대상**: `mobile/app.json`
- **원인**: Android 11(API 레벨 30) 이상 기기부터는 보안 강화로 인해 패키지 가시성(Package Visibility) 제한이 적용됩니다. 이에 따라 앱에서 외부 앱의 패키지나 URL 스키마 존재 여부를 쿼리하려면 `AndroidManifest.xml`에 `<queries>` 태그를 반드시 선언해야 합니다. Expo 환경에서는 `app.json` 내에 이 설정을 추가해야 합니다.
- **영향**: Explorer가 제시한 `Linking.canOpenURL('kakaomap://')` 함수는 Android 11+ 기기에서 카카오맵 앱이 실제로 설치되어 있더라도 항상 `false`를 반환하게 됩니다. 결과적으로 Android 사용자들은 카카오맵 앱이 설치되어 있음에도 항상 모바일 웹 브라우저로만 길찾기가 로드되는 오작동을 겪게 됩니다.
- **해결 방안**: `app.json` 파일의 `android` 섹션 아래에 다음과 같이 `queries` 설정을 명시해야 합니다.
  ```json
  "android": {
    "package": "com.anyway.thesea",
    "queries": [
      {
        "schemes": [
          "kakaomap"
        ]
      }
    ],
    ...
  }
  ```

#### 🔴 [Major] 발견 사항 2: 위경도 좌표 유효성(Null / NaN) 검증 로직 누락
- **대상**: `mobile/app/(tabs)/map.tsx` 내 길찾기 함수 (`openKakaoMapNavigation`)
- **원인**: Explorer가 제안한 `openKakaoMapNavigation` 함수는 매개변수로 받는 `latitude`와 `longitude`에 대한 유효성 검사를 수행하지 않습니다.
- **영향**: 로컬 캐시나 API 데이터가 일부 오염되어 위경도 값이 `NaN`, `null`, 또는 `undefined`로 전달되는 경우, `kakaomap://route?ep=NaN,NaN...` 혹은 `https://map.kakao.com/link/to/...,NaN,NaN`과 같은 잘못된 주소가 호출됩니다. 이는 외부 지도 앱의 오작동, 빈 화면 로딩, 혹은 앱 크래시를 유발할 수 있습니다.
- **해결 방안**: 길찾기를 호출하기 전, 위경도가 숫자인지 및 유효 범위 내에 있는지 검증하고 오류 알림을 표시하는 안전장치(Guard Clause)를 구현해야 합니다.
  ```typescript
  if (
    latitude === null || latitude === undefined || isNaN(latitude) ||
    longitude === null || longitude === undefined || isNaN(longitude) ||
    latitude === 0 || longitude === 0
  ) {
    Alert.alert('길찾기 실패', '장소의 위치 정보가 정확하지 않습니다.');
    return;
  }
  ```

#### 🟡 [Minor] 발견 사항 3: 테마 주입 순서에 따른 레이스 컨디션 및 플리커링
- **대상**: `mobile/app/(tabs)/map.tsx` 내 WebView 테마 주입 로직
- **원인**: WebView 로딩 완료 메시지(`MAP_READY`)와 React Native의 `useEffect` 훅들 간의 실행 순서가 꼬일 경우, `updateSpots`가 먼저 실행되고 나중에 `themeColors`가 주입될 수 있습니다.
- **영향**: 첫 맵 로딩 시 마커가 기본값(Teal) 색상으로 렌더링되었다가, 순식간에 테마 색상으로 업데이트되어 마커 색상이 깜빡이는(Flickering) 시각적 불일치가 발생할 수 있습니다.
- **해결 방안**: React Native의 `handleMessage` 콜백 내에서 `MAP_READY` 메시지를 처리할 때, `setIsMapReady(true)` 상태를 변경하기 **직전에** `injectJavaScript`를 통해 `window.themeColors`를 먼저 주입해야 합니다. 이렇게 함으로써 `isMapReady`가 `true`가 되어 `useEffect`에 의해 `updateSpots`가 호출될 때 `window.themeColors`가 웹뷰 전역 공간에 이미 존재하도록 보장할 수 있습니다.

---

## 2. 적대적 검토 및 스트레스 테스트 (Adversarial Review)

### 2.1 종합 위험도 평가 (Overall Risk Assessment)
**MEDIUM** (딥링크 제한으로 인한 웹뷰 폴백 빈도 증가 및 좌표 오염 시 크래시 위험이 있으나, 빌드 설정 및 함수 예외 처리로 완화 가능)

### 2.2 시나리오별 스트레스 테스트 결과 (Stress Test Scenarios)

1. **사용자 기기에 카카오맵이 설치되어 있으나 Android 11 이상인 경우**
   - **예상 동작**: `canOpenURL`이 패키지 차단으로 인해 `false`를 반환하고, 모바일 웹 브라우저(`https://map.kakao.com/...`)로 전환됨.
   - **결과**: **실패 (Fail)** -> 사용자 경험에 악영향을 미침. `app.json`에 `queries` 선언 추가로 해결해야 합니다.

2. **특정 쉼터 데이터의 위도/경도가 0 또는 NaN으로 파싱되어 전달된 경우**
   - **예상 동작**: 유효하지 않은 좌표 문자열을 포함한 스키마가 실행되어 외부 지도 앱 또는 웹 브라우저에서 지도 조회 실패 에러가 발생함.
   - **결과**: **실패 (Fail)** -> 사전에 데이터가 올바른지 검사하는 유효성 체크 가드 코드가 필수적입니다.

3. **기기의 테마(다크/라이트)가 앱 사용 중 변경되는 경우**
   - **예상 동작**: React Native의 `colors` 상태 변화에 따라 WebView 소스(`htmlContent`) 자체가 업데이트되면 웹뷰가 재설정(Reload)되어 지도 상태가 초기화되고 깜빡임이 발생함.
   - **결과**: **우려 사항 존재 (Caveat)** -> `htmlContent`가 `colors`의 변경에 영향을 받지 않도록 분리하고, 테마 색상은 오직 `injectJavaScript`를 통해서만 업데이트해야 지도의 상태를 유지할 수 있습니다.

---

## 3. 세부 검증 결과 분석 (Aspect Verification)

### 3.1 Grayscale Filter 제거의 영향성
- **질문**: `map.tsx`의 38-44 라인을 주석 처리하는 것만으로 충분한가? 사용자 위치 마커나 웹뷰 성능에 부작용이 있는가?
- **검증**:
  - **충분성**: 해당 블록이 Kakao Map 타일 이미지에 CSS 필터를 입히는 유일한 스타일 설정이므로, 이를 주석 처리/제거하는 것으로 오리지널 색상을 복구하기에 충분합니다.
  - **사용자 위치 마커에 대한 부작용**: 사용자 위치 마커(`userLocationMarker`)는 data URI를 통해 로컬 SVG로 생성됩니다. CSS 선택자 `#map img[src*="daumcdn.net"]` 등은 오직 Daum/Kakao 서버에서 받아오는 타일 자산만을 명확히 타겟팅하고 있으므로, 사용자 마커는 처음부터 이 grayscale 필터의 영향을 받지 않았습니다. 따라서 마커 렌더링에 부정적인 부작용은 발생하지 않습니다.
  - **웹뷰 성능에 대한 부작용**: CSS filter 속성(`grayscale(100%)`)은 웹뷰 렌더링 시 추가적인 오프스크린 버퍼 생성과 레이아웃 연산 오버헤드를 유발하여 성능에 부정적인 영향을 줍니다. 필터를 제거하면 렌더링 복잡도가 현저히 감소하여, 지도를 이동하거나 핀을 탭할 때의 웹뷰 내부 프레임 속도가 **크게 개선**되며 기기 발열 및 배터리 소모도 감소하게 됩니다.

### 3.2 Dynamic Colors Custom SVG Markers 검증
- **질문**: dynamic colors 주입 방식이 안정적인가? `window.themeColors`가 `initializeMap()` 또는 `updateSpots()` 이전에 로드되는가? 레이스 컨디션을 해결할 방안은?
- **검증**:
  - **동작 순서 분석**: WebView 내부의 `window.onload`가 실행된 후 `initializeMap()`이 완료되어야 `MAP_READY` 메시지가 전송됩니다. 따라서 `initializeMap` 호출 시점에는 `window.themeColors`가 절대 존재하지 않습니다.
  - **레이스 컨디션 해결**: 
    - `initializeMap`은 마커를 그리지 않고 맵 인스턴스만 준비하므로 테마 색상이 필요 없습니다.
    - 실제 마커를 그리는 `updateSpots`가 실행되기 전에 테마 색상을 확보하는 것이 핵심입니다.
    - **권장 구조**: React Native 단에서 `MAP_READY` 신호를 받았을 때 즉시 `themeColors` 스크립트를 먼저 인젝션하고, 그 다음 `isMapReady` 상태를 `true`로 설정하는 절차적 우선순위를 보장해야 합니다.
    - **예외 처리**: 웹뷰 코드 측에서도 `window.themeColors`가 없을 경우를 대비하여 `colors.ts`의 기본값(`primary: '#2F6F6B'`, `accent: '#C9A876'`)을 각 마커 스타일 속성마다 개별 폴백으로 확실하게 바인딩해야 합니다.

### 3.3 Kakao Map Deep Link 검증
- **질문**: `kakamap` route 및 웹 fallback URL의 파라미터 구조가 타당한가? Android 권한/설정이 정상인가? 누락된 엣지 케이스는?
- **검증**:
  - **파라미터 적합성**: `kakaomap://route?ep=${latitude},${longitude}&by=FOOT&en=${encodeURIComponent(destinationName)}`는 공식 카카오맵 스키마 규격을 충족합니다. `sp`(출발지)를 생략하면 사용자 현위치를 출발지로 간주하므로 도보 경로 검색에 매우 유리합니다. 웹 폴백인 `https://map.kakao.com/link/to/Name,lat,lng` 역시 데스크톱/모바일 브라우저 표준에 부합합니다.
  - **iOS/Android 권한 설정 차이**: 
    - iOS의 경우 `infoPlist.LSApplicationQueriesSchemes` 등록이 필수적입니다.
    - Android 11+의 경우 Expo `app.json` 내의 `"android.queries"` 설정에 `kakaomap` 스키마 쿼리 선언이 추가로 정의되어야만 `Linking.canOpenURL`이 참을 반환합니다. 이 부분이 누락되면 안드로이드 환경 전체에서 네이티브 앱 연결이 무력화됩니다.
  - **누락된 엣지 케이스**:
    - **좌표 누락 및 NaN 예외**: 유효성 검사 코드를 딥링크 호출부 상단에 반드시 배치해야 크래시를 방지할 수 있습니다.
    - **특수문자 및 공백 처리**: 장소명에 괄호, 슬래시, 쉼표 등이 포함될 수 있으므로 `encodeURIComponent` 처리는 매우 정확하며 그대로 유지되어야 합니다.
