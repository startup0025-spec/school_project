# Cycle 3 Kakao Map & UGC Pivot - Lead Critic Review Report

## Review Summary

**Verdict**: REQUEST_CHANGES (변경 요청)

사장님(Master), Cycle 3 설계안에 대해 꼼꼼하게 검토해 보았어요! 일기장 스티커북 아이디어는 정말 좋지만, 몇 가지 아주 위험한 구멍들이 있어서 그대로 만들면 일기장 앱이 멈추거나 망가질 수 있어요. 장소 이름표를 찾으러 매번 다락방 창고(AsyncStorage)를 다 뒤지는 바람에 앱이 느려지거나, 스티커북 상자(Metro Bundler)가 동적 이름표를 못 읽어서 쾅 하고 멈출 수 있는 문제들을 정리해 드립니다.

---

## Findings (주요 발견 사항)

### 🚨 [Critical] Finding 1: Dynamic Import 상대 경로 오류 및 Metro Bundler 호환성 문제
- **What**: `RippleContext.tsx` 내에서 `local_places` 모듈을 가져올 때 dynamic import 상대 경로가 잘못 지정되었으며, Metro Bundler 환경에서 dynamic import의 실익이 없음.
- **Where**: `mobile/context/RippleContext.tsx` (리스너 및 useEffect 복구 로직 부분)
- **Why**: 
  1. **잘못된 상대 경로**: `RippleContext.tsx`는 `mobile/context/`에 위치하고 있고 `local_places.ts`는 `mobile/core_engine/src/database/`에 있습니다. 따라서 상대 경로는 `../core_engine/src/database/local_places`가 되어야 합니다. 제안서에 쓰인 `../../core_engine/...`은 `mobile` 상위 폴더로 넘어가기 때문에 모듈을 찾지 못하고 **런타임 빌드 에러**를 유발합니다.
  2. **Metro Bundler의 코드 분할 미지원**: React Native의 Metro Bundler는 기본적으로 웹(Webpack/Vite)처럼 런타임 코드 분할(Code-splitting)과 동적 청크 로딩을 지원하지 않고 하나의 `index.bundle`로 묶습니다. Metro는 `import()` 호출을 단순하게 `Promise.resolve(require(...))`로 변환하여 동기식으로 번들링하기 때문에, 메모리나 로딩 성능의 이점 없이 불필요한 비동기 약속(Promise) 연산만 증가시킵니다.
- **Suggestion**: 최상단(Static top-level)에서 정적 import를 사용하도록 수정합니다:
  ```typescript
  import { getPlaceById } from '@/core_engine/src/database/local_places';
  ```

### ⚠️ [Major] Finding 2: `getPlaceById` 호출 시 매번 발생하는 AsyncStorage 디스크 I/O 병목
- **What**: `local_places.ts`에서 장소 ID를 조회할 때 매번 `AsyncStorage.getItem`을 호출하여 디스크 읽기와 JSON 파싱을 반복함.
- **Where**: `mobile/core_engine/src/database/local_places.ts` (특히 `getPlaces` 및 `getPlaceById` 함수)
- **Why**: `onTrackingStateUpdate` 이벤트는 지오펜싱 트래킹 중에 실시간 위치 갱신에 따라 매우 자주 발생합니다. 매번 `getPlaceById`가 호출될 때마다 SQLite 디스크(Android의 AsyncStorage 백엔드)를 비동기로 읽고 무거운 JSON을 파싱하는 구조는 심각한 오버헤드를 발생시킵니다. 이로 인해 UI 프레임 드롭(Stuttering) 및 배터리 과소모가 발생합니다.
- **Suggestion**: 모듈 레벨에서 **메모리 기반 캐시(In-memory Cache)** 변수 및 Map 구조를 도입하여 최초 1회만 디스크에서 로드하고 이후로는 메모리에서 $O(1)$로 즉시 조회하도록 보완합니다.
  ```typescript
  let cachedPlacesInMemory: Place[] | null = null;
  const cachedPlacesMap = new Map<string, Place>();
  ```

### ⚠️ [Major] Finding 3: 번들 폴백 데이터(`busan_places_master.json`)의 비어있는 장소 리스트
- **What**: 오프라인 첫 실행 환경을 대비한 로컬 폴백 데이터 파일 `busan_places_master.json`이 비어 있음.
- **Where**: `mobile/assets/data/busan_places_master.json`
- **Why**: 네트워크가 연결되지 않은 상태에서 앱을 처음 켰을 때 CDN 조회에 실패하면 `getPlaces()`는 로컬 번들 파일에 의존합니다. 하지만 이 파일의 `places` 배열이 `[]`로 완전히 비어 있어서 수동 장소 선택 목록이 아무것도 나오지 않고 지오펜싱 장소 매칭도 실패하게 됩니다.
- **Suggestion**: 로컬 번들 데이터 파일(`busan_places_master.json`)에 기본 장소 시드 데이터(Seed data)를 미리 채워두어 오프라인 상태에서도 정상 동작하도록 보장해야 합니다.

