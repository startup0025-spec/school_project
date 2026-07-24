---
RECORD_ID: "20260724_1153_REPLY_API_COUNT_EXPLANATION"
RECORD_TYPE: "[LOG]"
TARGET: "Explain to the user why 5 APIs use only 3 keys"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 "API를 5개 신청했는데 왜 키는 2~3개만 쓰냐?"고 의문을 제기하심.)

[2_HOW] (Action & Context):
> (LOG: 
> 1. 실제 내부 코드에서 통신하는 엔드포인트(API)를 집계함.
>    - [1] 카카오맵 (Kakao)
>    - [2] 기상청 초단기 예측 (KMA)
>    - [3] 기상청 기상 특보 (KMA)
>    - [4] 부산 수위 데이터 (Busan)
>    - [5] 부산 수질 데이터 (Busan)
> 2. 즉, 앱 내부적으로는 사장님이 신청하신 **5개의 API를 100% 빠짐없이 전부 사용 중**임을 확인.
> 3. 다만 공공데이터포털(data.go.kr)의 시스템 특성상, 같은 기관(기상청, 부산시)의 API들은 하나의 통합 **'일반 인증키(Service Key)'**로 통신할 수 있기 때문에 `.env` 파일에 적는 키의 갯수만 적어 보이는 것일 뿐이라고 명확하게 설명함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님의 불안감(기능 누락에 대한 우려)을 해소하고, 공공데이터포털의 키 발급 구조를 이해시켜드리기 위함.)

[4_NEXT] (Status & Follow-up):
> (LOG: Vercel 배포 진행 대기.)
