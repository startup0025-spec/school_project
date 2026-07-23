# Cycle 8 Technical Critique: 정제된 캐싱 매니저 & 백그라운드 태스크 설계 검증

**문서 버전**: 5.0.0  
**단계**: Technical Critique & Verification (Cycle 8 Critique)  
**대상 모듈**: `audio_caching_service.ts`, `audio_engine_service.ts`, `geofencing_service.ts`  
**작성자**: 수석 비평가 BERRY 🍎 (Principal Critic / critic_reviewer)  

---

## 1. 개요 (Executive Summary)

본 문서는 Anyway the Sea 프로젝트의 Lead Architect가 작성한 **Cycle 7 Refined Design**(`cycle4_refined.md`)에 대한 기술 검증 및 비평 리포트입니다.

Cycle 7 정제 설계는 지난 Cycle 6 비평에서 제기된 (1) 오프라인 CDN 로딩 행(Hang) 문제, (2) LRU 캐시 회수 시의 경쟁 상태(Race Condition), (3) 백그라운드 작업 수행 시 Watchdog SIGKILL 크래시 문제를 해결하기 위해 `loadSoundWithFallback` 헬퍼, `loadingFiles` 락 풀, 8초 백그라운드 타임아웃 및 자산 삭제 메커니즘을 도입했습니다.

그러나 비평가진의 심층적인 정적 분석 및 동시성 시뮬레이션 결과, **실제 서비스 환경에서 치명적인 런타임 크래시, 메모리/리소스 누수, 그리고 심각한 UX 성능 저하를 유발하는 결함**이 여전히 다수 발견되었습니다.

**핵심 결함 요약**:
1. **`loadSoundWithFallback`의 미처리 프로미스 거부 및 메모리 누수**: 타임아웃 경쟁(Promise.race)에서 패배한 네트워크 로딩 프로미스(`loadPromise`)의 후속 예외 처리가 누락되어 `Unhandled Promise Rejection` 크래시를 유발하며, 늦게 로드된 오디오 인스턴스가 네이티브 메모리에 누수됩니다.
2. **`loadingFiles` 락 풀의 동시성 릴리즈 레이스**: 단순 `Set` 구조로 인해, 이전 요청이 중단(Abort)되어 `finally` 블록에서 언락을 호출할 때 동일한 자산을 로딩 중인 후속 요청의 락까지 함께 지워져 캐시가 강제 삭제되는 레이스 컨디션이 존재합니다.
3. **백그라운드 캐시 다운로드 취소 시 부분 파일(Partial File) 누수 및 프로미스 미처리**: `prefetchAudioAssets`가 타임아웃된 후 완료되는 취소 처리가 프로미스 미처리 거부를 유발하며, 스트리밍 캐시 다운로드(`resolveAudioSource`) 도중 취소 시 부분 다운로드 파일이 디스크에 방치되어 스토리지 누수가 발생합니다.
4. **`isCdnReachable` 내의 타이머 누수 및 중복 타임아웃 대기**: 네트워크 체크 실패 시 타이머가 정리되지 않고 누수되며, 사전 인출(Prefetch)이 이미 실패했음에도 재생 세션에서 다시 5초 타임아웃을 개별적으로 중복 대기(총 18초 지연)하여 OS 강제 종료 위험을 높입니다.
5. **[CRITICAL RUNTIME BUG] `createDownloadResumable` 콜백 오용 크래시**: `resolveAudioSource` 내부에서 다운로드 완료 핸들러를 4번째 인자(진행률 콜백, Progress Callback)로 전달하여, 다운로드 도중 `TypeError` 크래시를 발생시키고 정상 다운로드를 완수하지 못하는 결정적인 구현 오류가 존재합니다.
6. **지오펜스 진입 지연 UX 결함**: 지오펜스 진입 시 8초의 Prefetch를 동기적으로 대기한 후 재생함으로써 사용자에게 최대 8초의 무음 지연을 강제합니다.

---

## 2. 상세 검증 및 비평 (Detailed Technical Critique)

### 2.1 `loadSoundWithFallback` 검증 (동시성 및 타이머)

