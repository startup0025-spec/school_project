---
RECORD_ID: "20260716_1247_EXTERNAL_MAP_ROUTING"
RECORD_TYPE: "[LOG]"
TARGET: "Add external map routing (Deep Link) to the plan"
---
[1_WHAT] (State & Context):
> (LOG: 사장님께서 우리 앱 내부에서 복잡하게 길찾기를 구현할 필요 없이, 유저가 원하면 외부 지도 앱(카카오맵/구글맵)으로 튕겨서 넘겨버리라고 지시하심.)

[2_HOW] (Action & Details):
> (LOG: 
> 1. 플랜 문서(`map.tsx` 수정 파트)에 **외부 지도 앱 길찾기 연동 (Deep Link)** 항목을 추가함.
> 2. 장소 카드에 `[길찾기]` 버튼을 만들고, 누르면 `Linking.openURL` 등을 이용해 카카오맵 앱이나 기기 기본 지도 앱으로 목적지 위경도 좌표를 쏴서 외부 앱이 열리게 만듦.
> 3. 유저는 외부 앱으로 길을 찾아간 뒤, 나중에 우리 앱으로 다시 돌아와서 '리뷰(일기)'만 남기는 완벽한 분업 구조가 완성됨.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 지도 대기업(카카오, 구글)이 이미 수천억을 들여 만든 길찾기 시스템을 공짜로 빌려 쓰고, 우리 앱은 핵심 가치(감성 일기장)에만 온전히 집중하여 개발 효율을 극대화하기 위함임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 플랜 문서 부분 수정 완료 후, 사장님께 최종 승인을 다시 요청함.)
