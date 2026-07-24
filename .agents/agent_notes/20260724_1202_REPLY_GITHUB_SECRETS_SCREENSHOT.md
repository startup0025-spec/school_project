---
RECORD_ID: "20260724_1202_REPLY_GITHUB_SECRETS_SCREENSHOT"
RECORD_TYPE: "[LOG]"
TARGET: "Guide user visually based on their Github Secrets screenshot"
---
[1_WHAT] (State & Context):
> (LOG: 사장님이 깃허브 `Settings > Secrets and variables > Actions` 페이지 스크린샷을 찍어 보내시며 여기서 정확히 무엇을 해야 하는지 질문하심.)

[2_HOW] (Action & Context):
> (LOG: 
> 1. 스크린샷 하단에 위치한 초록색 버튼 **"New repository secret"**을 클릭하도록 명확히 짚어드림.
> 2. 클릭 후 나오는 입력창에서 Name에는 `TOUR_API_KEY`를, Secret에는 `발급받으신 64자리 Hex 키`를 복붙하고 저장하면 된다고 직관적으로 재설명함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 사장님이 깃허브 UI에 익숙하지 않으시므로 헷갈리지 않게 시각적 단서(초록색 버튼 위치)를 집어드려 세팅을 빠르게 완수하기 위함.)

[4_NEXT] (Status & Follow-up):
> (LOG: 세팅 완료 후 Vercel 배포 진행 대기.)
