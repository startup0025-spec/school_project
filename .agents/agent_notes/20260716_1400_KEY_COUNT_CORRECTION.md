---
RECORD_ID: "20260716_1400_KEY_COUNT_CORRECTION"
RECORD_TYPE: "[LOG]"
TARGET: "Confirm exact number of variables/keys to be configured"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 카카오맵을 제외하고 물리적/환경변수적으로 입력해야 할 키가 총 3개인지 질문하심. 코드 내 환경변수 로딩 스키마를 바탕으로 정확한 키의 논리적/물리적 개수를 분석함. 답변 전 챗로그 룰 준수함.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 즉시 본 챗로그 문서를 생성하여 파이프라인 무결성을 보장함.
> 2. `api_keys.ts` 및 `bake_places.js` 분석 결과를 재검토: `EXPO_PUBLIC_KMA_SERVICE_KEY`, `EXPO_PUBLIC_BUSAN_SERVICE_KEY`, `TOUR_API_KEY` 세 가지 키 슬롯(Slot)이 존재함을 확인.
> 3. 비록 근본 키 값은 공공데이터포털 하나에서 오지만, 코드 내부에서는 3개의 서로 다른 환경 변수로 독립 분리되어 관리됨을 확정.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님께서 실제 시스템에 세팅해야 하는 환경변수 개수가 3개(KMA, Busan, TourAPI)임을 정확히 확인시켜 드려 설정 실수나 누락을 원천 예방하기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 사장님께 환경변수 슬롯 기준 3개가 맞음을 인정하고 설명 보고.)
