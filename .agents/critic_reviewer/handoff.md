# Handoff Report — Cycle 8 Critique & Verification (Cycle 7 Refined Design Review)

## 1. Observation (관측 사항)

수석 비평가(Principal Critic)는 Lead Architect의 Cycle 7 Refined Design(`C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_architect/cycle4_refined.md`)의 소스 코드 스케치를 분석하여 다음 구체적 사항들을 직접 관측하였습니다:

* **관측 사항 1 (Progress Callback 오용)**:
  `audio_caching_service.ts`의 `resolveAudioSource` 함수 내 331~346라인:
  ```typescript
  const download = FileSystem.createDownloadResumable(
    cdnUrl,
    localUri,
    {},
    async (downloadResult) => {
      if (downloadResult) {
        console.log(`[Audio Cache] Background download finished: ${filename}`);
        const fileSize = downloadResult.headers['Content-Length'] 
          ...
      }
      activeDownloads.delete(filename);
    }
  );
  ```
  `createDownloadResumable`의 4번째 인자는 완료 콜백이 아닌 진행률 콜백(Progress Callback)이며, 타입은 `DownloadProgressCallback`입니다. 여기에 담겨 전달되는 파라미터는 `DownloadProgressData`이므로 `headers` 필드가 없으며, 파일 수신 도중 계속 실행됩니다.

* **관측 사항 2 (Set 구조 락 해제에 의한 경쟁 상태)**:
  `audio_caching_service.ts`의 118라인 `const loadingFiles = new Set<string>();` 및 `audio_engine_service.ts`의 `playAmbientSound` 내 `finally` 블록의 665~666라인:
  ```typescript
  } finally {
    // 5. Always release temporary loading locks
    unlockFileForLoading(soundFile);
    unlockFileForLoading(windFile);
  }
  ```
  복수 요청이 진행 중일 때, 먼저 중단(Abort)된 이전 요청의 `finally` 문이 `unlockFileForLoading`을 실행하여 Set에서 자산명을 삭제함으로써 아직 자산을 해석 중인 후속 요청의 동시성 락을 강제로 해제하는 상태가 발생합니다.

* **관측 사항 3 (Promise.race 패배 프로미스의 미처리 예외 및 리소스 누수)**:
  `audio_engine_service.ts`의 `loadSoundWithFallback` 함수 내 513~519라인:
  ```typescript
  const loadPromise = Audio.Sound.createAsync(source, { shouldPlay: false });
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[Audio Engine] Load timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  const result = await Promise.race([loadPromise, timeoutPromise]);
  ```
  `loadPromise` 자체에 직접 에러 캐치가 부착되지 않아, 경주 종료 후 지연 발생한 네이티브 에러가 `Unhandled Promise Rejection`을 발생시킵니다. 또한 늦게 로드된 `Audio.Sound`가 해제되지 않고 메모리에 누수되는 구조입니다.

* **관측 사항 4 (isCdnReachable 내 타이머 누수)**:
  `audio_caching_service.ts`의 151~160라인:
  ```typescript
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout

  const response = await fetch(testUrl, {
    method: 'HEAD',
    signal: controller.signal,
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  });

  clearTimeout(timeoutId);
  ```
  `fetch`가 네트워크 장애 등으로 예외를 던지면 `clearTimeout(timeoutId)` 호출이 생략되어 타이머가 해제되지 않고 누수됩니다.

---

## 2. Logic Chain (논리 체인)

* **단계 1 (진행 콜백 오류 → 런타임 크래시)**: 관측 사항 1에 따라, 진행 콜백이 호출되는 첫 패킷 수신 시점에 `downloadResult.headers`를 해석하려다 `TypeError`가 발생합니다. 이로 인해 배경음 다운로드가 정상 완료되지 못해 크래시 및 오프라인 폴백 누수를 일으킵니다.
* **단계 2 (락 해제 경쟁 → 캐시 강제 삭제 및 에러)**: 관측 사항 2에 따라, 복수 위치 갱신으로 오버랩된 요청 중 이전 요청의 중단 시 락이 즉각 Set에서 제거됩니다. 뒤따르는 활성 요청이 로드를 진행하는 타이밍에 캐시 정리가 수행되면 로딩 중인 파일이 evict되어 `File Not Found` 예외가 발생합니다.
* **단계 3 (타임아웃 프로미스 방치 → 런타임 경고 및 OOM)**: 관측 사항 3에 따라, 5초 초과 시 로컬 require로 우선 폴백한 뒤, 네트워크가 뒤늦게 거부되면 Unhandled Rejection이 터지며, 뒤늦게 성공하면 덤으로 생성된 네이티브 플레이어 핸들이 백그라운드 메모리에 방치(OOM 유도)됩니다.
* **단계 4 (타이머 누수 및 대기시간 누적 → Watchdog SIGKILL)**: 관측 사항 4에 근거하여, fetch 실패 시 타이머가 잔류하게 됩니다. 또한 백그라운드 태스크에서 prefetch 8초 타임아웃 이후에 `playAmbientSound` 내에서 다시 10초(Ambient 5초, Wind 5초) 동안 CDN 실패를 대기함으로써 최대 18초의 지연이 발생해 OS Watchdog에 의해 백그라운드 태스크 프로세스가 `SIGKILL`로 강제 종료됩니다.

---

## 3. Caveats (주의 사항)

* **테스트 코드 부재**: 모바일 에뮬레이터 환경 및 디바이스 API(`expo-file-system`, `expo-av`) 모킹을 위한 로컬 유닛 테스트 환경이 존재하지 않아, 정적 코드 흐름 분석 및 타이밍 동시성 시나리오 시뮬레이션 위주로 검증이 진행되었습니다.
* **CDN 서버 헤더 설정 의존**: content-length 헤더에 전적으로 의존하므로 CDN 서버가 HEAD 요청에 정확한 컨텐트 크기 헤더를 동봉하도록 웹서버 설정이 일치해야 합니다.

---

## 4. Conclusion (결론)

Lead Architect의 Cycle 7 Refined Design은 모바일 백그라운드 성능 개선과 오프라인 처리에 일보 진전을 보였으나, Expo API 오용으로 인한 치명적 런타임 에러(`createDownloadResumable`), 동시 요청 락 풀 해제 레이스 상태, Promise.race 패배 프로미스의 미처리 예외/누수 등 여전히 불안정하므로 **REQUEST CHANGES (변경 요구)** Verdict를 선언합니다.

수석 비평가는 `cycle4_critique.md` 파일에 상기 기술 분석 내용과 각 결함 해결 코드(참조 카운터 Map 구현, didTimeout 체이닝 프로미스 기법, completion 핸들러 이관 등)를 구체적으로 도출하여 저장하였습니다.

---

## 5. Verification Method (검증 방법)

1. **리포트 정적 상세 분석**: `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/critic_reviewer/cycle4_critique.md`를 열고, 각 섹션별 지적 사항 및 제안 코드를 확인해 주십시오.
2. **코드 무배제 대조**: 프로젝트 디렉토리 원본(`mobile/lib/services/`) 하위의 소스 코드가 설계 가이드를 따를 뿐 실제 변경되지 않았음을 확인해 주십시오.
3. **타이밍 경주 시뮬레이션**: 지오펜싱 진입 순서 및 abort 블록(Req 1 vs Req 2) 흐름도를 대조하여 참조 카운팅 Map 도입 시 동시성 보장성을 대조 검증해 주십시오.
