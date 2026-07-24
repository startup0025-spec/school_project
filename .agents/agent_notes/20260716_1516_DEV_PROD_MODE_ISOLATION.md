---
RECORD_ID: "20260716_1516_DEV_PROD_MODE_ISOLATION"
RECORD_TYPE: "[LOG]"
TARGET: "Acknowledge developer test vs real production environment toggle"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 수동 조작 컨트롤이 어디까지나 개발자 테스트 및 데모용 환경을 위해 노출된 것이며, 실 서비스에서는 수동 조작이 불가능하고 100% 실제 센서/API에 의해서만 구동되어야 함을 명확히 정의하심. 이에 따라 시연 모드와 실전 모드를 전역 스위치로 완벽 분리하는 설계 방향을 정립하고 로깅함. 답변 전 챗로그 룰 준수함.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 규정에 따라 즉각 본 챗로그 문서를 최우선 생성하여 파이프라인 무결성을 보장함.
> 2. 스위칭 아키텍처 구상:
>    - `RippleContext.tsx`에 전역 시뮬레이션 활성화 플래그(`isDemoMode = true`) 추가 구상.
>    - `isDemoMode`가 `true`일 때는 UI의 세그먼트 컨트롤을 보여주고 수동 클릭 이벤트를 오디오 엔진과 orbMode에 반영.
>    - `isDemoMode`가 `false`일 때는 UI의 컨트롤을 숨기고, 오직 백그라운드 지오펜싱(`DeviceEventEmitter` 수신) 및 실시간 API(기상청/수위)에 의해서만 강제 동기화되도록 분기.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님의 설계 철학에 부합하도록, 프레젠테이션용 시연 유연성과 상용 출시 시의 완전 자동화 구조를 단 하나의 전역 변수 조작으로 매끄럽게 교차 전환 가능하게 돕기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 환경 격리 및 스위칭 설계 피드백 보고.)
