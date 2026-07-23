---
RECORD_ID: "20260716_1343_API_KEY_FORMATS"
RECORD_TYPE: "[LOG]"
TARGET: "Detail specific API Key formats and encoding requirements"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 챗로그 누락에 대해 매섭게 질책하심. 또한 공공데이터포털 및 카카오맵 API 키의 구체적인 인코딩/디코딩 매커니즘 분석에 매핑되는 로그 생성이 요구됨.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 즉각 챗로그(본 문서)를 작성하여 글로벌 룰(ALETHEIA PIPELINE LOCK)을 수호함.
> 2. `api_keys.ts` 파일 내 `decodeBase64` 복호화 함수 분석 기록.
> 3. `kma_api.ts`, `busan_api.ts`에서 axios `params`를 통한 자동 인코딩 메커니즘 분석 기록.
> 4. `bake_places.js`에서 `encodeURIComponent`를 사용한 수동 인코딩 메커니즘 분석 기록.
> 5. 결과적으로 환경변수에 주입할 디코딩 키(Decoding Key) 및 Base64 변환 지침을 확정하여 로깅함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 공공데이터포털 특유의 Encoding/Decoding 키 선택 오류 및 Axios/Fetch 중복 인코딩 에러(`SERVICE_KEY_IS_NOT_REGISTERED_ERROR`)를 원천 방지하기 위해 정밀한 원인 규명이 필수적이었음.)

[4_NEXT] (Status & Follow-up):
> (LOG: 로그 작성 완료 후 사장님께 다시 정중히 룰 준수 보고 및 설명 피드백 대기.)
