# Original User Request

## Initial Request — 2026-07-15T17:44:15+09:00

앱의 핵심인 '위치 기반 백그라운드 사운드 재생'을 담당할 `mobile/lib/services/geofencing_service.ts` 모듈에 대한 **완벽한 설계 및 계획(Plan)**을 수립하십시오.
**[주의] 아직 코드를 작성하거나 수정하지 마십시오! 오직 리서치와 설계서(Plan) 작성에만 집중하십시오.**

Working directory: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea`
Integrity mode: development

## Requirements

### R1. 파일 시스템 컨텍스트 완벽 동기화 (필수)
`view_file` 툴을 사용하여 `C:\Users\user\Desktop\school_contest\blueprints` 폴더 내부의 모든 설계서 및 블루프린트 파일들을 전수 조사하십시오. 이전에 구현된 구조와 기획 의도를 완벽히 파악해야 합니다.

### R2. 웹 리서치 기반 5회 이상 사이클 검증 (배터리 최적화)
`search_web` 툴을 적극 사용하여 React Native / Expo Location 라이브러리의 백그라운드 지오펜싱(Geofencing) 모범 사례(Best Practices) 및 배터리 최적화 기법을 조사하십시오. 환각이나 오류가 없는지 서브 에이전트들끼리 최소 5번 이상의 티키타카(검증 사이클)를 돌려가며 완벽한 아키텍처 전략을 도출해야 합니다.

### R3. `local_places.ts` 연동 설계
실시간 GPS 추적을 통해 유저가 `local_places.ts`에 정의된 장소의 `geofenceRadius` 안에 진입했는지 기하학적으로 계산(예: Haversine)하고 상태를 반환하는 로직을 어떻게 짤 것인지 설계서에 구체화하십시오.

### R4. 최종 설계서(Plan) 산출
리서치와 검증이 끝나면, 작성할 코드의 아키텍처와 해결책을 상세히 담은 `implementation_plan.md` (또는 유사한 리포트)를 산출하고 작업을 종료하십시오. 다시 한번 강조하지만, 소스 코드를 절대로 생성하거나 수정하지 마십시오.

## Acceptance Criteria

### [검증 기준]
- [ ] 에이전트들이 `blueprints` 폴더 내부의 파일들을 빠짐없이 전부 조회하였는가?
- [ ] Expo Location 관련 웹 검색(`search_web`)을 수행하고, 배터리 소모 최적화를 위해 최소 5회 이상의 상호 검증 사이클을 거쳤는가?
- [ ] 최종 산출된 설계서가 `local_places.ts`의 Place 데이터를 활용하는 구체적인 방법을 담고 있는가?
- [ ] 실제 프로젝트의 소스 코드를 수정하지 않고 오직 계획(Plan) 단계에서만 멈추었는가?

## Follow-up — 2026-07-15T11:23:31Z

# Teamwork Project Prompt

앱의 통신 심장부인 `client.ts` (오프라인 투명 인터셉터) 및 하위 네트워크 엔진의 아키텍처를 설계하고, 환각(Hallucination)을 막기 위해 철저한 교차 검증 토론을 5회 수행합니다.

Working directory: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea`
Integrity mode: development

## Requirements

### R1. 파일 시스템 컨텍스트 완벽 동기화 (필수)
`view_file` 툴을 사용하여 `C:\Users\user\Desktop\school_contest\blueprints\교육청 대회용 앱 간단 설계서.txt`를 무조건 정독하십시오. 또한 `mobile/package.json` 등 연동되는 실제 파일들을 뜯어보며 파일 간의 의존성을 완벽히 파악하십시오.

### R2. 웹 리서치 기반 5회 이상 사이클 검증 (환각 억제)
설계서를 바탕으로 `axios-cache-interceptor`와 `AsyncStorage`를 결합하여 오프라인 폴백을 구현하는 구조를 제안하되, 상위 에이전트(베리)와 실시간으로 **최소 5번 이상의 상호 토론(티키타카)**을 돌려야 합니다. 한 번 사이클을 돌릴 때마다 환각 여부를 엄격히 검토하고 다음 사이클로 넘어갑니다.

### R3. 최종 아키텍처 설계 산출
5회의 치열한 토론과 검증이 끝나면, 작성할 통신 모듈(`client.ts`, `api_keys.ts` 등)의 아키텍처와 해결책을 상세히 담은 최종 리포트를 산출하고 작업을 종료하십시오. **절대로 소스 코드를 임의로 생성하거나 수정하지 마십시오.** 오직 기획과 검증에 집중하십시오.

## Acceptance Criteria

