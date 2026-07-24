---
RECORD_ID: "20260716_1236_UGC_PLAN_REFINEMENT"
RECORD_TYPE: "[LOG]"
TARGET: "Refine UGC plan to link Map and Diary, and clarify text filtering"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 1) 지도 장소 리뷰와 다이어리 일기장을 완전히 연동시킬 것과, 2) 장소 설명에서 상업적인 텍스트나 건물 이름을 억지로 지울 필요가 없다고 지시하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. **통합 일기장(연동)**: 지도(`map.tsx`)에서 장소 리뷰를 적든, 기록 탭(`diary.tsx`)에서 적든 둘 다 똑같은 `diaryEntries` 배열에 쌓이도록 데이터 흐름을 하나로 통합함. (지도에서 적은 글이 다이어리 타임라인에 바로 보임)
> 2. **필터링 폐기(원본 유지)**: AI가 하려던 '상업적 단어 삭제'나 '건물 이름 삭제' 등 빡센 필터링 로직은 아예 도입하지 않음. TourAPI가 주는 상업적 문구가 포함된 원본 텍스트 그대로를 '자세히 보기' 토글 안에 날것으로 제공하기로 확정.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 유저의 기록 경험이 파편화되지 않도록(Map = Diary) 맥락을 일치시키고, 불필요한 텍스트 필터링 공수를 없애 개발 속도를 끌어올리기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 수정된 내용을 야매 플랜에 즉시 덮어쓰고, 사장님께 최종 승인을 요청함.)
