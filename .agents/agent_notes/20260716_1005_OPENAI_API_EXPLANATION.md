---
RECORD_ID: "20260716_1005_OPENAI_API_EXPLANATION"
RECORD_TYPE: "[LOG]"
TARGET: "Explain OpenAI API issuance difficulty and limitations to the user"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 OpenAI API 키 발급 난이도와 사용 제한(Limit)에 대해 질문하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 발급은 플랫폼 로그인 후 버튼 하나로 가능하여 매우 쉽다고 안내.
> 2. 요금은 완전 무료가 아니라 카드 등록(최소 충전)이 필요하지만, 코드에 `gpt-4o-mini` 모델을 세팅해 두어 비용이 사실상 0원에 수렴함을 강조함.
> 3. Rate Limit (요청 횟수 제한) 우려에 대비해 `bake_places.js` 코드 내부에 이미 0.5초 간격 쓰로틀링(Throttling) 방어막을 구축해 두었음을 보고함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님의 과금 공포증을 해소하고, 시스템의 안정성(Rate Limit 방어 설계)을 어필하여 안심시키기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 설명 완료 후 사장님의 API 키 확보 대기.)