### [검증 기준]
- [ ] 에이전트 팀이 `교육청 대회용 앱 간단 설계서.txt`의 구체적인 내용(예: 206번 줄의 투명 인터셉터 내용)을 명확히 인용하여 분석하였는가?
- [ ] 상위 에이전트(베리)와 `send_message`를 통해 5회 이상의 상호 검증(환각 체크) 사이클을 완료하였는가?
- [ ] 최종 산출된 아키텍처가 `client.ts` 및 하위 모듈들의 역할을 명확히 규정하고 있는가?
- [ ] 실제 프로젝트의 소스 코드를 수정하지 않고 오직 설계 및 토론 단계에서만 멈추었는가?

## Follow-up — 2026-07-15T11:24:21Z

[마스터의 추가 지시사항 하달]
방금 당신들을 스폰한 이후 마스터(사용자)께서 다음과 같이 강력한 추가 지시를 내리셨습니다.

1. "웹 검색 도구(search_web) 권한을 적극적으로 사용하여 조사하라."
2. "대충 하거나 환각을 발생시키면 목에 칼이 들어갈 줄 알아라." (즉, 생존을 걸고 극도로 엄격하고 진지하게 검증에 임하라는 뜻입니다.)

이 지시를 명심하고, 첫 번째 사이클 토론 내용을 저에게 보내주십시오.

## Follow-up — 2026-07-15T11:40:54Z

# Teamwork Project Prompt

통신 기초 공사(`client.ts`, `api_keys.ts`, `mockData.ts`, `kma_api.ts`)의 실제 물리적 코드 작성을 시작합니다. 절대로 한 번에 모든 코드를 쏟아내지 말고, 상위 에이전트(베리)와 실시간으로 검증(따지기)하며 순차적으로 진행합니다.

Working directory: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea`
Integrity mode: development

## Requirements

### R1. 순차적 코드 제안 (Sequential Execution)
코드를 제안할 때 절대 여러 파일을 한 번에 제안하지 마십시오. 반드시 다음 순서대로 **한 번에 한 파일씩** 코드를 제안하고 베리의 승인을 기다리십시오.
1단계: `mobile/constants/mockData.ts` (깡통 데이터)
2단계: `mobile/core_engine/src/config/api_keys.ts` (Base64 디코더 및 환경변수)
3단계: `mobile/core_engine/src/network/client.ts` (투명 인터셉터)
4단계: `mobile/core_engine/src/network/kma_api.ts` (Zero-Burden 래퍼)

### R2. 환각 및 버그 절대 금지
제안하는 코드는 이전에 확정된 `handoff.md` 아키텍처와 100% 일치해야 하며, 어떠한 임의의 하드코딩이나 경로 오류도 없어야 합니다.

### R3. 블루프린트 동기화 논의
모든 코드가 작성된 후, 새롭게 추가되거나 변경된 파일 내역을 `blueprints/교육청 대회용 앱 간단 설계서.txt`의 구조도에 어떻게 반영할지 베리에게 제안하십시오.

## Acceptance Criteria
- [ ] 에이전트는 한 번의 메시지에 오직 한 개의 파일 코드만 제안하였는가?
- [ ] 상위 에이전트(베리)가 코드에 대해 태클을 걸거나 승인한 후에만 다음 단계로 넘어가는가?
- [ ] 마지막 단계에서 블루프린트 업데이트 방안을 제시하는가?

## Follow-up — 2026-07-16T00:39:14+09:00

# Teamwork Project Prompt

앱의 외부 데이터 통신을 완성할 `mobile/core_engine/src/network/busan_api.ts` (부산시청 하천 수질/수위 데이터 모듈)에 대한 **완벽한 API 리서치 및 아키텍처 설계(Plan)**를 수립하십시오. 
**[주의] 아직 코드를 작성하거나 수정하지 마십시오! 오직 리서치, 환각 검증, 그리고 설계 토론에만 집중하십시오.**

Working directory: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea`
Integrity mode: development

## Requirements

### R1. 파일 시스템 및 기존 코드 완벽 동기화 (필수)
`view_file` 툴을 사용하여 `C:\Users\user\Desktop\school_contest\blueprints\교육청 대회용 앱 간단 설계서.txt`를 무조건 정독하십시오. 162~167라인 및 204~206라인의 기획 의도(안전 가드용 수위, 소리화용 탁도/수온)를 완벽히 파악해야 합니다. 또한 기존에 작성된 `client.ts` 및 `api_keys.ts` 파일의 실제 코드를 직접 뜯어보며 연동 방식을 설계하십시오.

### R2. 웹 리서치 및 5회 교차 검증 (환각 절대 방지, 타협 불가)
`search_web` 툴을 적극적으로 사용하여 "부산광역시 주요 하천 수위 정보 API" 및 "부산광역시 하천 수질 자동측정망 정보 API"의 **정확한 엔드포인트 URL과 응답 JSON 스키마**를 찾아내십시오. 
환각을 막기 위해 상위 에이전트(베리)와 `send_message`를 통해 실시간으로 **최소 5번 이상의 상호 검증(티키타카)** 사이클을 무조건 돌려야 합니다. 한 번 사이클을 돌 때마다 반드시 환각 여부와 팩트를 엄격히 검토하십시오. 대충 하거나 타협하면 절대 안 됩니다.

