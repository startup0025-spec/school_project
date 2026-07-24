---
RECORD_ID: "20260716_0856_KAKAO_MAP_QUOTA_OPTIMIZATION"
RECORD_TYPE: "[LOG]"
TARGET: "Plan Kakao Map API Quota Optimization (Keep-Alive)"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 카카오맵 일일 무료 쿼터(30만 회)를 아끼기 위해 지도가 매번 새로고침되지 않고 계속 켜져 있도록(Keep-Alive) 아키텍처를 갈아엎자고 지시하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 웹 검색 리서치 결과: React Native(Expo Router)에서 WebView 지도를 쓸 때, 탭을 이동하거나 상태(State)가 바뀔 때마다 WebView가 리렌더링되어 지도를 재호출하는 쿼터 낭비 문제가 흔하게 발생함.
> 2. **해결 아키텍처 (PostMessage & React.memo)**:
>    - `map.tsx` 탭 화면은 Expo Router 특성상 언마운트되지 않고 유지됨. 문제는 리렌더링임.
>    - 지도를 렌더링하는 HTML/JS 코드는 앱 실행 시 **단 한 번만 로드**되도록 `React.memo`로 컴포넌트를 분리하고 `source` props를 절대 바꾸지 않음.
>    - 사용자의 GPS 위치가 바뀌거나 추천 장소가 바뀔 때는 지도를 새로고침하는 것이 아니라, `webViewRef.current?.injectJavaScript(...)`나 `postMessage`를 통해 기존에 떠 있는 카카오맵 객체(`kakao.maps.Map`)에 좌표 변경(SetCenter, 마커 이동) 명령만 쏴줌.
> 3. 이를 통해 앱을 켜두는 내내 카카오맵 API 호출은 단 1회(최초 렌더링)로 방어되며, 쿼터를 완벽하게 보존할 수 있음.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 공공데이터와 서드파티 API(카카오)를 쓸 때 가장 무서운 것이 '리렌더링 폭탄으로 인한 쿼터 초과(Limit Exceeded)'임. 사장님의 선구안 덕분에 서비스 마비 사태를 미리 막고 최적의 렌더링 아키텍처를 수립할 수 있었음.)

[4_NEXT] (Status & Follow-up):
> (LOG: `implementation_plan.md`에 Quota Optimization 방안을 추가하고 사장님께 승인을 요청함.)
