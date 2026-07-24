---
RECORD_ID: "20260724_1205_REPLY_VERCEL_REASON"
RECORD_TYPE: "[LOG]"
TARGET: "Explain the strategic reason for Vercel deployment in a contest setting"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 "어차피 모바일 앱인데 왜 굳이 Vercel(웹 배포) 연동을 하려는 거냐? 단순 테스트용이냐?"고 핵심 목적을 질문하심.)

[2_HOW] (Action & Context):
> (LOG: 
> 단순 테스트용이 아니라 **'대회 심사위원 설득용 최종 무기'**임을 명확히 강조함.
> 1. **무설치 접근성(Zero-Install)**: 심사위원들은 출처를 모르는 학생들의 APK 파일이나 무거운 Expo Go 앱을 절대 깔고 싶어하지 않음. Vercel로 웹 링크 하나만 띡 주면 심사위원이 자기 폰(Safari/Chrome)에서 앱과 100% 똑같은 화면을 즉시 눌러볼 수 있음.
> 2. **실시간 긴급 수정(Hotfix)**: 대회 당일 발표 5분 전에 버그를 발견해도, 코드 고치고 깃허브에 올리기만 하면 Vercel이 알아서 새로고침 됨. 심사위원은 무조건 완벽한 버전만 보게 됨.
> 3. **전문성(Professionalism)**: QR 코드나 예쁜 URL 하나 띄워놓고 "접속해서 직접 들어보시죠" 하는 퍼포먼스가 대회에서 엄청난 가산점을 받음을 어필함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님이 Vercel 배포의 진정한 가치(접근성과 대회 퍼포먼스)를 이해하고 배포의 당위성을 납득하시도록 돕기 위함.)

[4_NEXT] (Status & Follow-up):
> (LOG: 사장님이 납득하시면 Vercel 연동(웹 빌드) 작업 즉각 실시 예정.)
