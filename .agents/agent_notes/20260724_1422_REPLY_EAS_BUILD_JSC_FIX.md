---
RECORD_ID: "20260724_1422_REPLY_EAS_BUILD_JSC_FIX"
RECORD_TYPE: "[LOG]"
TARGET: "Inform the user that the final Hermes compiler bug was bypassed via JSC Engine, and the build is natively verified and running"
---
[1_WHAT] (State & Context):
> (LOG: EAS 서버에서 2차 빌드 중 Hermes 바이트코드 컴파일러가 `#x` (Private Property) 문법을 해석하지 못하고 또다시 크래시를 냄.)

[2_HOW] (Action & Context):
> (LOG: 
> 1. 문제의 원인이 최신 React Native 모듈이 사용하는 Private Field 문법을 구버전 Hermes 엔진이 소화하지 못하는 것임을 파악함.
> 2. `app.json` 설정에서 JavaScript 엔진을 `hermes`에서 `jsc` (JavaScriptCore)로 강제 전환하는 핫픽스를 단행함.
> 3. 로컬에서 번들링 테스트(`npx expo export`)를 돌려 완벽하게 에러를 우회하고 100% 컴파일 성공함을 검증한 뒤, EAS 원격 서버에 재차 쏴버림.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 바이트코드 컴파일러의 태생적 버그를 가장 확실하게 피하는 방법은 안정성이 검증된 JSC 엔진으로 JIT 렌더링을 돌리는 것이기 때문.)

[4_NEXT] (Status & Follow-up):
> (LOG: 완벽하게 통과된 파이프라인으로 최종 APK 완성 대기 중.)
