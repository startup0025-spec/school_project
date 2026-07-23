---
RECORD_ID: "20260716_1754_GOAL_EMERGENCY_PATCH_START"
RECORD_TYPE: "[LOG]"
TARGET: "Begin /goal emergency patch — implement 4 disconnected pipelines with objective review"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 /goal 긴급패치를 선언하셨고, BERRY 룰에 따라 모든 코드 수정 전 챗로그를 반드시 먼저 작성해야 하며 최대한 객관적 입장에서 검토를 포함할 것을 명하심. 4가지 미연결 파이프라인을 순차적으로 연결하고 tsc 검증 및 스스로 객관적 리뷰까지 수행한다.)

[2_HOW] (Action & Details):
> (LOG:
> 1. 규정에 따라 즉각 본 챗로그 문서를 최우선 생성하여 파이프라인 무결성을 보장함.
> 2. 수행 순서:
>    A. task.md 작성 (체크리스트)
>    B. Step1: _layout.tsx → startAdaptiveTracking() 기동 배선
>    C. Step2: geofencing_service.ts → checkGeofenceAndSafety 연동 및 danger/warning emit 주입
>    D. Step3: notification_service.ts → triggerDangerNotification 함수 추가
>    E. Step4: sound.tsx → playAmbientSound/stopAmbientSound 연결
>    F. tsc 검증
>    G. 객관적 Self-Review (기능/코드 품질/엣지케이스 3가지 관점)
>    H. walkthrough.md 작성 및 최종 보고
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: /goal 모드는 완료까지 중단 없이 철저히 실행해야 하며, BERRY 룰의 [PERSISTENCE]와 [ALETHEIA PIPELINE LOCK]에 따라 챗로그 선행 없이 코드를 먼저 수정하는 것은 엄격히 금지되어 있음.)

[4_NEXT] (Status & Follow-up):
> (LOG: task.md 작성 후 즉각 코드 수정 착수.)
