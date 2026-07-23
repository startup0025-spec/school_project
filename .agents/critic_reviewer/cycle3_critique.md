# Cycle 6 Technical Critique: 오프라인 에러 회복력, 캐시 경쟁 상태 및 백그라운드 지오펜싱 라이프사이클 검증

**문서 버전**: 4.0.0  
**단계**: Technical Critique & Verification (Cycle 6 Critique)  
**대상 모듈**: Audio Caching & Playback Fallback, LRU Eviction Locks, Headless Background Lifecycles  
**작성자**: 수석 비평가 BERRY 🍎 (Principal Critic / critic_reviewer)  

---

## 1. 개요 (Executive Summary)

본 문서는 Anyway the Sea 프로젝트의 Lead Architect가 작성한 **Cycle 3 Refined Design**(`cycle3_refined.md`)에 대한 기술 검증 및 비평 리포트입니다.

Cycle 3 정제 설계는 React hook 컴파일 오류 수정, LRU 캐시 핀 고정(`pinnedFiles`), `expo-av` 강제 언로드 콜백(`registerActiveSoundController`), 백그라운드 캐시 사전 인출 제한(1~2개 자산) 등을 도입하여 Cycle 2의 여러 병목과 메모리 누수 위험을 완화하려 시도했습니다. 그러나 심층적인 동시성 모델링 및 모바일 OS의 네이티브 네트워크 예외 상황을 고려할 때, 여전히 **치명적인 오동작 및 크래시 유발 요인**이 남아있음을 확인했습니다.

본 비평의 핵심 지적 및 해결 제안은 다음과 같습니다:
1. **오프라인 CDN Access 실패 시 `expo-av` 행(Hang) 및 무음 처리 결함**: 캐시되지 않은 네트워크 URI를 로드하는 도중 CDN 연결 해제, DNS 오류, 소켓 연결 두절 등이 발생하면 `Audio.Sound.createAsync()` 호출이 네이티브 수준에서 무한히 대기하거나 예외를 발생시킵니다. 이에 대응하는 2차 로컬 폴백 메커니즘이 없어 사용자에게 극심한 버퍼링 랙이나 완벽한 무음 상태(UX 결함)를 유발합니다. 이를 해결하기 위해 `BUNDLED_SOUNDS`를 활용한 **try-catch 기반 로컬 자산 강제 폴백(require fallback) 아키텍처**를 설계합니다.
2. **LRU Eviction Pinning & Deadlock 경쟁 상태**: 캐시 비우기 루프(`enforceCacheLimits`)와 재생 서비스의 오디오 준비(`Audio.Sound.createAsync`) 간의 비동기 타이밍 경쟁(Race Condition)이 존재합니다. 캐시 확인과 로드 완료 사이에 파일이 `pinnedFiles`나 `activeSoundChecker`에 등록되지 않은 채 삭제될 수 있습니다. 이를 방지하는 **`loadingFiles` 락 메커니즘** 및 **스레드 안전 자원 락(Resource Lock)**을 제안합니다.
3. **헤드리스 백그라운드 캐싱 시간 임계치 검증**: 1-2개로 제한된 사전 인출 전략은 일반적인 통신 환경에서는 10-30초의 OS 시간제한을 만족하지만, 지오펜스가 활성화되는 하천/바다 등 **음영 지역 및 3G 환경에서는 여전히 OS의 백그라운드 Watchdog에 의해 `SIGKILL` 크래시**를 유발할 수 있습니다. 각 단계별 실행 타임라인(Timeline Trace)을 도출하고, 이를 방지하기 위한 **엄격한 시간 초과(Timeout) 중단 규칙** 및 다운로드 취소 설계를 정의합니다.

---

## 2. 오프라인 CDN Access 실패 시 `expo-av` 동작 검증