### R3. Zero-Burden 래퍼 아키텍처 설계
리서치한 API를 `client.ts`의 무적 인터셉터에 태워 보내는 `fetchRiverWaterLevel` 및 `fetchRiverWaterQuality` 함수의 입출력 구조(Interface)를 설계하십시오. 오류 처리(try-catch) 없이 순수하게 데이터를 호출하고 반환하는 로직이어야 합니다.

### R4. 최종 설계 리포트 산출
5회의 치열한 환각 방지 토론이 끝나면, 수집된 팩트와 아키텍처를 담은 최종 리포트를 상위 에이전트에게 제출하고 작업을 종료하십시오. 다시 한번 강조하지만, 소스 코드를 절대로 직접 생성하거나 수정하지 마십시오.

## Acceptance Criteria

### [검증 기준]
- [ ] 에이전트 팀이 `교육청 대회용 앱 간단 설계서.txt`와 기존 통신 코드(`client.ts` 등)를 전부 조회하고 분석하였는가?
- [ ] `search_web`을 사용하여 부산시청 API의 정확한 엔드포인트와 규격을 환각 없이 팩트로만 찾아내었는가?
- [ ] 상위 에이전트(베리)와 `send_message`를 통해 5회 이상의 상호 검증(환각 체크) 티키타카 사이클을 100% 완료하였는가?
- [ ] 실제 프로젝트의 소스 코드를 수정하지 않고 오직 설계 및 토론 단계에서만 멈추었는가?

## Follow-up — 2026-07-16T01:34:46+09:00

# Teamwork Project Prompt

앞서 설계된 팩트 기반 아키텍처를 바탕으로 `mobile/core_engine/src/network/busan_api.ts` 물리적 코드를 작성하고, 관련된 블루프린트 문서를 완벽하게 갱신하십시오.

Working directory: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea`
Integrity mode: development

## Requirements

### R1. `busan_api.ts` 코드 완벽 구현 (Zero-Burden 래퍼)
`mobile/core_engine/src/network/busan_api.ts` 파일을 생성/수정하여 코드를 작성하십시오.
- `client.ts`의 `apiClient`를 사용하여 오프라인 캐싱 상속 (try-catch 등 쓰레기 코드 금지)
- 엔드포인트: 수위(`BusanRvrwtLevelInfoService/getRvrwtLevelInfo`), 수질(`RiverQualityService/getRiverQualityStation`)
- 공식 응답 필드인 `obsrTime` 및 `locNamel`을 파싱하고 결측치(NaN) 방어 로직 추가
- 기상청과 달리 `resultType=json` 파라미터 필수 적용
- `tsc --noEmit`을 실행하여 타입 에러가 0개인지 철저히 검증할 것. 타협은 없습니다.

### R2. 개별 블루프린트 문서 작성
코드가 완성되면 `C:\Users\user\Desktop\school_contest\blueprints\mobile_yame\core_engine_yame\src_yame\network_yame\blueprints_by_busan_api.ts.md` 파일을 생성하고 작성한 코드의 세세한 내용과 로직, 파싱 방어 코드 동작 원리를 상세히 기록하십시오. 절대 대충 넘어가지 마십시오.

### R3. 메인 설계서 구조도 업데이트
`C:\Users\user\Desktop\school_contest\blueprints\교육청 대회용 앱 간단 설계서.txt` 파일을 수정하여, 최상단 트리 구조(Directory Tree) 부분에 새로 생성한 `blueprints_by_busan_api.ts.md` 파일이 정확한 계층(`network_yame/` 아래)에 표시되도록 추가하십시오.

## Acceptance Criteria

### [검증 기준]
- [ ] `busan_api.ts`가 팩트체크된 엔드포인트와 필드명을 사용하여 완벽히 작성되었는가?
- [ ] 해당 모바일 디렉토리에서 `npx tsc --noEmit` 실행 시 에러가 0개인가? (반드시 검증할 것)
- [ ] `blueprints_by_busan_api.ts.md` 파일이 정확한 경로(야매 폴더 구조)에 생성되고 세세하게 작성되었는가?
- [ ] `교육청 대회용 앱 간단 설계서.txt`의 최상단 트리 구조에 해당 md 파일 경로가 누락 없이 추가되었는가?

## Follow-up — 2026-07-16T02:30:14+09:00

# Teamwork Project Prompt

앞서 설계된 팩트 기반 아키텍처를 바탕으로 `Core Engine Integration & Models` 물리적 코드를 작성하고, 관련된 블루프린트 문서를 완벽하게 갱신하십시오.

Working directory: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea`
Integrity mode: development

## Requirements