#### [결함 1] Late Rejection에 의한 Unhandled Promise Rejection 크래시
`Promise.race([loadPromise, timeoutPromise])` 호출 시, `timeoutPromise`가 먼저 거부(Reject)되어 5초 만에 제어권이 `catch` 블록으로 넘어가 로컬 폴백 오디오를 재생하게 됩니다.
그러나 백그라운드에서 여전히 실행 중인 `loadPromise`(`Audio.Sound.createAsync`)는 독자적인 `.catch()` 체인이 부착되어 있지 않습니다. 따라서 15~30초 후 네이티브 네트워크 타임아웃이 발생하여 `loadPromise`가 거부될 때, React Native 런타임에 **Unhandled Promise Rejection** 예외가 던져져 앱이 크래시되거나 디버깅 경고가 발생합니다.

#### [결함 2] 늦은 로드 완료에 의한 네이티브 오디오 인스턴스 누수 (Resource Leak)
만약 네트워크가 매우 느려 5초 타임아웃 이후에 `loadPromise`가 성공(Resolve)하게 되면, 플랫폼 네이티브 수준에서 새로운 오디오 재생 인스턴스가 인스턴스화됩니다. 그러나 이 오디오 개체의 참조는 이미 상실되어 제어할 수 없으므로, 해당 사운드가 백그라운드에서 임의로 재생되거나 언로드되지 않고 네이티브 메모리에 계속 상주하여 오디오 리소스 고갈 및 OOM(Out of Memory)을 유발합니다.

#### [권장 개선안] `didTimeout` 플래그 및 체이닝 도입
이 문제를 완전히 해결하려면 `loadPromise` 변수 자체에 동적으로 타임아웃 상태를 전파하고, 늦은 완료 시 자원을 해제하도록 다음과 같이 보완해야 합니다:

```typescript
async function loadSoundWithFallback(
  source: any,
  fallbackAsset: any,
  timeoutMs: number = 5000
): Promise<{ sound: Audio.Sound }> {
  let timer: NodeJS.Timeout | null = null;
  let didTimeout = false;
  
  try {
    if (source && source.uri && source.uri.startsWith('http')) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          didTimeout = true;
          reject(new Error(`[Audio Engine] Load timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      
      const loadPromise = Audio.Sound.createAsync(source, { shouldPlay: false })
        .then((result) => {
          if (didTimeout) {
            console.warn('[Audio Engine] Sound loaded late after timeout, unloading immediately.');
            result.sound.unloadAsync().catch(() => {});
          }
          return result;
        })
        .catch((err) => {
          if (!didTimeout) throw err; // 타임아웃 전 발생한 에러만 전파
          // 타임아웃 이후의 늦은 예외는 여기서 흡수하여 Unhandled Rejection 방지
          console.log('[Audio Engine] Suppressed late rejection error:', err.message);
        });

      const result = await Promise.race([loadPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      return result;
    }
    return await Audio.Sound.createAsync(source, { shouldPlay: false });
  } catch (error) {
    if (timer) clearTimeout(timer);
    console.warn(`[Audio Fallback] CDN/Cache load failed, falling back to local asset:`, error);
    return await Audio.Sound.createAsync(fallbackAsset, { shouldPlay: false });
  }
}
```

---

### 2.2 `loadingFiles` 락 풀 및 캐시 경쟁 상태 검증

#### [결함 3] 단순 `Set` 기반 락 해제 시 동시성 레이스 컨디션
`loadingFiles`를 단순 `Set<string>`으로 유지할 경우, 아래와 같은 시나리오에서 동시성 락이 오동작합니다:
1. **요청 1 (Req 1)**이 시작되고 `lockFileForLoading('ambient_sea.mp3')`를 호출하여 Set에 `'ambient_sea.mp3'`가 추가됩니다.
2. Req 1이 `resolveAudioSource` 비동기 대기 상태에 들어갑니다.
3. 동일한 시점에 사용자의 위치가 변경되어 **요청 2 (Req 2)**가 시작됩니다.
4. Req 2가 `lockFileForLoading('ambient_sea.mp3')`를 호출합니다. Set 구조이므로 중복으로 추가되지 않고 상태는 변함없습니다.
5. Req 2가 구동되면서 `activePlaybackRequestId`가 업데이트되어 Req 1은 중단(Abort) 판정을 받고 `finally` 블록으로 진입합니다.
6. Req 1의 `finally`가 `unlockFileForLoading('ambient_sea.mp3')`를 호출합니다.
7. 이 과정에서 `loadingFiles.delete('ambient_sea.mp3')`가 실행되어 Set에서 파일명이 제거됩니다.
8. **문제 발생**: Req 2는 아직 `'ambient_sea.mp3'`를 해석하고 로드하는 중인데도 불구하고, Set에서 자산명이 지워져 락이 해제되었습니다. 이 타이밍에 캐시 회수 함수 `enforceCacheLimits`가 실행되면 해당 자산이 Eviction 대상으로 분류되어 디스크에서 강제 삭제되고, Req 2는 결국 `File Not Found` 크래시를 일으키게 됩니다.

#### [권장 개선안] 참조 카운팅(Reference Counting) 락 매니저 구현
락 풀 내부를 `Map<string, number>` 기반의 참조 카운팅 방식으로 재설계하여, 활성화된 모든 로딩 태스크가 완료되거나 중단되기 전에는 락이 풀리지 않도록 보장해야 합니다.

```typescript
// mobile/lib/services/audio_caching_service.ts 내 수정 제안
const loadingFiles = new Map<string, number>();