### 2.1 CDN 장애 시 `expo-av` 네이티브 동작 분석
`Audio.Sound.createAsync({ uri: networkUri })`가 실행될 때, 캐시되지 않은 네트워크 소스를 열 경우 `expo-av`는 플랫폼에 따라 네이티브 오디오 모듈(`AVPlayer` on iOS, `ExoPlayer` on Android)을 인스턴스화하고 스트리밍 연결을 시도합니다.
이때 CDN이 다운되거나 DNS 에러, 혹은 일시적인 패킷 드롭이 발생하면 다음과 같이 동작합니다:
* **iOS (`AVPlayer`)**: 네이티브 레벨에서 세션 연결이 끊어지면 주기적인 재시도를 수행하다가 일정 임계 시간(보통 15~30초) 이후 `AVPlayerItemStatusFailed`를 반환합니다. 이 대기 시간 동안 `createAsync` 프로미스는 해결(Resolve)되지 않고 멈춰(Hang)있으므로, 오디오 세션을 잠근 JS 스레드가 멈추게 됩니다.
* **Android (`ExoPlayer`)**: `HttpDataSourceException` 또는 `ConnectException`을 던지며 프라미스가 거부(Reject)됩니다. 이 예외를 적절히 포착하여 처리하지 않으면, React Native 앱 전체에 `Unhandled Promise Rejection` 크래시가 전파되거나 오디오 엔진 서비스의 상태가 오염됩니다.
* **문제점**: 두 플랫폼 모두 네이티브 타임아웃이 너무 길어, 사용자는 재생 버튼을 누르거나 지오펜스 구역에 진입했을 때 아무 소리도 들리지 않는 비정상적인 '지연 상태'나 '먹통 현상'을 경험하게 됩니다.

### 2.2 secondary load fallback 메커니즘 부재 비평
현재 제안된 `playAmbientSound` 구현은 `resolveAudioSource`가 네트워크 CDN URI를 반환할 때 발생할 수 있는 런타임 예외를 오직 최외각 try-catch에서만 잡고 있습니다:
```typescript
try {
  ...
  const { sound: ambient } = await Audio.Sound.createAsync(ambientSource);
  ambientSound = ambient;
  ...
} catch (err) {
  console.error('[Audio Engine] Playback failed:', err); // 단순 에러 로그 출력 후 종료
}
```
* **결함 분석**: CDN 연결이 실패하면 단순히 에러 로그만 남기고 오디오 재생 흐름이 영구히 멈춥니다. 즉, 재생 시도 자체가 실패로 종료되어 사용자는 완벽한 **무음 상태(Silent state)**에 남게 됩니다. 이는 레벨 1(Visceral UX - 생명력 부재) 및 레벨 2(Behavioral UX - 상태 장님) 규칙을 정면으로 위반하는 설계입니다.
* **개선 방향**: 로컬 번들에 내장된 기본 파일(`require('../../assets/sounds/ambient_sea.mp3')` 등)을 사전에 정의해 둔 `BUNDLED_SOUNDS`를 활용해, CDN 또는 캐시 로드 시도에 예외가 발생할 경우 즉각 로컬 파일로 강제 전환 로드하는 2중 방어선(Secondary Fallback)이 필수적입니다.

### 2.3 Proposed Fallback try-catch Architecture (제안된 폴백 아키텍처)
이 결함을 해결하기 위해 `audio_engine_service.ts`에 도입할 견고한 폴백 구조를 제안합니다.

