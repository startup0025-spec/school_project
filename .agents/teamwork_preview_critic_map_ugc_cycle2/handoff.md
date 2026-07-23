# Handoff Report — Cycle 2 Lead Critic

## 1. Observation (직접적인 관찰 내용)

- **관찰 항목 1: WebView `baseUrl` 오리진 설정**
  - **파일 위치**: `mobile/app/(tabs)/map.tsx` (Line 509)
  - **코드 스니펫**:
    ```typescript
    source={{ html: htmlContent, baseUrl: 'https://haetae05.github.io' }}
    ```
- **관찰 항목 2: Explorer의 롱프레스 터치 좌표 변환 공식 제안**
  - **파일 위치**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_ugc_cycle2\analysis.md` (Line 119~121)
  - **코드 스니펫**:
    ```javascript
    var proj = map.getProjection();
    var containerPoint = new kakao.maps.Coords(touch.clientX, touch.clientY);
    var latlng = proj.coordsToLatLng(containerPoint);
    ```
- **관찰 항목 3: WebView Keep-Alive 스타일링 및 비활성화 상태 정의**
  - **파일 위치**: `mobile/app/(tabs)/map.tsx` (Line 582~589)
  - **코드 스니펫**:
    ```typescript
    webViewContainerInactive: {
      position: 'absolute',
      left: -9999,
      top: -9999,
      width: '100%',  // Maintain full size to avoid WebGL context discard
      height: '100%', // Maintain full size to avoid WebKit process suspension
      opacity: 0.01,  // Keep opacity above 0 to prevent process suspension
    },
    ```

---

## 2. Logic Chain (논리 단계 및 판단 근거)

1. **오리진 보안 위험 도출 (관찰 항목 1 관련)**:
   - `haetae05.github.io`는 제3자 개인 계정 도메인입니다. 만약 해당 계정이 유실되거나 도메인이 만료될 경우, 공격자가 동일 도메인을 취득하여 악의적인 자바스크립트를 배포할 수 있습니다.
   - WebView 내에서 악의적 자바스크립트가 실행되면 `window.ReactNativeWebView.postMessage` 브릿지를 통해 Native 디바이스 정보 탈취, 위치 위조, 유해 데이터 전송 등 시스템 전체에 미치는 심각한 위협이 발생합니다.
   - 따라서, 공식 프로젝트 소유의 도메인을 주입하도록 환경변수를 설계해야만 보안 및 앱스토어 검수 통과가 가능합니다.

2. **API 오용에 의한 좌표 왜곡 증명 (관찰 항목 2 관련)**:
   - Kakao Map SDK API 명세 상 `kakao.maps.Coords`는 투영법상 물리적인 좌표계(미터 단위)를 다루는 객체입니다.
   - 터치 좌표(`touch.clientX`, `touch.clientY`)는 브라우저 뷰포트 내의 CSS 화면 픽셀 좌표입니다.
   - 화면 픽셀 좌표를 `Coords` 객체에 대입하면 Kakao SDK는 터치 지점(예: 200, 300)을 원점 기준 200미터, 300미터 지점으로 해석하여 지도 중심 좌표와 동떨어진 잘못된 위치의 경위도(`LatLng`)를 도출하게 됩니다.
   - 따라서 실제 화면 픽셀은 `kakao.maps.Point` 객체에 바인딩하고 `proj.pointToLatLng(point)`를 활용해야 정상 작동합니다.

3. **백그라운드 자원 비효율성 검토 (관찰 항목 3 관련)**:
   - `left: -9999`와 `opacity: 0.01`을 지정하면 WebContent 렌더러 프로세스가 활성화 상태를 유지해 WebGL 유실은 방지할 수 있습니다.
   - 그러나 브라우저 스레드가 일시 정지되지 않기 때문에 Kakao Map의 `requestAnimationFrame` 렌더링 프레임 틱과 애니메이션 셰이더가 계속해서 동작하여 백그라운드에서 불필요한 CPU 점유율을 차지하고 배터리를 소모시킵니다.
   - 이 문제는 비활성화 상태에서 `window.requestAnimationFrame` 루프를 일시 동결하고 CSS `visibility: hidden`을 부여함으로써 완전히 해결할 수 있습니다.

---

## 3. Caveats (검토 한계 및 가정 사항)

- **Android System WebView 검증 한계**: 안드로이드 운영체제 버전 및 Chromium WebView 커스텀 빌드 사양에 따라 `baseUrl` 오리진 강제 매핑 시 CORS 차단 정책이 상이할 수 있으나, 본 분석에서는 표준 Chromium API 명세를 가정하고 진행했습니다.
- **WebGL Context 유실 임계치**: 기기 물리 RAM 압박이 극에 달할 때 백그라운드 WebView 프로세스가 중단되는 정확한 OOM 임계 메모리 수치는 기기 하드웨어 스펙마다 달라 분석 리포트에는 일반적인 복구 예외 시나리오로만 명시하였습니다.

---

## 4. Conclusion (최종 판단)

- Lead Explorer의 Cycle 2 계획안은 **"REQUEST_CHANGES(수정 요구)"** 상태입니다.
- 보안적인 위험(개인 도메인 사용), 치명적인 로직 오류(Coords 좌표 변환 오용), 비효율적 렌더링 스택 유지(CPU/배터리 누수)가 비평 결과 확정되었으므로, 해당 내용에 대한 설계 변경 및 소스코드 수정 가이드라인(Point 활용, requestAnimationFrame 더미화, visibility 제어)을 준수하도록 조치해야 합니다.

---

## 5. Verification Method (독립적인 검증 방법)

1. **좌표 변환 검증**: 
   - WebView 내 개발 콘솔에서 `new kakao.maps.Coords(200, 300)` 및 `new kakao.maps.Point(200, 300)`를 각각 생성하여 `proj.coordsToLatLng()`와 `proj.pointToLatLng()` 호출 후 리턴되는 위경도 값을 비교하여 픽셀 변환의 정확성을 대조 확인합니다.
2. **배터리 소모 모니터링**:
   - Xcode Instruments의 Energy Log 또는 Android Profiler를 활용하여, 지도 탭을 벗어난 비활성화 상태에서 CPU 점유율이 0%로 안정화되는지 체크합니다.
   - `requestAnimationFrame`이 가짜(dummy) 함수로 교체되었을 때 WebGL 렌더러 틱 소모가 정지하는지 프로파일러를 통해 분석할 수 있습니다.