export function lockFileForLoading(filename: string): void {
  const count = loadingFiles.get(filename) || 0;
  loadingFiles.set(filename, count + 1);
  console.log(`[Cache Manager] Lock acquired: ${filename} (ref count: ${count + 1})`);
}

export function unlockFileForLoading(filename: string): void {
  const count = loadingFiles.get(filename) || 0;
  if (count <= 1) {
    loadingFiles.delete(filename);
    console.log(`[Cache Manager] Lock fully released: ${filename}`);
  } else {
    loadingFiles.set(filename, count - 1);
    console.log(`[Cache Manager] Lock decremented: ${filename} (ref count: ${count - 1})`);
  }
}

// enforceCacheLimits 내 변경 사항 (기존 .has 검사는 Map에서도 정상 동작)
if (pinnedFiles.has(file) || loadingFiles.has(file)) { ... }
```

---

### 2.3 8초 백그라운드 타임아웃 및 다운로드 취소 검증

#### [결함 4] 스트리밍 캐시 다운로드 중단 시의 디스크 부분 파일(Partial File) 누수
`prefetchAudioAssets` 내부에서는 다운로드 실패/취소 시 파일 삭제 로직이 `try-catch`로 명확하게 갖춰져 있습니다.
그러나 `resolveAudioSource`에서 백그라운드 캐시를 쓰기 위해 구동되는 비동기 `DownloadResumable`은 취소되거나 에러가 났을 때 부분 임시 파일을 정리해 주는 코드가 catch 블록에 결여되어 있습니다.
```typescript
// resolveAudioSource 내부
download.downloadAsync().catch((err) => {
  if (!err.message?.includes('cancelled')) {
    console.warn(`[Audio Cache] Background cache write failed: ${filename}`, err);
  }
  // [누수 발생] cancelActiveDownloads() 호출에 의해 중단되어도 localUri에 잔류한 부분 파일이 삭제되지 않음!
});
```
이로 인해 취소된 다운로드 파일들이 디스크 스페이스를 지속적으로 점유하는 누수가 누적됩니다.

#### [결함 5] `prefetchPromise` 타임아웃 이후의 Unhandled Rejection
`prefetchAudioAssets` 내에서 `Promise.race([prefetchPromise, timeoutPromise])`를 실행한 후 `timeoutPromise`가 먼저 거부되면 전체 작업이 reject로 종료됩니다.
이후 `cancelActiveDownloads()`가 실행되어 진행 중이던 `download.downloadAsync()`가 취소 예외를 던지면, `prefetchPromise`가 거부 상태가 됩니다. 그러나 이미 경주(Race)가 끝났기 때문에 이 거부 처리를 받아낼 상위 수신자가 존재하지 않아 또 다른 `Unhandled Promise Rejection`이 발생할 위험이 있습니다.

#### [권장 개선안] 부분 파일 삭제 로직 삽입 및 프라미스 예외 소멸 처리
1. `resolveAudioSource` 내부 다운로드 catch 블록에 `FileSystem.deleteAsync`를 추가합니다.
2. `prefetchPromise`에 더미 `.catch(() => {})`를 추가하거나, 경주 직후 에러 수신기를 부착합니다.

```typescript
// 1. resolveAudioSource 수정안
download.downloadAsync().catch(async (err) => {
  try {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  } catch {}
  if (!err.message?.includes('cancelled')) {
    console.warn(`[Audio Cache] Background cache write failed: ${filename}`, err);
  }
});

