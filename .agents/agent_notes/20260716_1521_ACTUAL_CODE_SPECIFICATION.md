---
RECORD_ID: "20260716_1521_ACTUAL_CODE_SPECIFICATION"
RECORD_TYPE: "[LOG]"
TARGET: "Establish a definitive UX UI specification document based strictly on the current code truth"
---
[1_WHAT] (State & Context):
> (LOG: 사장님 지시에 따라 구버전 명세를 버리고, 현재 실제 구동되는 모바일 코드([_layout.tsx], [index.tsx], [sound.tsx], [map.tsx], [diary.tsx], [safety.tsx], [notifications.tsx])에 기초한 '최신 진실의 UI/UX 설계 명세서'를 정밀하게 복원하여 로깅함. 답변 전 챗로그 룰 준수함.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 규정에 따라 즉각 본 챗로그 문서를 최우선 생성하여 파이프라인 무결성을 보장함.
> 2. 실제 코드에 구현된 UI/UX 설계 분석:
>    - **홈 (`index.tsx`)**: 3대 유동 메시지 배너 제공. 시뮬레이션은 3단계(`calm`, `walking`, `busy`)만 제공하여 구조 단순화.
>    - **소리 (`sound.tsx`)**: 물소리 3종(시냇물, 강물, 바다) 칩 버튼에 햅틱 연동. local State `playing` 토글에 따른 파형(`flow`/`idle`/`glitch`) 동적 변화.
>    - **물길 (`map.tsx`)**: 카카오맵 위에 사용자/장소 마커 렌더링. 하단 카드의 UGC 기록용 `Modal` 및 `TextInput` 직접 소감 기입 제공. 딥링크를 통한 kakaomap 앱 구동 및 `quiet-map.png` 오프라인 이미지 폴백.
>    - **기록 (`diary.tsx`)**: `movement === 'calm'` 시에만 시뮬레이션용 '10분 기록' 버튼 활성화. 리스트에 시간 역순 타임라인 드로잉.
>    - **안전 (`safety.tsx`)**: 안전/위험 수동 세그먼트 제공. 위험 진입 시 `glitch` 파형 모션 및 `/map` 이동 대피 링커 제공.
>    - **알림 기록 (`notifications.tsx`)**: 홈 우측 벨 버튼으로 이동하며, 그동안 수집된 무음 넛지 푸시를 타임라인으로 노출.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님께 구버전의 잔재가 아닌 현재 소스코드 그대로의 사용자 경험 시나리오를 명확히 구조화해 드려 실질적인 발표 준비 자료로 쓰이게 하기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 코드 기반 UI/UX 실전 명세서 최종 보고.)