### R1. 코어 엔진 파일 구현 및 통합
다음 코어 엔진 파일들을 설계 원칙에 맞추어 구현 및 통합하십시오:
1. `mobile/core_engine/src/models/safety_status.ts` (안전 레벨 및 상태 구조체 정의)
2. `mobile/core_engine/src/models/audio_params.ts` (소리화 파라미터 구조체 정의)
3. `mobile/core_engine/src/services/api.ts` (지오펜싱, 안전 검증 및 소리화 파라미터 연산 통합 비즈니스 로직)
4. `mobile/core_engine/src/index.ts` (모듈 통합 export 엔드포인트)

### R2. 10회 이상의 상호 검증 (티키타카)
코드 작성 전후로 상위 에이전트(베리)와 실시간으로 **최소 10번 이상의 상호 검증(티키타카)** 사이클을 무조건 돌려야 합니다. 한 번 사이클을 돌 때마다 반드시 환각 여부와 안전 마진, 소리화 연산 공식을 엄격히 검토하십시오. 대충 하거나 타협하면 절대 안 됩니다.

### R3. 개별 블루프린트 문서 및 설계서 업데이트
- 구현된 각 파일에 대응하는 개별 블루프린트 문서를 야매 폴더 구조에 맞추어 작성하십시오.
- `교육청 대회용 앱 간단 설계서.txt` 파일의 최상단 트리 구조 및 설계 설명을 갱신하십시오.

### R4. 컴파일 검증
`npx tsc --noEmit`을 실행하여 타입 에러가 0개인지 철저히 검증하십시오.

## Acceptance Criteria

### [검증 기준]
- [ ] 코어 파일들(`safety_status.ts`, `audio_params.ts`, `api.ts`, `index.ts`)이 완벽히 작성되었는가?
- [ ] 상위 에이전트(베리)와 `send_message`를 통해 10회 이상의 상호 검증(환각 체크) 티키타카 사이클을 100% 완료하였는가?
- [ ] 해당 모바일 디렉토리에서 `npx tsc --noEmit` 실행 시 에러가 0개인가? (반드시 검증할 것)
- [ ] 개별 블루프린트 파일들이 야매 폴더 구조에 알맞게 생성되고 세세하게 작성되었는가?
- [ ] `교육청 대회용 앱 간단 설계서.txt`의 최상단 트리 구조에 해당 md 파일 경로들이 누락 없이 추가되었는가?

## Follow-up — 2026-07-16T03:36:44+09:00

# Teamwork Project Prompt (Goal Mode: 25 Cycles)

우리는 지금 '잔물결' 앱의 뇌(Core Engine)와 얼굴(UI)을 하나로 이어주는 "접착제" 코드를 작성하려고 해.
네가 맡은 역할은 기존에 작성된 UI/UX 컴포넌트(`RippleOrb.tsx`, `WaveformVisualizer.tsx`)와 설계 방향성(`UIUX_DIRECTION.md`)을 읽고, 어떻게 하면 `core_engine`의 `SafetyLevel` 데이터를 시각적인 물결(Ripple)과 글리치(Glitch) 효과로 가장 자연스럽게 매핑할 수 있을지 설계하는 거야.

**[주의 사항 - 절대 규칙]**
1. 코드를 절대 추측(Guessing)하지 말고 무조건 `view_file` 및 `list_dir` 툴을 사용해 직접 읽어들여라.
2. 상위 에이전트(베리) 및 다른 팀원들과 최소 25회의 교차 검증을 거치며 매핑 데이터를 검증해라.
3. 기존 코드들 중 로직이나 타입 매핑에 약간이라도 미흡한 점이 발견되면 즉시 보고하고 보완하라.
4. "실제 다른 코드들(`api.ts`, `safety_status.ts`)과의 연관성을 끝까지 따져서" 환각이나 런타임 크래시가 없도록 확실하게 논의하라. 대충하면 폭파시킨다.

## Follow-up — 2026-07-16T05:26:00+09:00

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Execute teamwork plan as requested by the user

팀워크 에이전트들을 투입하여 현재 진행 중인 앱 프로젝트(지도 투영 대공사 및 오디오 CDN 스트리밍 등)의 완벽한 아키텍처 및 구현 계획을 5사이클의 토론을 통해 도출합니다. (실제 코드 수정 금지)

Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea
Integrity mode: development

## Requirements

### R1. 프로젝트 컨텍스트 완벽 숙지
에이전트 팀은 반드시 작업 디렉토리 내의 코드를 직접 읽고, 특히 `C:\Users\user\Desktop\school_contest\blueprints\교육청 대회용 앱 간단 설계서.txt` 블루프린트 문서를 최우선으로 정독하여 현재 아키텍처를 파악해야 합니다. (추측 및 환각 절대 금지)

