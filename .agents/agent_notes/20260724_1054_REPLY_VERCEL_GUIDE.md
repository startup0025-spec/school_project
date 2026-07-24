---
RECORD_ID: "20260724_1054_REPLY_VERCEL_GUIDE"
RECORD_TYPE: "[LOG]"
TARGET: "Provide instructions for Vercel deployment (Web mockup vs Mobile Expo)"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 완성된 코드를 Vercel(버셀)에 연동/배포하는 방법에 대해 질문하심.)

[2_HOW] (Action & Context):
> (LOG: 
> 1. 프로젝트 루트를 확인한 결과, 앱 본체(`mobile/`)와 랜딩페이지용(`web/`) 폴더가 공존하고 있음을 확인함.
> 2. 사장님이 Vercel에 배포하시려는 타겟이 무엇인지에 따라 'Root Directory' 설정이 다름을 가이드함.
>    - **[A] 랜딩 페이지 배포 시 (`web` 폴더)**: 프레임워크 Vite 자동 인식, 설정 변경 거의 없음.
>    - **[B] 앱 본체 웹버전 배포 시 (`mobile` 폴더)**: Build Command를 `npx expo export -p web`으로, Output을 `dist`로, 그리고 `.env` 변수 주입 필수.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 하나의 Git 저장소 안에 두 개의 독립적인 프로젝트(모바일, 웹)가 들어있으므로, Vercel 연동 시 엉뚱한 폴더가 빌드되어 에러가 나는 것을 방지하기 위한 가이드 제공.)

[4_NEXT] (Status & Follow-up):
> (LOG: 배포 성공 여부 및 추가 문의 대기.)
