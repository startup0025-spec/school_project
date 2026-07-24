---
RECORD_ID: "20260724_1145_REPLY_API_KEY_FORMAT"
RECORD_TYPE: "[LOG]"
TARGET: "Address the user's question about the data.go.kr API key format"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 `0ccf1bb01212098d2fb3580fc9ad1cb5f6962d33efe1fdcc9591e4bbc5a28a3f` (64자리 Hex) 형태의 키를 가져와서 공공데이터포털 API 키 형식이 맞는지 질문하심.)

[2_HOW] (Action & Context):
> (LOG: 
> 1. 해당 문자열이 정확히 64자리의 소문자 헥사(Hex) 형태(SHA-256 해시값과 동일한 형태)임을 분석함.
> 2. 공공데이터포털(data.go.kr)의 서비스 키는 일반적으로 Base64 기반의 인코딩/디코딩 형태(약 80자 이상, `%`, `+`, `=` 등 포함)이므로 형식이 맞지 않음을 명확히 지적함.
> 3. 포털 마이페이지에서 '일반 인증키(Encoding)' 또는 '일반 인증키(Decoding)'라고 적힌 진짜 키를 찾아야 한다고 안내함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 잘못된 형식의 키를 `.env`에 넣었다가 연동 에러가 나면 디버깅 시간이 낭비되므로, 사전에 형식을 검증하여 올바른 키 발급을 유도하기 위함.)

[4_NEXT] (Status & Follow-up):
> (LOG: 올바른 API 키 수령 후 `.env` 등록 및 Vercel 배포 진행 대기.)
