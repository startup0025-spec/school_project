---
RECORD_ID: "20260716_1037_ON_DEVICE_LLM_REVIEW"
RECORD_TYPE: "[LOG]"
TARGET: "Review user's proposal to run Bllossom-3B On-Device and provide architectural feedback"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 외부 AI 상담 내역을 가져오시며, 서버가 아닌 '유저 휴대폰 자체 연산 장치(On-Device)'에서 Llama-3.2-Korean-Bllossom-3B(2GB) 모델을 구동하는 방식으로 아키텍처를 변경하겠다고 선언하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 사장님의 긴 상담 로그를 정독하여 의도(서버 비용 0원, 완전 무료, 모바일 로컬 연산)를 정확히 파악함.
> 2. 기술적 팩트 체크: React Native(현재 Expo 환경)에서 GGUF 모델을 폰에서 직접 돌리는 것(`react-native-llama` 등 활용)은 기술적으로 가능함.
> 3. 하지만 치명적인 트레이드오프 3가지를 정리하여 사장님께 보고할 예정:
>    - 앱 다운로드 용량이 최소 2GB 이상으로 폭증 (유저 이탈률 급증)
>    - 유저 휴대폰 배터리 광탈 및 발열 심화
>    - 순수 Expo Go 모드 불가능 (Native 모듈 Eject/Prebuild 필수)
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 무작정 코드를 고치기 전에 On-Device LLM의 치명적인 단점을 사장님이 명확히 인지하게 하여, 추후 앱스토어 심사나 유저 불만 등의 프로젝트 리스크를 방어하기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 사장님께 온디바이스 아키텍처의 장단점을 브리핑하고, "앱 용량 2GB 감수 + 폰 연산" vs "기존처럼 서버(또는 깃허브 액션)에서 굽고 앱은 가볍게 유지" 중 최종 결정을 기다림.)