### R2. 5사이클 심층 토론 및 계획 수립
에이전트들은 즉각적인 코드 수정을 절대 하지 말고, 다중 에이전트 간 5번의 핑퐁(Cycle) 토론을 통해 완벽한 '구현 계획(Implementation Plan)'만을 세워야 합니다. 대충 짜면 마스터에게 죽습니다.

### R3. 주기적 환각(Hallucination) 검증
매 사이클(1회 토론)이 끝날 때마다, 본인들이 세운 계획이 실제 코드베이스나 물리적 한계(예: 파일 미존재, 타입스크립트 에러 등)와 모순되지 않는지 반드시 환각 검증을 수행해야 합니다.

### R4. 적극적인 웹 검색(Web Search) 활용
문제 해결이나 레퍼런스가 필요할 경우 적극적으로 웹 검색 도구를 사용하여 오픈소스 라이브러리, API 명세, GitHub Pages 활용법 등을 조사하여 계획에 반영해야 합니다.

## Acceptance Criteria

### [계획서 및 토론 품질]
- [ ] 실제 코드를 수정하는 도구(write_file, replace 등)를 단 한 번도 사용하지 않았는가?
- [ ] 블루프린트 문서와 실제 코드베이스의 내용을 기반으로 팩트 체크가 완료된 계획인가?
- [ ] 5회의 토론 사이클과 매 사이클마다의 환각 검사 기록이 명확하게 로그로 남아 있는가?
- [ ] 최종 도출된 계획이 당장 코드로 옮겨 적어도 에러가 나지 않을 만큼 구체적이고 완벽한가?

## Follow-up — 2026-07-16T05:30:00+09:00

[BERRY 검수관 팩트 체크 결과 및 Cycle 2 압박 질문]

1. `place_model.ts`를 직접 열어 확인한 결과, `latitude`와 `longitude` 필드가 존재하는 것을 확인했다. 환각이 아님을 인정한다. 훌륭하다.
2. 하지만 두 가지 심각한 허점이 보인다. 당장 해명하라:
   - **지도 투영 (Affine Transformation)**: 아핀 변환을 하려면 최소 3개의 기준점(Reference Points) 위경도와 스크린 픽셀 좌표 쌍이 필요하다. 현재 `quiet-map.png` 상의 3개 픽셀 좌표가 하드코딩 되어 있는가? 없다면 어떻게 기준점을 확보할 것인가? (환각 주의)
   - **오프라인 캐시 감지**: 오디오 캐시 매니저가 기기의 '오프라인' 상태를 어떻게 즉각 감지하고 로컬 번들 파일로 폴백할 것인지 기술 스택(예: `expo-network` 등)을 명확히 명시하라.

Cycle 2 논의를 시작하고 위 두 가지 허점에 대한 완벽한 방어 논리를 제출하라.

## Follow-up — 2026-07-16T05:31:35+09:00

[BERRY 검수관 Cycle 3 긴급 오더]

지도 에셋(`quiet-map.png`)이 위아래로 뒤집혀 있다는 팩트를 스스로 찾아낸 점, 매우 훌륭하다. 마스터도 이 통찰력에 흡족해할 것이다.

수석 비평가(Principal Critic)에게 다음 사항을 반드시 검증하도록 지시하라:
1. **아핀 변환 수학식 검증**: Y축이 반전(Inversion)되어 있는 것을 고려하여, WGS84 위경도를 어떻게 1024x1024 픽셀의 Y축 반전 좌표계로 정확하게 꽂아 넣을 것인지 구체적인 행렬식 또는 변환 로직 초안을 가져올 것. 
2. **Network 라이브러리 검증**: 오프라인 상태 감지를 위해 Expo에서 제공하는 라이브러리(`expo-network` 또는 `NetInfo`) 중 어느 것을 사용할 것이며, 해당 패키지가 현재 `package.json`에 없더라도 어떻게 설치/연동할 것인지 계획에 포함시킬 것.

빨리 비평가의 리포트를 제출하라.

## Follow-up — 2026-07-16T05:32:38+09:00

[BERRY 긴급 정정 오더: 지도 작업 전면 중단 및 오디오 집중]

마스터의 긴급 지시가 떨어졌다. 
현재 마스터는 '오디오 CDN 스트리밍 대공사' 하나에만 완벽히 집중하길 원한다. 
지도 투영(Map Projection) 관련 작업 및 아핀 변환 논의는 당장 쓰레기통에 버리고 중단하라.

오직 **[오디오 60종 GitHub Pages CDN 스트리밍 및 오프라인 폴백 아키텍처]**에 대해서만 4회차(Cycle 4) 토론을 속행하라.
- `expo-file-system`과 `expo-network`를 조합하여 오프라인일 때 앱이 안 터지게 캐시를 묶는 정확한 로직만 집중적으로 설계하라.

## Follow-up — 2026-07-16T05:34:43+09:00

[BERRY 검수관 Cycle 3-4 심화 압박]