```typescript
// mobile/lib/services/audio_engine_service.ts
import { Audio } from 'expo-av';
import { resolveAudioSource, BUNDLED_SOUNDS } from './audio_caching_service';

/**
 * CDN 또는 로컬 캐시 로드 중 예외나 타임아웃이 발생할 경우
 * 즉시 로컬에 번들링된 리소스(require)로 안전하게 대체 로드하는 헬퍼 함수
 */
async function loadSoundWithFallback(
  source: any,
  fallbackAsset: any,
  timeoutMs: number = 5000
): Promise<{ sound: Audio.Sound }> {
  try {
    // 1. 소스가 네트워크 URI(http/https)인 경우, 무한 대기를 막기 위한 타임아웃 적용
    if (source && source.uri && source.uri.startsWith('http')) {
      const loadPromise = Audio.Sound.createAsync(source, { shouldPlay: false });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`[Audio Engine] Load timeout after ${timeoutMs}ms`)), timeoutMs)
      );

      // 네트워크 로드와 5초 타임아웃 간의 경쟁
      return await Promise.race([loadPromise, timeoutPromise]);
    }

    // 2. 로컬 캐시 URI인 경우 바로 로드 시도
    return await Audio.Sound.createAsync(source, { shouldPlay: false });
  } catch (error) {
    console.warn(
      `[Audio Fallback] CDN/Cache load failed for source: ${JSON.stringify(source)}. ` +
      `Falling back to local bundled asset immediately. Error:`,
      error
    );
    // 3. 네이티브 에러 발생 시 번들링된 require 자산으로 즉각 폴백
    return await Audio.Sound.createAsync(fallbackAsset, { shouldPlay: false });
  }
}
```

이 헬퍼를 `playAmbientSound`에 적용하면 다음과 같이 극도로 견고한 흐름이 됩니다:

```typescript
export async function playAmbientSound(waterType: string | undefined): Promise<void> {
  const currentRequestId = ++activePlaybackRequestId;
  try {
    await stopAmbientSound();

    const soundFile = waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';
    const ambientSource = await resolveAudioSource(soundFile);
    const windSource = await resolveAudioSource('white_noise_wind.mp3');

    if (currentRequestId !== activePlaybackRequestId) return;

    // 로컬 폴백 매핑 매칭
    const fallbackAmbientAsset = waterType === 'sea'
      ? BUNDLED_SOUNDS['ambient_sea.mp3']
      : BUNDLED_SOUNDS['ambient_river.mp3'];

    // 1차 타겟 로딩 시도 (실패 시 즉시 로컬 에셋 로드 보장)
    const { sound: ambient } = await loadSoundWithFallback(ambientSource, fallbackAmbientAsset);
    
    if (currentRequestId !== activePlaybackRequestId) {
      await ambient.unloadAsync();
      return;
    }
    ambientSound = ambient;
    await ambientSound.setIsLoopingAsync(true);
    await ambientSound.playAsync();

    // 바람 백그라운드 믹싱도 동일한 방식으로 적용
    const fallbackWindAsset = BUNDLED_SOUNDS['white_noise_wind.mp3'];
    const { sound: wind } = await loadSoundWithFallback(windSource, fallbackWindAsset);

    if (currentRequestId !== activePlaybackRequestId) {
      await wind.unloadAsync();
      return;
    }
    windSound = wind;
    await windSound.setIsLoopingAsync(true);
    await windSound.playAsync();

  } catch (err) {
    console.error(`[Audio Engine] Fatal playback error on request #${currentRequestId}:`, err);
  }
}
```

---

## 3. LRU Eviction Pinning & Deadlock 검증

### 3.1 재생 준비 단계의 경쟁 상태 (Race Condition) 상세 분석
Cycle 3 정제 설계의 `enforceCacheLimits`는 `pinnedFiles` Set에 존재하는 파일과 `activeSoundChecker`가 `true`를 반환하는 활성 사운드를 삭제 대상에서 배제합니다.
그러나 이는 **오디오 데이터가 성공적으로 로드된 후의 안전성만 보장할 뿐, "로드 중"인 임계 상태를 놓치고 있습니다.**

**경쟁 상태 타임라인 흐름:**
1. **T = 0ms**: 사용자 혹은 지오펜스 동작으로 인해 `playAmbientSound("sea")`가 실행됩니다.
2. **T = 10ms**: `resolveAudioSource("ambient_sea.mp3")`가 호출되어 캐시 경로가 정상적으로 해석됩니다. 결과값으로 `{ uri: 'file://.../sounds/ambient_sea.mp3' }`가 결정됩니다.
3. **T = 20ms**: `Audio.Sound.createAsync` 호출이 이루어지기 직전, 다른 병렬 다운로드 작업이 완료되어 `enforceCacheLimits()` 캐시 한도 확인 루프가 실행됩니다.
4. **T = 30ms**: 캐시 루프는 디렉토리를 탐색하며 `ambient_sea.mp3` 파일을 탐지합니다.
   - `pinnedFiles.has('ambient_sea.mp3')` 검사 $\rightarrow$ **`false`** (오디오가 로드 완료된 후 `pinFile`이 호출되기 때문).
   - `activeSoundChecker('ambient_sea.mp3')` 검사 $\rightarrow$ **`false`** (아직 재생기에 로드되지 않아 `activeAmbientFile` 변수가 세팅되지 않음).
5. **T = 40ms**: `enforceCacheLimits()`는 `ambient_sea.mp3`를 미사용 파일로 판단하여 `FileSystem.deleteAsync`로 영구 삭제합니다.
6. **T = 50ms**: 재생 태스크의 `Audio.Sound.createAsync(uri)`가 삭제된 경로를 참조하여 파일 열기 처리를 시도합니다.
7. **결과**: `File Not Found` 예외가 발생하여 오디오 플레이가 무참히 크래시를 내거나 실패합니다.

### 3.2 Thread-Safety Locks / loadingFiles 동기화 설계 제안
이 경쟁 상태를 완벽히 해결하려면 **캐시 경로 확인 시점부터 플레이어 로드/핀 고정 완료 시점까지 해당 자산을 보호하는 '잠금(Lock)' 풀**이 필요합니다.

이를 위해 `audio_caching_service.ts`에 `loadingFiles` 세트와 전용 잠금 API를 추가할 것을 강력히 권고합니다.

```typescript
// mobile/lib/services/audio_caching_service.ts
const loadingFiles = new Set<string>();

