---
RECORD_ID: "20260724_1155_REPLY_TOUR_API_USAGE"
RECORD_TYPE: "[LOG]"
TARGET: "Explain how and where to inject the TOUR_API_KEY"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 "그럼 저 관광공사 API 키는 어디에 어떻게 넣어야 작동하냐?"고 구체적인 세팅 방법을 문의하심.)

[2_HOW] (Action & Context):
> (LOG: 
> 1. `bake_places.js` 스크립트가 로컬 환경의 `.env` 파일 대신 시스템 환경변수(`process.env.TOUR_API_KEY`)를 직접 읽어오도록 순수 Node.js로 짜여져 있음을 파악함.
> 2. 이 스크립트의 주 무대는 사장님 로컬 PC가 아니라 **깃허브 서버(GitHub Actions)** 임을 상기시켜드림.
> 3. 따라서 로컬 모바일 폴더의 `.env`에 넣는 것이 아니라, **깃허브 레포지토리 세팅(Settings > Secrets)**에 `TOUR_API_KEY`라는 이름으로 등록해야 함을 단계별로 안내함.
> 4. 만약 로컬에서 당장 데이터를 새로 굽고 싶으시다면 터미널에서 임시 환경변수로 실행하는 방법도 안내함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 파이프라인 전용 키와 모바일 전용 키의 물리적 위치(GitHub Secrets vs 로컬 .env)를 명확히 분리하여 사장님이 인프라 구조를 완벽히 통제할 수 있게 돕기 위함.)

[4_NEXT] (Status & Follow-up):
> (LOG: Vercel 배포 진행 대기.)
