---
RECORD_ID: "20260716_1146_HF_MODELS_FREE_TIER_LIMITS"
RECORD_TYPE: "[LOG]"
TARGET: "Evaluate free tier limitations for specific Hugging Face models"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 3개의 모델(`gogamza/kobart-summarization`, `EbanLee/kobart-summary-v3`, `skt/kogpt2-base-v2`)을 허깅페이스 무료 API로 돌릴 수 있는지, 제한 사항은 무엇인지 조사를 지시하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 세 모델 모두 용량이 1GB 미만으로 매우 작아 허깅페이스의 무료 'Serverless Inference API'로 **100% 무료 구동이 가능함**을 확인.
> 2. 단, 완전 무료인 만큼 3가지 제약(Limitations)이 존재함:
>    - **Rate Limit (호출 제한)**: 시간당 수백 건 수준. 트래픽이 몰리면 `429 Too Many Requests` 에러 발생.
>    - **Cold Start (초기 지연)**: 한동안 호출이 없으면 서버가 모델을 메모리에서 내림. 다시 첫 호출 시 모델을 로드하느라 수 초가 걸림.
>    - **SLA 없음**: 전 세계 유저가 공유하는 무료 풀(Pool)이라 서버 상태에 따라 속도가 들쭉날쭉함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님이 100% 무료 API의 현실적인 제약을 인지하시고, 이를 앱 내부에서 어떻게 처리(예: 캐싱, 에러 처리, 혹은 유저 트래픽 예상)할지 정확한 의사결정을 내릴 수 있도록 돕기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 사장님께 한계점을 보고하고, 이 무료 API를 앱에 적용할지 말지 최종 지시를 대기함.)
