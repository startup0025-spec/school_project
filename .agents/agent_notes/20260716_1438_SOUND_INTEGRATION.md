---
RECORD_ID: "20260716_1438_SOUND_INTEGRATION"
RECORD_TYPE: "[LOG]"
TARGET: "Integrate background audio/geofencing initialization and UI controls"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 소리 관련 소스코드가 아예 실행되지 않고 누락된 상태임을 지적하심. 실제 코드 스캔 결과, 오디오 엔진(`audio_engine_service.ts`)과 위치 추적(`geofencing_service.ts`)은 정밀 설계되었으나 앱 기동부 및 화면 컨트롤러 단에서 단 한 번도 실행되지 않는 거대한 커넥트 누락 버그를 발견함. 이를 해결하기 위해 로직을 바인딩하고 로깅함. 답변 전 챗로그 룰 준수함.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 즉시 본 챗로그 문서를 생성하여 파이프라인 무결성을 보존함.
> 2. `_layout.tsx`에 `geofencing_service`를 임포트하여 백그라운드 태스크를 시스템에 등록하고, 부팅 시 `startAdaptiveTracking()`을 자동 실행하여 GPS 지오펜싱을 구동함.
> 3. `RippleContext.tsx`에 `isPlaying` 상태를 추가하여 소리 화면의 재생/정지 및 시냇물/강물/바다 선택(수동)이 실제 `playAmbientSound`/`stopAmbientSound` 엔진 함수를 연동 호출하도록 바인딩함.
> 4. 지오펜싱 백그라운드 이벤트(`onTrackingStateUpdate`) 수신 시, 사용자가 수변 진입으로 소리가 교체될 때 UI 상태(`waterSource`)도 동기화되어 바뀌도록 연동 구조 완성.
> 5. `sound.tsx` 화면 UI가 `useRipple`에서 제공하는 전역 오디오 상태(`isPlaying`, `setIsPlaying`)를 활용해 재생 상태를 정상적으로 제어하도록 UI 바인딩 수정.
> 6. 컴파일 에러가 없는지 타입스크립트 빌드 테스트 예정.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 핵심 소리 기능이 소스코드 내 고립되어 유저에게 닿지 않던 문제를 완벽하게 해결하여, 실제 소리가 흘러나오고 화면 버튼들이 물리적으로 작동하도록 구조를 봉합하기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 최종 조치 후 컴파일 무결성을 사장님께 보고.)
