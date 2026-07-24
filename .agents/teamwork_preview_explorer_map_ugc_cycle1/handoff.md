# Handoff Report — Kakao Map & UGC Pivot Cycle 1 Investigation

## 1. Observation
- **Grayscale Filter**: `mobile/app/(tabs)/map.tsx` 내의 lines 38-44에 Kakao Map 이미지 타일에 강제로 grayscale 필터와 opacity/contrast 변형을 적용하는 스타일 코드가 확인되었습니다:
  ```css
  38:     /* Apply grayscale filter strictly to tile assets to preserve custom marker images */
  39:     #map img[src*="daumcdn.net"], 
  40:     #map img[src*="maps.daumcdn.net"] {
  41:       filter: grayscale(100%) opacity(0.8) contrast(1.1);
  42:       will-change: filter;
  43:       transform: translate3d(0, 0, 0); /* Promote to GPU layer for panning speed */
  44:     }
  ```
- **Theme Hooks & Constants**: `mobile/hooks/useColors.ts`가 `mobile/constants/colors.ts`를 가져와 실시간 테마 팔레트를 반환하는 구조가 확인되었습니다. `colors.light.primary` 등과 같은 컬러 코드가 반환됩니다.
- **WebView Bridge**: `map.tsx` 내 `MapScreen` 컴포넌트에서 `webViewRef.current?.injectJavaScript()`를 사용하여 웹뷰에 동적 데이터를 흘려보내는 구조가 구현되어 있습니다.

## 2. Logic Chain
- **Task 1 (Grayscale 해제)**: `map.tsx`의 lines 38-44에 정의된 타일 이미지 CSS 선택자 전체를 주역 처리하거나 `filter:` 줄만 무력화하면 Kakao Map 고유의 지도 색상이 나타납니다.
- **Task 2 (동적 테마 연동 및 SVG 마커)**: React Native의 `useColors()`가 반환하는 색상을 JSON 객체화하여 `injectJavaScript`를 통해 웹뷰 전역(`window.themeColors`)에 동기화하고, 마커 생성 함수 `window.updateSpots`에서 이 색상 값을 참조하여 SVG 코드 안에 삽입합니다. SVG 마커 이미지는 `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}` 포맷으로 `kakao.maps.MarkerImage`에 생성 주입할 수 있습니다.
- **Task 3 (길찾기 딥링크 및 폴백)**: `Linking.canOpenURL('kakaomap://')`를 활용하여 카카오맵 앱이 존재할 경우 `kakaomap://route?ep=${lat},${lng}&by=FOOT&en=${name}`를 실행하고, 앱이 없을 경우 모바일 웹 `https://map.kakao.com/link/to/${name},${lat},${lng}`를 폴백으로 브라우저에 띄웁니다. 단, iOS에서는 `app.json`에 `LSApplicationQueriesSchemes` 등록이 필수적입니다.

## 3. Caveats
- 본 단계에서는 코드를 직접 수정하지 않고 가이드라인 분석만 완수하였습니다.
- 실제 디바이스 테스트 시 카카오맵 앱의 설치 여부에 따른 딥링크 폴백 테스트와 iOS 시뮬레이터에서의 LSApplicationQueriesSchemes 빌드 반영이 올바르게 이루어지는지 검증해야 합니다.

## 4. Conclusion
- Kakao Map 모노톤 해제 및 동적 컬러 SVG 마커 렌더링, 길찾기 외부 연동을 위한 모든 스키마/설정 조건 분석이 완료되었습니다. 이로써 Cycle 1 설계 및 탐색 분석 단계를 통과하여 구현 가능한 상세 명세서가 작성되었습니다.

## 5. Verification Method
- **정적 코드 검증**:
  - `map.tsx` 파일 내 CSS 필터 주석 처리 여부 확인.
  - `app.json` 내 `LSApplicationQueriesSchemes` 에 `kakaomap` 항목 반영 여부 확인.
- **런타임 동작 검증**:
  - 시뮬레이터/디바이스 환경에서 기기 테마(Light/Dark) 변경 시 마커 색상이 함께 바뀌는지 확인.
  - 기기에 카카오맵 앱이 설치되어 있지 않을 때 "길찾기" 클릭 시 기본 브라우저가 정상적으로 실행되어 카카오맵 웹 경로 안내 페이지로 이동하는지 확인.
