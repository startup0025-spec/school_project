---
RECORD_ID: "20260724_1153_REPLY_TOUR_API_EXPLANATION"
RECORD_TYPE: "[LOG]"
TARGET: "Explain the architectural difference between runtime APIs and pipeline APIs (Tour API)"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 스크린샷으로 '한국관광공사 국문 관광정보 서비스(Tour API)'까지 총 5개를 신청했음을 보여주시며, 왜 이 키는 언급이 없는지 의아해하심.)

[2_HOW] (Action & Context):
> (LOG: 
> 1. 프로젝트 아키텍처를 재점검한 결과, 기상청/부산공공데이터(총 4개)는 앱 실행 중 실시간으로 사용자 핸드폰에서 호출되는 **'프론트엔드 실시간 API'**임을 확인함.
> 2. 반면 '한국관광공사 Tour API'는 앱 내부에서 호출되는 것이 아니라, 서버(GitHub Actions)에서 매일 밤 작동하는 **'백그라운드 파이프라인 스크립트(`scripts/pipeline/bake_places.js`)'**가 사용하는 용도임을 확인함.
> 3. 즉, 앱 속도를 위해 관광공사 데이터를 실시간으로 부르지 않고, 스크립트가 미리 데이터를 구워놓고(Pre-baking) 앱은 그 결과물만 받아먹는 구조임을 사장님께 설명함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 앱 구조의 정교함을 어필하고, 해당 관광공사 키는 모바일 `.env`가 아닌 서버 측(GitHub Secrets 등)에 들어가야 함을 알려드리기 위함.)

[4_NEXT] (Status & Follow-up):
> (LOG: Vercel 배포 진행 대기.)
