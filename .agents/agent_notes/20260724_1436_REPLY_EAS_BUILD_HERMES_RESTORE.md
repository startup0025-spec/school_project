---
RECORD_ID: "20260724_1436_REPLY_EAS_BUILD_HERMES_RESTORE"
RECORD_TYPE: "[LOG]"
TARGET: "Inform the user that JSC native compilation failed on EAS, so Hermes was restored with fixed Babel dependencies"
---
[1_WHAT] (State & Context):
> (LOG: EAS 서버에서 JSC 엔진 빌드가 Gradle 네이티브 컴파일 단계에서 알 수 없는 이유로 실패함. JSC 의존성이 구버전이거나 Expo 최신 버전과 네이티브 호환 충돌이 난 것으로 보임.)

[2_HOW] (Action & Context):
> (LOG: 
> 1. 즉시 방향을 전환하여 불안정한 JSC 우회책을 폐기하고, 앱을 본래의 `Hermes` 엔진으로 롤백함.
> 2. 이전 로컬 빌드에서 문제가 되었던 Hermes 컴파일 오류(`#x` 등 최신 문법)와 Babel 의존성 꼬임 현상을 모두 깔끔하게 클렌징하고 `babel-preset-expo`를 정식으로 고정시킴.
> 3. 원격 리눅스 기반의 EAS 빌드 서버에서는 Windows 로컬 `hermesc` 바이트코드 오류가 재현되지 않을 확률이 매우 높으므로 정공법으로 돌파하는 것으로 4차 EAS 빌드를 발사함.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: 무리하게 JS 엔진을 JSC로 교체하면 안드로이드 네이티브(Gradle) 레벨에서 예기치 못한 JNI/C++ 컴파일 에러를 겪게 됨. 결국 정석인 Hermes를 고수하되, 의존성 패키지가 완벽히 매칭된 상태로 EAS 클라우드의 고성능 리눅스 컴파일러에 맡기는 것이 가장 빠르고 안전한 길임.)

[4_NEXT] (Status & Follow-up):
> (LOG: 빌드 완료 즉시 APK를 다운로드하여 `보내는 용도` 폴더에 복사할 예정.)