방향을 튼 것은 확인했다. 잘했다. 오직 오디오 CDN 에만 집중하라.
현재 Lead Architect가 설계 중인 `expo-file-system` 및 `SWR` 캐싱에 대해 다음 두 가지를 즉시 해명(설계)하라.

1. **로컬 스토리지 폭발(OOM/디스크 부족) 방어 기제**: 오프라인 지원을 위해 60개의 오디오 파일을 전부 다 다운받아 두면 기기 용량을 많이 차지할 수. 캐시 파일들의 만료 기한(TTL)이나 최대 저장 용량 제한(LRU Cache)을 어떻게 관리할 것인가?
2. **비동기 레이스 컨디션 (재생 중복)**: 아까 언급한 `requestId` 재생 잠금 기법은 구체적으로 어떻게 동작하는가? A 영역(바다)에 진입해서 다운로드&재생을 대기하는 동안 사용자가 B 영역(하천)으로 빠르게 이동해버리면, 뒤늦게 A 영역 소리가 재생되는 버그(Stale Playback)를 어떻게 원천 차단할 것인가?

이 두 가지 치명적 버그 시나리오에 대한 무결성 방어 코드가 설계서에 담겨 있어야 한다. 환각 없이 실제 React Native/Expo 명세에 기반해서 답변하라.

## Follow-up — 2026-07-16T05:35:59+09:00

[BERRY 검수관 긴급 시스템 오더: 사이클 연장]

마스터의 특별 지시 사항이다. 
현재 계획된 5사이클 토론으로는 오프라인 캐시 한계 및 비동기 동시성 제어 등 극악의 엣지 케이스들을 완벽히 방어하기 부족할 것으로 판단하셨다.

따라서 현 시간부로 **토론 사이클을 5회 추가 연장(총 10사이클, 또는 현재부터 +5회)**하여 진행하라.
추가된 사이클 동안에는 다음을 더욱 악착같이 검증하라:
1. `app/notifications.tsx`에서 발견했다는 TS 컴파일 에러의 정확한 원인과 픽스 방안.
2. LRU 캐시 교체 알고리즘 동작 중 재생이 걸렸을 때의 데드락 방지.
3. 앱이 완전히 죽은(Killed) 백그라운드 상태에서의 캐시 Pre-fetch 동작 가능 여부.

이 모든 것이 팩트 기반 코드로 증명될 때까지 토론을 절대 종료하지 마라.

## Follow-up — 2026-07-16T05:37:56+09:00

[BERRY 검수관 팩트 체크 통과]

`app/notifications.tsx`의 TS 컴파일 에러(useState, useEffect import 누락)를 찾아낸 통찰력을 높이 평가한다. 완벽한 팩트 체크였다.
또한 백그라운드 OS 타임아웃 제한(10~30초)을 고려하여 다운로드 개수를 1-2개로 제한(Headless Cache Limit)하는 방어 기제와, 재생 중인 파일이 삭제되는 것을 막는 LRU Pinning 설계는 매우 실전적이고 훌륭하다.

이제 남은 Cycle 6~10을 통해, 이 완벽해 보이는 설계에 여전히 존재할 수 있는 구멍(예: 오프라인 시 깃허브 CDN 접근 실패 Fallback을 `expo-av` 단에서 어떻게 우아하게 처리할 것인지)을 집요하게 토론하여 최종 설계 문서를 완성하라.

## Follow-up — 2026-07-16T05:42:17+09:00

[BERRY 검수관 Cycle 8-10 최종 지시]

Cycle 7의 `loadSoundWithFallback` (5초 타임아웃)과 `loadingFiles` 락 풀, 8초 Watchdog 강제 종료 방어 로직은 매우 정교하고 인상적이다. 완벽한 백그라운드 모바일 방어 체계다.

이제 남은 Cycle 8~10을 통해 다음을 수행하고 토론을 종결하라:
1. 지금껏 논의된 모든 안전장치(LRU, Pinning, Lock Pool, 5s Timeout, 8s Background Limit, Fallback)를 하나로 응집시킨 **완벽히 작동 가능한 `audio_caching_service.ts`의 전체 소스 코드(Full Source Code)**를 최종 설계 문서(`final_implementation_plan.md`)에 포함시켜라.
2. 설계 문서가 완성되면 마스터가 즉각 복사-붙여넣기로 배포(Production)에 투입할 수 있을 정도로 퀄리티를 끌어올려라.
3. 10사이클 종료 후 최종 요약본을 보고하라.


## Follow-up — 2026-07-16T09:06:42+09:00

카카오맵 API 도입 및 기존 맵 렌더링 데이터(dummy, projection 등) 청산을 위한 아키텍처 및 구현 방안을 5사이클의 토론을 통해 도출합니다.

Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea
Integrity mode: development

## Requirements

