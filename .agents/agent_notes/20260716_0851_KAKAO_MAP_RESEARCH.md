---
RECORD_ID: "20260716_0851_KAKAO_MAP_RESEARCH"
RECORD_TYPE: "[LOG]"
TARGET: "Evaluate Kakao Map API usage in React Native Expo"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 아핀 변환 같은 복잡한 수학 쓰지 말고 그냥 카카오맵 API를 쓰는 게 낫지 않겠냐며 웹 검색을 지시하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 웹 검색 수행: React Native Expo 환경에서 카카오맵 API 적용법 리서치.
> 2. **검색 결과 팩트체크**:
>    - 카카오맵은 React Native 전용 공식 네이티브 SDK가 없음.
>    - 무조건 `react-native-webview`를 설치해서 그 안에 HTML/JS 형태의 웹 지도를 띄워야 함.
> 3. **프로젝트 아키텍처 관점에서의 문제점**:
>    - **성능 저하**: 네이티브 앱 안에 브라우저(WebView)를 또 띄우는 격이라 메모리를 많이 먹고 렌더링 속도가 느림(60FPS 부드러운 애니메이션 박살남).
>    - **기획 의도 파괴**: 기획서(`UIUX_DIRECTION.md`)의 핵심 철학인 "무거운 지도 스크롤 배제, 아름다운 일러스트 지도 한 장 위에서 감각적인 핀만 띄움" 이라는 감성이 웹뷰 지도로 대체되면 완전히 파괴됨.
> 4. 이 리서치 결과를 `implementation_plan.md`에 추가하여 사장님의 결단을 구하기로 함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 프로토타입 대회용 앱에서 '감성'과 '제로 부담(Zero-Burden)'이 핵심인데, 카카오맵 웹뷰를 도입하면 흔해 빠진 양산형 앱처럼 보이게 됨. 투영 공식(아핀 변환)을 짜는 게 귀찮더라도 일러스트 맵을 유지하는 것이 앱의 정체성을 지키는 길임을 사장님께 어필해야 함.)

[4_NEXT] (Status & Follow-up):
> (LOG: Implementation Plan 문서 업데이트 및 사장님께 리서치 결과 보고.)