// 2. prefetchAudioAssets 내 경주 부분 수정안
try {
  // 더미 캐치를 부착하여 경주 종료 후의 늦은 Rejection 방지
  prefetchPromise.catch(() => {});
  await Promise.race([prefetchPromise, timeoutPromise]);
} finally {
  if (timeoutId) clearTimeout(timeoutId);
}
```

---

### 2.4 오프라인 액세스 및 폴백 동작 검증

#### [결함 6] `isCdnReachable` 함수 내의 타이머 누수
`isCdnReachable` 함수 내에서 fetch 요청이 성공하면 `clearTimeout(timeoutId)`가 정상적으로 작동합니다. 그러나 fetch 요청 자체가 타임아웃 이전에 네트워크 단절 등으로 인해 에러를 던지고 catch 블록으로 빠지게 될 경우, `clearTimeout(timeoutId)` 호출을 건너뛰게 됩니다. 이로 인해 메모리에 1.5초 타이머 핸들이 남아 메모리 단편화 및 타이머 누수가 생깁니다.
* **해결 제안**: 타이머 클리어를 `finally` 블록으로 격리해야 합니다.
```typescript
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    ...
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(...);
    cachedReachabilityResult = response.ok;
  } catch {
    cachedReachabilityResult = false;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
```

#### [결함 7] 백그라운드 지오펜싱 진입 지연 및 이중 타임아웃 리스크
지오펜스에 진입하여 `INSIDE` 상태가 될 때 `prefetchAudioAssets`의 타임아웃 한도는 **8초**입니다. 만약 최악의 3G 음영망 상태에서 이 사전 인출이 8초 만에 타임아웃으로 실패하면, 제어권은 `playAmbientSound`로 넘어갑니다.
`playAmbientSound` 내부에서는 `resolveAudioSource`를 거쳐 다시 `loadSoundWithFallback`을 각각 **5초**씩 호출합니다(Ambient MP3에 5초, Wind MP3에 5초).
따라서 백그라운드 태스크는 **최대 18초**(8초 prefetch + 5초 ambient + 5초 wind) 동안 CPU와 네트워크를 점유하게 되며, 이는 플랫폼 백그라운드 실행 한계를 초과하여 Watchdog `SIGKILL`을 맞이할 확률을 급격히 높입니다.
* **해결 제안**: 만약 사전 인출 단계에서 네트워크 지연 에러가 감지되었다면 네트워크 연결 상태 캐시(`cachedReachabilityResult`)를 즉시 `false`로 격제하여, 이후의 재생 오디오 로드 시도에서 지연 없이 즉시 로컬 번들 require를 채택하도록 최적화해야 합니다.

---

### 2.5 코드 올바름 및 컴파일 정적 분석 (Code Correctness)

#### [결함 8] [CRITICAL RUNTIME BUG] `createDownloadResumable` 콜백 오용
`resolveAudioSource` 설계 내에 매우 치명적인 런타임 오류가 존재합니다.
```typescript
// 결함 코드
const download = FileSystem.createDownloadResumable(
  cdnUrl,
  localUri,
  {},
  async (downloadResult) => {
    if (downloadResult) {
      // ... metadata touch & enforceCacheLimits ...
    }
    activeDownloads.delete(filename);
  }
);
```
* **동작 분석**: Expo FileSystem API 명세서상 `createDownloadResumable`의 4번째 인자는 **다운로드 진행률 콜백(Progress Callback)**으로, 타입은 `(data: DownloadProgressData) => void` 입니다. 전달되는 파라미터는 `totalBytesWritten`과 `totalBytesExpectedToWrite`를 담은 객체이며, `DownloadResult`와 같이 `headers` 필드가 절대 존재하지 않습니다.
* **영향도**: 다운로드가 실행되고 첫 번째 진행 상황 이벤트가 발생하자마자 콜백 함수가 실행됩니다. 이 함수 안의 `downloadResult.headers`를 호출하는 부분에서 `TypeError: Cannot read properties of undefined (reading 'headers')` 예외가 무조건 발생하여 다운로드 태스크가 즉각 강제 비정상 종료됩니다. 캐시 기록(`touchFile`) 및 LRU 정리(`enforceCacheLimits`)는 단 한 번도 수행되지 못합니다.
* **해결 제안**: 캐시 갱신 및 제한 적용 코드는 진행률 콜백이 아닌 `download.downloadAsync()`의 Promise 결과 체인 내에서 처리해야 합니다.

```typescript
const download = FileSystem.createDownloadResumable(cdnUrl, localUri, {});
activeDownloads.set(filename, download);

download.downloadAsync()
  .then(async (downloadResult) => {
    if (downloadResult) {
      console.log(`[Audio Cache] Background download finished: ${filename}`);
      const contentLengthHeader = downloadResult.headers['content-length'] || downloadResult.headers['Content-Length'];
      const fileSize = contentLengthHeader ? parseInt(contentLengthHeader) : 5 * 1024 * 1024;
      await touchFile(filename, fileSize);
      await enforceCacheLimits();
    }
  })
  .catch((err) => {
    // 임시 부분 자산 삭제 처리
    FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    if (!err.message?.includes('cancelled')) {
      console.warn(`[Audio Cache] Background cache write failed: ${filename}`, err);
    }
  })
  .finally(() => {
    activeDownloads.delete(filename);
  });
```

#### [결함 9] 단일 장애점(Single Point of Failure)에 의한 복구 실패 리스크
1. **`enforceCacheLimits`**: 루프 내부에서 `activeSoundUnloader`나 `FileSystem.deleteAsync` 중 단 하나라도 파일 시스템 락이나 권한 거부 예외를 발생시키면, 루프 전체가 즉시 파괴되어 나머지 만료 캐시 삭제가 중단됩니다.
2. **`stopAmbientSound`**: 오디오 모듈을 3개 순차 해제할 때 `ambientSound.stopAsync()` 등 첫 번째 처리 도중 에러가 나면 뒤에 위치한 `windSound`, `sirenSound`가 해제되지 못하고 메모리에 고착화됩니다.
* **해결 제안**: 각 사운드 정지 및 파일 삭제 개별 라인에 `try-catch` 예외 처리를 격리하여 한 자산의 정리 실패가 전체 자산의 누수로 번지는 현상을 차단해야 합니다.

---

### 2.6 UX 설계 비평 (지오펜스 진입과 미디어 준비 시간차)

#### [결함 10] 지오펜스 진입 시 재생 지연 UX 회귀 (8초 침묵 상태 유발)
수정 제안된 `geofencing_service.ts`에서는 지오펜스 구역에 진입할 때 동기적으로 `await prefetchAudioAssets(...)`를 수행한 후에 비로소 `playAmbientSound(...)`를 기동시킵니다.
* **사용자 반응 분석**: 사용자가 지오펜스 영역(Spot) 안으로 막 걸어 들어갔을 때, 앱은 8초 동안 네트워크를 활용한 사전 다운로드를 기다립니다. 다운로드가 완료될 때까지 사용자는 어떠한 물소리도 듣지 못하고 **최대 8초간의 강제 침묵(Latency State)**을 경험하게 됩니다. 이는 사용자가 구역 진입 순간에 즉각적인 사운드 피드백을 기대하는 Level 1(Visceral UI - Visual/Audio Vitality) 및 Level 2(Behavioral UX) 기준을 심각하게 훼손하는 설계입니다.
* **해결 패러다임 제안**:
  진정한 의미의 **사전 인출(Prefetching)**은 진입 시점이 아닌, 사용자가 지오펜스 경계 외부 영역인 `NEAR` 또는 `APPROACH` 빈(Bin)에 도달했을 때(예: 목표 Spot과의 거리가 1000m 이내로 단축되었을 때) 비동기적으로 미리 실행해야 합니다.
  사용자가 실제로 `INSIDE` 빈에 도달했을 때에는 이미 캐시에 오디오 자산이 100% 저장되어 있으므로, 네트워크 랙 없이 50ms 미만의 즉각적(Visceral UX)이고 매끄러운 사운드 재생을 즐길 수 있게 됩니다.

---

## 3. 최종 검증 스펙 종합 가이드

수석 비평가진은 Lead Architect의 설계 상 문제점들을 일괄 개선하여 안전성과 정밀성을 향상시킬 수 있는 리팩토링 검증 패치를 구성할 것을 강하게 권고합니다.

| 검증 영역 | 설계 결함 | 발견 리스크 | 최종 권장 해결책 |
| :--- | :--- | :--- | :--- |
| **`loadSoundWithFallback`** | Late Rejection 처리 누락 및 오디오 인스턴스 해제 유실 | Unhandled Rejection 크래시 및 네이티브 사운드 메모리 영구 누수 | `didTimeout` 불리언 감지 플래그 기조의 프로미스 체이닝 적용 및 늦은 완성 인스턴스 자동 해제 |
| **`loadingFiles` Lock Pool** | Set 구조 기반의 단일 엔트리 릴리즈 오동작 | 타 중단 요청이 실행한 락 해제가 현재 작업 중인 락까지 해제하여 파일 삭제 크래시 유발 | `Map<string, number>` 기반의 **참조 카운팅 락(Reference Counter)** 도입 |
| **8-Second Timeout & Cleanup** | 스트리밍 캐시 취소 시 Cleanup 부재, prefetchPromise late reject | 디스크 부분 파일 무한 잔류, 타임아웃 후 취소 예외에 따른 크래시 | `resolveAudioSource` 내 catch에 deleteAsync 추가, prefetchPromise에 더미 catch 연결 |
| **Offline Access** | `isCdnReachable` 타이머 누수 및 이중 타임아웃 대기 | 1.5s 타이머 고착 메모리 누수, 백그라운드 지연 누적으로 Watchdog SIGKILL 유발 | 타이머 제거 finally 격리, 사전 인출 실패 시 오프라인 모드 고정 플래그 갱신 |
| **Code Correctness** | `createDownloadResumable` 콜백 인자 오용, 루프 내 단일 장애점 취약성 | 진행 콜백의 TypeError로 다운로드 즉각 크래시, 일부 복구 실패가 캐시 누수로 연쇄 작용 | completion 로직을 `.then` 체인으로 전면 이관, 예외 던지기 루프 마다 try-catch 안전 조치 |
| **UX & Architecture** | INSIDE 진입 후 동기 다운로드 대기 | 진입 후 최대 8초간 침묵 지속으로 반응성 UX 악화 | prefetch 작업을 `NEAR`/`APPROACH` 전이 시점으로 이동 설계 |

---

## 4. 결론 및 Verdict

Lead Architect의 Cycle 7 Refined Design은 지난 주기보다 예외 케이스 식별 수준은 향상되었으나, 네이티브 Expo API에 대한 부정확한 이해(`createDownloadResumable` 콜백) 및 정밀하지 못한 비동기 경주(Promise.race) 설계로 인해 런타임 크래시 위험도가 매우 높습니다.

따라서 본 수석 비평가는 본 설계에 대해 **REQUEST CHANGES (변경 요구 및 재수정)** Verdict를 선언합니다. 상기 리포트에 지적된 10가지 세부 결함과 개선 지침을 반영하여 설계를 추가 수정할 것을 요청합니다.
