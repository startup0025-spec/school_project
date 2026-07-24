---
RECORD_ID: "20260716_1803_GOAL_ERROR_PATCH_START"
RECORD_TYPE: "[LOG]"
TARGET: "Fix 14 pre-existing + patch-introduced TS errors: missing packages + implicit any types + WebView overload"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 /goal 긴급 에러 패치를 선언하셨음. tsc 결과 14건의 에러가 존재함. 이전 분석에서 "기존 에러"로 분류했지만, _layout.tsx의 expo-task-manager import는 내 패치가 직접 추가한 것이므로 내 책임으로 처리함. 모든 에러를 근본 원인별로 해결함.)

[2_HOW] (Action & Details):
> (LOG:
> 1. 규정에 따라 즉각 본 챗로그 문서를 최우선 생성하여 파이프라인 무결성을 보장함.
> 2. 에러 분류:
>    A. 패키지 미설치 에러 (TS2307): expo-task-manager, expo-av, expo-file-system, expo-network, expo-notifications, axios, axios-cache-interceptor → expo install + npm install로 해결
>    B. 암묵적 any 타입 에러 (TS7006): client.ts 6건, audio_engine_service.ts 2건 → 타입 명기로 해결
>    C. WebView 오버로드 에러 (TS2769): map.tsx L553 → 코드 확인 후 수정
> 3. 수행 순서:
>    - task.md 작성 → 패키지 설치 → 타입 에러 수정 → tsc 검증 → Self-Review → 완료 로그
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: /goal 모드는 완료까지 중단 없이 철저히 실행해야 하며, BERRY 룰의 [PERSISTENCE]와 [ALETHEIA PIPELINE LOCK]에 따라 챗로그 선행 없이 코드를 먼저 수정하는 것은 엄격히 금지되어 있음.)

[4_NEXT] (Status & Follow-up):
> (LOG: task.md 작성 후 즉각 패키지 설치 및 코드 수정 착수.)
