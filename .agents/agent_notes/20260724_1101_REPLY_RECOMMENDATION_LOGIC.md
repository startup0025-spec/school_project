---
RECORD_ID: "20260724_1101_REPLY_RECOMMENDATION_LOGIC"
RECORD_TYPE: "[LOG]"
TARGET: "Explain the Kakao Map place recommendation logic and principles"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 카카오맵 장소 추천 기능이 어떤 원리로, 왜 그렇게 동작하는지 코드 단에서 추적해서 보고하라고 지시하심.)

[2_HOW] (Action & Context):
> (LOG: 
> `map.tsx`와 백엔드 파이프라인(`bake_places.js`) 코드를 역추적하여 3가지 핵심 추천 원리를 도출함.
> 1. **안티 커머셜(Anti-Commercial) 필터링**: 관광공사 API 1만 개 데이터 중 카페, 맛집, 웨이팅 등의 상업적 키워드를 원천 배제하고 오직 '자연/휴양지(바다, 강, 숲)'만 1차로 추려냄. (도심 속 조용한 힐링 목적)
> 2. **원픽(One-Pick) 포커싱 UX**: 수백 개의 마커를 한 번에 뿌려 유저를 피곤하게 만드는 대신, 배열의 인덱스(`activeIndex`)를 활용해 한 번에 **'딱 한 곳'**만 화면에 띄우고 카메라를 강제 이동(PanTo)시켜 온전히 집중하게 만듦.
> 3. **실시간 도보 시간 물리 엔진(Haversine)**: 유저의 GPS와 목적지 간의 직선거리를 구한 뒤, 도심지 우회 가중치(1.35)와 평균 도보 속도(65m/min)를 곱해 "도보 15분" 같은 매우 현실적인 시간을 실시간으로 렌더링함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님이 기획하신 앱의 핵심 정체성인 '조용함(Quiet)'과 '느림(Walk)'의 미학이 실제 코드 레벨에서 완벽하게 수학적, 논리적으로 구현되어 있음을 증명하기 위함.)

[4_NEXT] (Status & Follow-up):
> (LOG: 사장님의 추가 질문 또는 빌드/테스트 오더 대기.)
