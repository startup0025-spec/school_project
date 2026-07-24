---
RECORD_ID: "20260724_1110_REPLY_IMPLEMENTATION_PLAN"
RECORD_TYPE: "[LOG]"
TARGET: "Present the implementation plan for GPS-based distance sorting"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 단순 땜빵 코드가 아닌, 기존에 구축해둔 GPS 백그라운드 엔진과 완벽하게 연동되는 정석적인 거리순 정렬 아키텍처 개편을 지시하심.)

[2_HOW] (Action & Context):
> (LOG: 
> 1. `geofencing_service.ts`를 분석하여, 백그라운드에 이미 저장되고 있는 `AsyncStorage` GPS 캐시(`@anywayTheSea:bg_location_state`)를 활용하기로 설계함.
> 2. `map.tsx`가 로드될 때 이 캐시를 낚아채서 맵 렌더링 전에 미리 장소를 '거리순'으로 정렬하는 구조적 개편안(Implementation Plan)을 작성함.
> 3. 단순 정렬 시 화면이 깜빡이거나 섞이는 문제를 방지하기 위한 '최초 1회 고정 정렬' 오픈 퀘스천을 함께 제안함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님의 의도대로 프론트엔드의 화면 단에만 의존하는 허술한 코드가 아니라, 앱 전체의 백그라운드 GPS 인프라를 활용하는 탄탄한 아키텍처를 세우기 위함.)

[4_NEXT] (Status & Follow-up):
> (LOG: 사장님의 Plan 컨펌(승인) 및 Open Question 답변 대기.)
