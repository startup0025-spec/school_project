---
RECORD_ID: "20260716_1412_CACHE_TTL_SAFEGUARD"
RECORD_TYPE: "[LOG]"
TARGET: "Enforce strict client-side cache TTL by bypassing server headers"
---
[1_WHAT] (State & Context):
> (LOG: 사장님의 질문에 따라 현재 캐시 코드(`client.ts`)를 분석하던 중, `axios-cache-interceptor`가 기본적으로 서버의 `Cache-Control: no-cache` 헤더를 존중하여 캐시를 무력화할 수 있는 치명적인 병목 리스크를 발견함. 이를 해결하기 위한 로직 변경을 계획하고 로깅함. 답변 전 챗로그 룰 준수함.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 규정에 따라 즉각 본 챗로그 문서를 최우선 생성함.
> 2. `mobile/core_engine/src/network/client.ts` 코드 수정: `setupCache` 옵션에 `ttl: 1000 * 60 * 5` (5분 강제 캐시) 및 `interpretHeader: false` (서버 캐시 금지 헤더 무시) 옵션 추가 설정.
> 3. 수정 후 모바일 앱 타입스크립트 컴파일러 검사(`tsc`)를 돌려 무결성 교차 검증 예정.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 공공데이터포털(data.go.kr) 서버가 실시간 데이터라는 이유로 캐시 불가 헤더를 보낼 경우, 클라이언트의 라이브러리가 캐싱을 스킵하고 호출할 때마다 API를 찌르는 취약성을 제거하기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 코드 수정 및 타입 검사 진행 후 최종 보고.)
