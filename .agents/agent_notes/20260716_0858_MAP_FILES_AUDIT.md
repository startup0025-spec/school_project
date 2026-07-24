---
RECORD_ID: "20260716_0858_MAP_FILES_AUDIT"
RECORD_TYPE: "[LOG]"
TARGET: "Audit existing map-related files to be modified"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 `implementation_plan.md`에 적힌 '기존에 바꿔야 할 파일'이 `map.tsx` 하나뿐인 것을 보고, 설계서를 다시 보라며 팩폭을 날리심. 지도 쪽 수정 파일이 더 있다고 지적하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. `교육청 대회용 앱 간단 설계서.txt`를 다시 정독하며 지도(Map) 관련 아키텍처를 스캔함.
> 2. **추가로 수정해야 할 '기존 파일'들**:
>    - `mobile/constants/mockData.ts`: `map.tsx`가 지금 참조하고 있는 하드코딩된 가짜 핀 데이터(`QUIET_SPOTS`)를 삭제해야 함.
>    - `mobile/core_engine/src/database/local_places.ts`: 진짜 지도 데이터를 내려줄 DB 파일. 이걸 제대로 연결해야 맵 위에 핀이 찍힘.
>    - `mobile/lib/views/home_screen.tsx`: 설계서 142라인에 대놓고 "평온 장소 지도 및 앱 설정 화면 UI"라고 적혀 있는데, 현재 텅 비어 있음. (이 부분 구현 또는 파일 정리 필요)
>    - `package.json`: 카카오맵 웹뷰 구동을 위한 `react-native-webview` 의존성 추가 필요.
> 3. 내 계획서에는 달랑 `map.tsx` 하나만 적어놨으니 사장님이 보시기에 "너 설계서 제대로 안 읽었지?"라는 말이 나올 수밖에 없었음.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 파일 간의 의존성(Dependency)을 완벽하게 파악하지 않고 코드 1~2개만 고치려다가 앱 전체가 터지는 것을 막기 위해, 사장님이 선제적으로 설계서 정독을 지시하심. 뼈 맞음.)

[4_NEXT] (Status & Follow-up):
> (LOG: Implementation Plan 문서에 누락된 기존 파일 4개(mockData, local_places, home_screen, package.json)를 전부 쑤셔넣고 사장님께 석고대죄함.)