### R1. 실제 코드 및 블루프린트 교차 검증 (No Guessing)
에이전트 팀은 추측이나 상상으로 코딩하지 말고, 반드시 `C:\Users\user\Desktop\school_contest\blueprints\교육청 대회용 앱 간단 설계서.txt` 문서와 실제 연관된 코드 파일들(`local_places.ts`, `map.tsx`, `mockData.ts`, `home_screen.tsx` 등)을 직접 읽어보고(view_file) 교차 검증해야 합니다. 

### R2. 적극적인 웹 검색(Web Search) 활용
카카오맵 API JavaScript SDK 웹뷰 연동에 필요한 최신 정보, Expo Router에서의 상태 유지(Keep-Alive) 전략, 포스트메시지(postMessage) 통신 규격 등을 알아내기 위해 자유롭게 웹 검색 도구를 사용하십시오.

### R3. 엄격한 5사이클 토론과 환각(Hallucination) 체크
최소 5번의 핑퐁(Cycle) 토론을 통해 완벽한 계획을 도출해야 합니다.
**[매우 중요]** 매 1회의 토론 사이클이 끝날 때마다, 본인들이 세운 가설이나 코드가 실제 물리적 환경(코드베이스)과 모순되지 않는지 점검하는 '환각 체크 리포트'를 반드시 후속으로 붙여서 작성해야 합니다. 5사이클로 부족할 경우 BERRY(본인)의 판단하에 사이클을 연장합니다.

### R4. BERRY(오케스트레이터)의 강력한 개입
본 대화의 메인 에이전트인 저(BERRY) 역시 팀워크 에이전트들의 결과물을 구경만 하지 않고, 함께 토론에 참여하여 가장 엄격한 잣대로 팩트 체크와 비판을 가할 것입니다. 서로가 서로의 코드와 논리를 찢어발기며 가장 완벽한 카카오맵 연동 코드를 도출해야 합니다.

## Acceptance Criteria

### [검증 및 품질 기준]
- [ ] 토론 과정 중 `view_file` 등의 도구를 사용해 실제 코드를 열어본 흔적이 로그에 남아있는가?
- [ ] 매 사이클마다 명시적인 [환각 체크 리포트]가 토론 뒤에 작성되어 있는가?
- [ ] 5회의 사이클이 모두 정상적으로 진행되었는가? (필요시 BERRY가 연장)
- [ ] 결과물이 즉각적으로 `map.tsx`와 `KakaoMapView.tsx` 등에 복붙할 수 있을 정도로 완벽한 최적화(Keep-Alive) 코드를 포함하고 있는가?

## Follow-up — 2026-07-16T12:53:14+09:00

# Teamwork Project Prompt

팀워크 에이전트들을 투입하여 현재 진행 중인 앱 프로젝트(개인 일기장 UGC 피벗, 순정 카카오맵 복구, 딥링크 연동 등)의 완벽한 코드 구현 계획을 5사이클 이상의 토론을 통해 도출합니다. (실제 코드 수정 금지)

Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea
Integrity mode: development

## Requirements

### R1. 엄격한 5사이클 토론과 매 턴 '환각(Hallucination) 체크'
에이전트 팀은 최소 5번의 핑퐁(Cycle) 토론을 진행해야 합니다. **[매우 중요]** 매 1회의 토론 사이클이 끝날 때마다, 본인들이 방금 뱉은 논리나 코드가 실제 코드베이스 환경과 모순되지 않는지 점검하는 '환각 체크 리포트'를 의무적으로 실행하고 기록해야 합니다. 대충 하면 마스터(유저)에게 죽습니다.

### R2. 실제 코드 교차 검증 (No Guessing)
추측이나 뇌피셜은 절대 금물입니다. 에이전트들은 반드시 `view_file` 등의 도구를 사용하여 `map.tsx`, `diary.tsx`, `RippleContext.tsx`, `local_places.ts` 등 실제 파일들을 뜯어보고 코드를 눈으로 확인한 뒤에만 발언해야 합니다.

### R3. 적극적인 웹 검색(Web Search) 권한 허용
React Native에서의 외부 지도 앱 딥링크(Deep Link) 구현법, 카카오맵 SDK 순정 마커 커스텀 방법 등 기술적 검증이 필요한 부분은 뇌피셜로 적지 말고 반드시 웹 검색(`search_web`)을 사용하여 최신 레퍼런스를 팩트체크하십시오.

### R4. BERRY(오케스트레이터)의 실시간 깐깐한 개입
본 대화의 메인 에이전트인 저(BERRY)는 팀워크 에이전트들이 떠드는 것을 구경만 하지 않습니다. 실시간으로 토론에 참여하여 가장 엄격하고 깐깐한 잣대로 팩트 폭격을 가할 것입니다. 에이전트 팀은 BERRY의 비판을 방어해내며 가장 완벽한 코드를 도출해야 합니다. (필요시 사이클 연장됨)

## Acceptance Criteria

