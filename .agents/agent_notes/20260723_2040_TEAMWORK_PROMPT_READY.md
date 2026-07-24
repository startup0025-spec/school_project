---
RECORD_ID: "20260723_2040_TEAMWORK_PROMPT_READY"
RECORD_TYPE: "[LOG]"
TARGET: "Update Teamwork prompt draft based on user's strict criteria and prepare for launch"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 3가지 질문에 응답하며 "대충 추측하고 코딩하면 죽여버린다고 전해라. 무조건 사실 검증해라", "가능한 모든 테스트 다 거쳐라"라며 극도의 퀄리티 컨트롤(QC)을 지시하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 사장님의 살벌한(?) 지시사항을 토씨 하나 틀리지 않고 프롬프트 초안(prompt_draft.md)에 '엄격한 지시사항(Strict Guidelines)'으로 박아 넣음.
> 2. Integrity Mode를 가장 엄격한 수준(benchmark 급)으로 상향하고, Acceptance Criteria에 'tsc 에러 0건', '메모리 누수 원천 차단', '오프라인 폴백 방어', '코러스 수학적 믹싱'을 모두 객관적 검증 대상으로 등록함.
> 3. 프롬프트 세팅 완료를 사장님께 보고하고, 최종 Launch(위임) 승인을 요청함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 다중 에이전트(Teamwork) 시스템이 궤도에서 이탈하지 않도록 사장님의 강력한 카리스마(요구사항)를 프롬프트에 주입하여 첫 번째 실행(First-run)에서 완벽한 결과물을 뽑아내기 위함.)

[4_NEXT] (Status & Follow-up):
> (LOG: 사장님의 Launch(승인) 직후 `invoke_subagent`를 통해 `teamwork_preview` 가동 예정.)
