---
RECORD_ID: "20260716_1248_DIFFICULTY_COMPARISON"
RECORD_TYPE: "[LOG]"
TARGET: "Compare current plan with original blueprint regarding development difficulty"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 원래 설계서(블루프린트)와 현재 야매 플랜의 차이점, 그리고 개발 난이도가 얼마나 대폭 감소했는지 비교 브리핑을 요구하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 원래 설계서: 
>    - 백엔드 파이프라인에서 TourAPI 데이터를 OpenAI로 보내서 '서정적 번역'을 수행하고 텍스트를 파싱해야 했음 (프롬프트 엔지니어링 및 AI API 비용 발생).
>    - 로컬 정규식 필터링 엔진을 돌려 상업적 키워드를 억지로 다 걸러내야 했음.
>    - 카카오맵에 강제로 흑백 필터를 씌우는 꼼수 CSS가 필요했음.
> 2. 현재 기획 (UGC 피벗):
>    - AI 모듈 완전 폐기. 백엔드는 그냥 공공데이터 JSON 포워딩 셔틀로 전락함 (난이도 0).
>    - 텍스트 필터링 폐기. 유저가 직접 수동으로 일기를 쓰게 하고 원본 설명은 토글 뒤에 숨김 (가장 직관적인 React Native UI 구현, 난이도 1/10).
>    - 복잡한 길찾기는 카카오맵으로 짬처리 (난이도 하락).
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님의 과감한 '기능 빼기' 결단이 프로젝트의 성공 확률(개발 속도와 버그 감소)을 얼마나 극적으로 끌어올렸는지 수치와 팩트로 증명하기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 사장님께 난이도 하락 체감도를 보고하고, 향후 설계서 업데이트 필요성을 동의함.)