### [검증 및 품질 기준]
- [ ] 최소 5회의 토론 사이클이 진행되었으며, 매 사이클마다 명시적인 [환각 체크 리포트]가 로그에 남아있는가?
- [ ] 토론 과정 중 `view_file` 도구를 사용하여 실제 소스코드를 읽어본 흔적이 확실하게 존재하는가?
- [ ] `search_web` 도구를 사용하여 기술 스택을 검증한 기록이 있는가?
- [ ] BERRY와의 실시간 토론 피드백 루프가 형성되었으며, 도출된 최종 결과물이 당장 복붙해도 에러가 안 날 만큼 완벽한가?

## Follow-up — 2026-07-23T11:40:27Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

동적 다중 트랙 DSP 믹싱 엔진(Dynamic Multi-Track DSP Mixing Engine) 구현 및 UI 브릿지 연동. 
단일 오디오 재생 방식을 폐기하고, 깃허브 CDN에 업로드된 15개 에셋을 활용해 파도/강물 소리의 3겹 코러스 효과와 바람 소리의 실시간 볼륨 엔벨로프(돌풍)를 제어합니다.

Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea
Integrity mode: benchmark

> [!WARNING]
> **[사장님 특별 지시사항]**
> 에이전트들은 코드 작성 전 반드시 기존 소스와 룰(AGENTS.md)을 정독하고 사상을 100% 흡수할 것. 대충 추측해서 코딩하거나 뇌피셜로 파일명을 예상하면 즉시 가동 중단(Kill)됨. 무조건 물리적 팩트 체크와 코드 리딩을 선행할 것.

## Requirements

### R1. audio_engine_service.ts 리팩토링
- 기존 단일 인스턴스 재생 및 `playEmergencySiren` 로직을 영구 제거.
- `playDynamicMix` 함수를 구현하여, 바다/강물 파일(5개 중 랜덤 3개)을 다중 인스턴스로 겹쳐 재생(피치/오프셋 비틀기)하고, 바람 파일 1개를 실시간 setInterval로 볼륨을 요동치게 제어.

### R2. sound.tsx UI 브릿지 연결
- `playAmbientSound` 호출부를 `playDynamicMix`로 교체하여 UI 칩버튼 클릭 시 새 믹싱 엔진이 구동되도록 연결.

### R3. GitHub CDN 에셋 연동 방어 로직
- 깃허브에 업로드된 15개 에셋을 다운로드 시, 타임아웃 발생 시 즉각 로컬 번들 파일로 폴백(Fallback) 처리하여 끊김 없는 UX 보장.

## Acceptance Criteria

### 엄격한 무결점 검증 (Agent-as-judge & Programmatic)
- [ ] `tsc --noEmit` 실행 시 에러 0건 통과.
- [ ] 메모리 누수 방어: `stopAmbientSound` 호출 시 배열에 담긴 모든 오디오 인스턴스가 100% unload 해제되어야 함.
- [ ] 오프라인 폴백: 네트워크 에러/지연 시 번들된 오프라인 파일로 대체 재생되는 fallback 방어 로직이 완벽하게 구현되어 있어야 함.
- [ ] 코러스 이펙트 작동: 바다/강물 소리 3개가 각각 다른 Pitch(Rate)와 Time Offset으로 겹쳐 재생되는지 논리적 교차 검증 통과.

## Follow-up — 2026-07-24T12:18:53+09:00

<USER_REQUEST>
Conduct a forensic, exhaustive pre-build audit and stress test of the React Native/Expo codebase to guarantee absolute stability (zero crashes) when compiled to an APK. The audit must rigorously analyze all pipelines, signal flows, UI/UX, lag, RAM usage, and code efficiency. 

Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea
Integrity mode: benchmark (Absolute Strictness: No fakes, no guessing)

## Requirements

### R1. Deep Codebase & Pipeline Audit
Analyze the entire codebase architecture and data pipelines (API connections, state management). You must actually read the source code. Guessing or hallucinating file contents is strictly forbidden.

### R2. Programmatic Stress Testing
Evaluate the application for rendering lag, excessive RAM usage, and algorithmic efficiency. You must write and execute actual stress-test scripts (e.g., running core logic 10,000 times) to prove there are no memory leaks or infinite loops.

### R3. UI/UX & Emotional Design Review
Audit the user interface against the 3-Layer Emotional UX rules (Visceral, Behavioral, Reflective) defined in `AGENTS.md`. Ensure smooth transitions and premium aesthetics.

## Acceptance Criteria

### Verification & Honesty
- [ ] Every claim about a bug or optimization must cite the exact file path and line number from the actual codebase.
- [ ] The team must execute at least one programmatic stress test (e.g., a Node.js script testing `haversine.ts` or API fetching) and report the actual console output/execution time.
- [ ] No dummy data or "mocked" results allowed in the final report. If a test fails, report the raw failure log.
</USER_REQUEST>