### ℹ️ [Minor] Finding 4: 역사적 일기 데이터 로드 시 안전한 JSON 파싱 가드 및 검증 누락
- **What**: 기존 AsyncStorage에 들어있던 예전 일기 데이터들을 불러와 파싱할 때 개별 필드 타입 및 유효성 검증(Sanitization) 없이 그대로 상태에 적용함.
- **Where**: `mobile/context/RippleContext.tsx`
- **Why**: TypeScript의 컴파일 타임 검증은 런타임에 외부에서 불려오는 AsyncStorage 데이터에는 적용되지 않습니다. 예전 데이터가 누락되었거나 데이터가 오염(예: `label`이나 `detail`이 string이 아닌 object 형태 등)되어 있을 경우, React Native의 `FlatList` 렌더링 도중 `<Text>` 안에서 자식 컴포넌트 오류 등으로 인해 **빨간 화면(Red Screen) 크래시**가 발생할 수 있습니다.
- **Suggestion**: 파싱 후 각 항목의 중요 필드가 유효한 문자열인지 아래처럼 검증하는 가드를 작성해야 합니다:
  ```typescript
  const parsed = JSON.parse(data);
  if (Array.isArray(parsed)) {
    const validEntries = parsed.filter(
      (entry) =>
        entry &&
        typeof entry.id === 'string' &&
        typeof entry.label === 'string' &&
        typeof entry.detail === 'string'
    );
    setDiaryEntries(validEntries);
  }
  ```

### ℹ️ [Minor] Finding 5: 취약한 헥사 코드 문자열 접합 투명도 설정
- **What**: 배지 컴포넌트 배경색 설정 시 투명도를 위해 헥사 색상 코드에 문자열 `'10'`을 직접 이어 붙임 (`colors.primary + '10'`).
- **Where**: `mobile/app/(tabs)/diary.tsx` (`renderItem` 배지 스타일)
- **Why**: `colors.primary`가 현재 `#2F6F6B`와 같이 7자리 헥사코드라서 임시방편으로 작동할 수 있지만, 향후 다크모드 대응이나 테마 개편으로 이 값이 `rgba(...)`, `rgb(...)` 또는 CSS 변수명으로 변경되면 색상이 깨지거나 렌더링 오류를 일으키게 됩니다.
- **Suggestion**: 디자인 가이드를 준수하여 이미 은은하게 정의되어 있는 시멘틱 토큰인 `colors.secondary`를 배경색으로 활용하는 것이 안전합니다.

---

## Verified Claims (검증 결과)

- **Claim 1**: `addDiaryEntry` 매개변수 시그니처 호환성을 통해 기존 호출에서 빌드 에러가 발생하지 않는다.
  - *Method*: `tsc --noEmit`와 동일한 코드 점검 및 매개변수 선택적 지정(`?`) 구조 파악.
  - *Result*: **PASS**. 기존에 `addDiaryEntry()`로 호출하는 지점들에서도 TypeScript 컴파일 상 안전합니다.
- **Claim 2**: `placeId` 및 `placeName` 속성을 `?` (선택적 속성)로 정의하여 하위 호환성이 보장된다.
  - *Method*: `DiaryEntry` 모델 정의와 `renderItem` 컴포넌트의 가드 패턴 확인.
  - *Result*: **PASS**. 기존 데이터 구조를 문제없이 렌더링합니다.

---

## Coverage Gaps (조사 갭)

- **Unexplored Area**: 백그라운드 지오펜싱 서비스(`geofencing_service.ts`)에서 발생하는 `onTrackingStateUpdate` 이벤트의 페이로드 구조 신뢰성 검토.
- **Risk Level**: **Medium**. 만약 실제 백그라운드 서비스에서 주는 데이터가 `{ activePlaceId: string }`이 아닌 다른 구조일 경우, 현재 제안된 context의 listener 로직이 오작동할 여지가 있습니다.
- **Recommendation**: 개발 단계에서 실제 백그라운드 서비스에서 송출하는 페이로드 스키마를 더 확실하게 정의하고 `activePlaceId` 외에도 예외 처리를 검증해야 합니다.

---

## Unverified Items (미확인 항목)

- **Item 1**: 실제 React Native 디바이스에서의 `DeviceEventEmitter` 백그라운드 리스너 동작 시간 지연 여부.
  - *Reason*: 가상 에뮬레이터 환경 및 정적 리뷰 제약으로 인해 하드웨어 백그라운드 지오펜스 동작의 실시간 스레드 성능은 측정할 수 없었습니다.