export function lockFileForLoading(filename: string): void {
  loadingFiles.add(filename);
  console.log(`[Cache Manager] Temporary Loading Lock acquired: ${filename}`);
}

export function unlockFileForLoading(filename: string): void {
  loadingFiles.delete(filename);
  console.log(`[Cache Manager] Temporary Loading Lock released: ${filename}`);
}
```

캐시 회수 함수 `enforceCacheLimits` 내에서는 다음과 같이 2중 보호막을 적용하여 안전성을 극대화합니다:

```typescript
// enforceCacheLimits 수정본 예시
for (const file of sortedFiles) {
  if (totalSize <= PRUNE_TARGET_BYTES) break;

  // 1. 활성 핀(pinnedFiles) 또는 로딩 중 임시 락(loadingFiles) 상태 확인
  if (pinnedFiles.has(file) || loadingFiles.has(file)) {
    console.log(`[Cache Manager] Skipping protected file (Pinned/Loading): ${file}`);
    continue;
  }

  // 2. 혹시 모를 active AV 상태 재검증 (Unpinned but active)
  if (activeSoundChecker && activeSoundUnloader) {
    const isActiveInAv = await activeSoundChecker(file);
    if (isActiveInAv) {
      console.warn(`[Cache Manager] Active AV playback detected. Triggering force-unload before eviction: ${file}`);
      await activeSoundUnloader(file);
    }
  }

  // 안전하게 삭제 실행
  const localUri = `${CACHE_DIR}${file}`;
  await FileSystem.deleteAsync(localUri, { idempotent: true });
  ...
}
```

오디오 엔진에서의 사용 플로우는 다음과 같습니다:
```typescript
try {
  const soundFile = 'ambient_sea.mp3';
  
  // 1. 경로 분석 전에 임시 락 획득
  lockFileForLoading(soundFile);
  
  const source = await resolveAudioSource(soundFile);
  
  // 2. 사운드 생성
  const { sound } = await loadSoundWithFallback(source, BUNDLED_SOUNDS[soundFile]);
  
  // 3. 로드 완료 후 정식 핀 꽂기
  pinFile(soundFile);
  activeAmbientFile = soundFile;
  
  // 4. 로드 완료되었으므로 임시 락 해제
  unlockFileForLoading(soundFile);
  
  await sound.playAsync();
} catch (err) {
  // 에러 발생 시 반드시 임시 락 해제 보장
  unlockFileForLoading(soundFile);
}
```

---

## 4. 헤드리스 백그라운드 캐싱 시간 임계치 검증

### 4.1 백그라운드 지오펜싱 캐시 사전 인출의 OS 제약 분석
모바일 운영체제는 백그라운드 지오펜싱(Geofencing) 태스크가 리소스를 무한히 사용하는 것을 단호하게 제한합니다:
* **iOS (Background Task / Location Manager)**: 지오펜스 영역 진입 후 시스템에 의해 앱이 백그라운드에서 깨어날 때, 할당받는 백그라운드 실행 기한은 보통 **10초에서 최대 30초**입니다. 이 시간 내에 비동기 처리(위치 보고, 데이터 동기화, 자산 다운로드)가 끝나지 않으면 iOS Watchdog은 가차 없이 앱 프로세스에 `SIGKILL`을 보냅니다.
* **Android (Headless JS / WorkManager)**: 백그라운드 인출 작업에 상대적으로 관대하지만, 백그라운드 실행 시간이 10~20초를 초과하면 시스템 리소스 제한 정책으로 다운로드 소켓이 강제 스로틀링을 겪거나 작업 자체가 취소될 확률이 큽니다.

### 4.2 실행 타임라인 시뮬레이션 (Execution Timeline Trace)
지오펜스 진입 상황 시 백그라운드 타임라인을 단계별로 추적하고, 네트워크 상태에 따른 리스크 수준을 평가합니다.

#### 가상 하천/바다 구역 진입 시 백그라운드 실행 타임라인:
1. **T = 0.00s**: OS가 앱에 Geofence Entry 이벤트를 발송하여 백그라운드 태스크를 깨움.
2. **T = 0.10s**: `processLocationUpdate` 실행 시작. 현재 캐시 메타데이터 분석 및 상태 복원 완료.
3. **T = 0.20s**: 다운로드 대상 자산 식별 (`ambient_sea.mp3` [~4.5MB], `white_noise_wind.mp3` [~2.0MB]). 둘 다 캐시 미스 상태라고 가정 (총 6.5MB 다운로드 필요).
4. **T = 0.30s**: `prefetchAudioAssets`가 첫 번째 자산(`ambient_sea.mp3`) 다운로드 요청 실행.

#### 시나리오 A: 고속 5G/Wi-Fi 환경 (50 Mbps / 6.25 MB/s)
- **T = 0.30s ~ 1.02s**: `ambient_sea.mp3` 다운로드 완료 (소요: ~0.72초).
- **T = 1.02s ~ 1.34s**: `white_noise_wind.mp3` 다운로드 완료 (소요: ~0.32초).
- **T = 1.40s**: 재생 준비 및 오디오 모듈 바인딩 완료.
- **T = 1.60s**: 백그라운드 태스크 완료 선언 및 휴면 상태 진입.
- **판정**: **안전 (PASS)**. 전체 처리 시간 1.60초로 OS 임계 한도 내에서 여유 있게 끝남.

#### 시나리오 B: 표준 4G LTE 환경 (10 Mbps / 1.25 MB/s)
- **T = 0.30s ~ 3.90s**: `ambient_sea.mp3` 다운로드 완료 (소요: ~3.60초).
- **T = 3.90s ~ 5.50s**: `white_noise_wind.mp3` 다운로드 완료 (소요: ~1.60초).
- **T = 5.70s**: 재생 준비 완료.
- **T = 6.00s**: 백그라운드 태스크 안전 종료.
- **판정**: **안전 (PASS)**. 평균 6초 내외로 10~30초 제한 영역 안쪽에서 실행 보장됨.

#### 시나리오 C: 음영 지역 / 불량 Cellular 망 (1 Mbps / 125 KB/s)
- **T = 0.30s ~ 36.30s**: `ambient_sea.mp3` 다운로드 처리 중... 30초 시점에서 아직 다운로드가 80%만 완료됨.
- **T = 30.00s**: iOS/Android 시스템 Watchdog이 타임아웃 초과 감지.
- **T = 30.05s**: **Watchdog에 의한 강제 프로세스 종료 (`SIGKILL`)**.
- **판정**: **실패 및 앱 크래시 (FAIL)**. 사용자는 음영지역으로 강 상류나 해수욕장에 접근하는 순간 앱이 강제 종료되는 최악의 UX를 마주합니다.

### 4.3 백그라운드 인출 1-2개 제한의 충분성 검증 결과 및 보안책
* **충분성 검증 결과**: **불충분함.** 파일 개수를 1-2개로 제한하는 것만으로는 저속 네트워크 상황(음영지역, 해외, 터널 근처 등)에서의 프로세스 킬을 전적으로 예방할 수 없습니다. 모바일 디바이스가 음영지역에 들어갈 확률이 매우 높으므로, 반드시 **시간적 안전 한계선(Hard Time Boundary)**을 둬야 합니다.
* **추가 필수 보완책**:
  1. **백그라운드 전용 다운로드 타임아웃 설정**: 백그라운드 사전 인출 태스크의 총 다운로드 시간을 최대 **8초**로 강력히 제한합니다. 8초가 지나면 현재 진행 중인 모든 다운로드 작업을 강제로 중단(Abort/Cancel)시킵니다.
  2. **즉각적인 로컬 번들 폴백 재생**: 백그라운드 인출이 실패하거나 타임아웃된 경우, 재생 엔진은 망설임 없이 기내장된 로컬 리소스(`BUNDLED_SOUNDS`)를 선택하여 오디오 세션을 즉각 바인딩하고 재생을 실행합니다.
  3. **네이티브 소켓 및 파일 스트림 정리**: 다운로드 중단 시 남겨진 임시 파일 조각들을 즉시 삭제하고 소켓 커넥션을 청소해 리소스 누수를 방지합니다.

---

## 5. 결론 및 종합 Verdict

**최종 평가 등급**: **변경 후 승인 (APPROVE WITH REQUESTED CHANGES)**

Cycle 3 정제 설계는 데드락을 유발하던 캐시 파괴 메커니즘을 억제하고 모바일 백그라운드 전력 소모를 최적화하려는 현실적인 문제 해결 태도를 취했습니다. 그러나 본 비평을 통해 밝혀낸 두 가지 근본적인 문제점:
- 로드 진행 상태를 간과한 **캐시 삭제 레이스 컨디션**.
- 음영 지역에서 지오펜스 진입 시 앱 프로세스를 죽음으로 모는 **백그라운드 Watchdog 초과 위험**.
위 두 가지 상황은 런타임 크래시 및 오디오 중단으로 직결될 수 있는 초고위험군 취약점입니다.

Lead Architect는 본 Critic 리포트에 기술된 **1) `loadSoundWithFallback` 기반의 로컬 2중 방어 구조**, **2) `loadingFiles` 임시 상태 락을 통한 LRU 동시성 차단**, **3) 백그라운드 전용 8초 하드 타임아웃 및 sequential download 중단 모델**을 `audio_engine_service.ts` 및 `audio_caching_service.ts`에 추가로 반영하여 구현해야 합니다.
