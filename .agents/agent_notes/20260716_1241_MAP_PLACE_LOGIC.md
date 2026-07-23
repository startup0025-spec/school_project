---
RECORD_ID: "20260716_1241_MAP_PLACE_LOGIC"
RECORD_TYPE: "[LOG]"
TARGET: "Explain how places are currently displayed and cycled on the map"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 지도 화면에 장소가 어떤 기준(랜덤 여부 등)으로 뜨고 바뀌는지 현재 구현 상태를 질문하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. `map.tsx` 코드를 확인한 결과, **랜덤이 아니라 순차적인 배열(Array) 순회 방식**으로 구현되어 있음.
> 2. 내부 데이터베이스(`local_places.ts`)나 목업 데이터(`QUIET_SPOTS`)에 들어있는 장소 목록을 0번 인덱스부터 불러옴.
> 3. 유저가 하단 카드의 `[다른 물길 보기]` 버튼을 누를 때마다 인덱스가 1씩 증가하며(0 -> 1 -> 2 -> 다시 0) 다음 장소로 지도가 슥(panTo) 이동하는 단순한 구조임.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님이 불필요한 알고리즘(추천, 랜덤 등)에 시간을 낭비하지 않고, 앱의 미니멀한 방향성(순차적으로 조용히 하나씩 보여주는 방식)을 유지하시도록 팩트체크를 해드리기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 사장님께 현재 로직(순차 반복)을 설명하고, 이것을 유지할지 아니면 랜덤 등으로 바꿀지 가볍게 여쭤봄.)
