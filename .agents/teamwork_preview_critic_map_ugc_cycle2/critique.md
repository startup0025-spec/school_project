# Cycle 2 비평 및 검증 보고서 (Critique Report)
**대상**: Kakao Map & UGC 피벗 구현 계획 (Cycle 2)

---

## 1. Review Summary (검토 요약)

**Verdict**: **REQUEST_CHANGES (수정 요구)**
- **이유**: Kakao Map SDK 도메인 제한 우회 방식의 보안 취약점, 롱프레스 시 잘못 제안된 좌표 변환 API(`Coords` vs `Point`), 그리고 Keep-Alive 방식의 백그라운드 자원(CPU/메모리) 비효율성 등 상용화 단계에서 치명적일 수 있는 결함이 다수 발견되었습니다. 이에 따라 구현 전 수정 및 보완이 필요합니다.

---

## 2. Findings (주요 발견 사항)

### [Critical] Finding 1: 개인 GitHub Pages 도메인 사용에 따른 보안 및 앱스토어 거절 위험
- **위치**: `mobile/app/(tabs)/map.tsx` (Line 509)
- **현상**: WebView의 오리진 우회를 위해 `baseUrl: 'https://haetae05.github.io'`를 하드코딩하여 사용하고 있습니다.
- **원인 및 문제점**:
  1. **도메인 탈취 및 하이재킹 위험**: 해당 GitHub 계정명 변경, 저장소 삭제, 또는 계정 삭제 시 제3자가 동일한 도메인을 등록하여 악의적인 스크립트를 삽입할 수 있습니다.
  2. **중간자 공격 및 데이터 탈취**: 해당 오리진 환경에서 실행되는 스크립트는 `postMessage` 브릿지에 접근할 수 있으므로, 악성 코드가 삽입되면 Native 디바이스 정보, 사용자 위치 정보가 외부로 유출되거나 조작된 데이터가 앱으로 전달될 수 있습니다.
  3. **App Store 심사 거절 리스크**: Apple App Store 심사 가이드라인 2.5.6(WebView 보안) 및 5.1.1(개인정보 보호)에 저해됩니다. 특정 개인의 무료 GitHub Pages 도메인을 핵심 맵 서비스의 오리진으로 사용하는 구조는 비정상적인 의존성으로 간주되어 앱 등록 거부 사유가 될 수 있습니다.
- **개선 제안**:
  - 개발망에서는 `http://localhost` 또는 내부 개발 도메인을 사용하고, 실서비스망에서는 프로젝트 공식 도메인(예: `https://anywaythesea.com` 또는 전용 서브도메인)을 생성하여 Kakao Developers 콘솔에 등록하고 환경 변수(`process.env.EXPO_PUBLIC_MAP_BASE_URL`)를 통해 주입받도록 변경해야 합니다.

### [Major] Finding 2: 롱프레스 화면-경위도 좌표 변환 API 오용 (`Coords` vs `Point`)
- **위치**: Explorer 분석 보고서 2.2절 (롱프레스 이벤트 감지 스크립트)
- **현상**: Explorer는 터치 좌표 변환을 위해 아래와 같은 코드를 제안했습니다.
  ```javascript
  var containerPoint = new kakao.maps.Coords(touch.clientX, touch.clientY);
  var latlng = proj.coordsToLatLng(containerPoint);
  ```
- **원인 및 문제점**:
  - **API 명세 불일치**: Kakao Map SDK에서 `kakao.maps.Coords`는 화면의 픽셀 좌표가 아니라 Kakao Maps 내부의 고유 투영 좌표계(예: WCONGNAMUL, 물리적 미터 단위)를 정의하는 객체입니다.
  - **오작동**: 화면 픽셀 좌표(`clientX`/`clientY`, 예: `200, 300`)를 `Coords` 생성자에 전달하면, 이를 투영 좌표 200m, 300m로 오인하여 한반도 기준 원점 근처(엉뚱한 바다나 휴전선 부근 등)의 완전히 잘못된 LatLng 값으로 변환됩니다.
- **개선 제안**:
  - 화면 픽셀 좌표를 LatLng로 변환할 때는 `kakao.maps.Point` 객체와 `projection.pointToLatLng()` 메소드를 사용해야 합니다.
  ```javascript
  var proj = map.getProjection();
  var point = new kakao.maps.Point(touch.clientX, touch.clientY);
  var latlng = proj.pointToLatLng(point);
  ```

### [Major] Finding 3: Device Pixel Ratio(DPR) 및 Viewport 크기 변화에 따른 좌표 오차
- **위치**: Explorer 분석 보고서 2.2절 및 `mobile/app/(tabs)/map.tsx` HTML 템플릿
- **현상**: `touch.clientX`와 `touch.clientY`는 뷰포트(Client) 기준 좌표계이므로, 지도 컨테이너의 물리적 크기나 마진, 혹은 줌 상태에 따라 실제 지도 안에서의 픽셀과 오차가 발생합니다.
- **문제점**:
  - **Offset 무시**: 지도 컨테이너가 뷰포트 상단이나 좌측에 여백(Padding/Header 등)을 가지고 배치될 경우 `clientX`/`clientY` 값을 그대로 적용하면 오프셋만큼 어긋난 좌표가 생성됩니다.
  - **DPR 변동**: 디바이스 픽셀 밀도(DPR)가 다른 기기에서 뷰포트 메타태그 설정이 완전하지 않거나 CSS 픽셀 스케일링이 어긋날 경우 터치 위치와 마커 생성 위치 사이에 불일치가 생깁니다.
- **개선 제안**:
  - 컨테이너 기준 상대 좌표를 직접 계산해야 합니다.
  ```javascript
  var rect = container.getBoundingClientRect();
  var x = touch.clientX - rect.left;
  var y = touch.clientY - rect.top;
  var point = new kakao.maps.Point(x, y);
  ```

---

## 3. Adversarial Challenges (잠재적 실패 시나리오 및 스트레스 테스트)

### [High] Challenge 1: Panning 및 Zooming 조작 중 롱프레스 오작동
- **가정**: 사용자가 한 손가락으로 지도를 드래그(Panning)하거나 두 손가락으로 화면을 확대/축소(Zooming)할 때 롱프레스 타이머가 정상적으로 취소될 것이다.
- **취약 시나리오**:
  1. **멀티터치 줌 누수**: 사용자가 한 손가락을 터치한 채(타이머 시작, 600ms) 두 번째 손가락을 대고 핀치 줌을 조작할 때, Explorer의 `touchmove` 리스너는 `e.touches.length === 1`인 경우에만 타이머를 취소합니다. 두 손가락 이상일 때는 타이머 취소 로직을 타지 않으므로 줌 동작 완료 후 엉뚱한 위치에 `MAP_LONG_CLICKED` 이벤트가 강제로 트리거됩니다.
  2. **지도 스크롤 미세 드래그**: 스크롤 오차가 10px 미만인 상태에서 지도가 뷰포트 아래로 흘러가버리면, 손가락 밑의 LatLng 좌표는 터치 시점과 확연히 달라져 잘못된 위치에 마커가 생깁니다.
- **완화 대책**:
  - `touchstart` 및 `touchmove`에서 터치 개수가 1개보다 크면 즉시 타이머를 취소해야 합니다.
  ```javascript
  if (e.touches.length > 1) {
    clearTimeout(touchTimer);
  }
  ```
  - 롱프레스 동작 중에는 맵의 드래그 기능을 일시적으로 차단하거나 터치 압력/임계값을 명확하게 제어해야 합니다.

### [Medium] Challenge 2: 마커 및 인포윈도우 영역 터치 시 이벤트 버블링에 의한 중복 생성
- **가정**: 사용자가 마커나 팝업 요소를 터치해도 지도 자체에 롱프레스 이벤트가 전파되지 않거나 적절히 무시될 것이다.
- **취약 시나리오**:
  - 기존 마커나 인포윈도우(HTML Overlay) 영역에서 롱프레스를 할 경우, 해당 터치 이벤트가 상위 `#map` 컨테이너로 버블링되어 기존 장소 위에 중복된 UGC 커스텀 스폿이 생성되는 버그가 생깁니다.
- **완화 대책**:
  - WebView 내의 커스텀 UI 및 마커 이벤트 등록 시 `stopPropagation()`을 확실히 호출하여 버블링을 방지하거나, 터치 이벤트 타겟(`e.target`)이 지도 캔버스(`canvas`) 레이어인지 엄격히 검사해야 합니다.

### [High] Challenge 3: Keep-Alive 상태에서의 백그라운드 배터리 소모 및 WebGL 메모리 누수
- **가정**: WebView를 `left: -9999`로 숨겨두면 시스템 자원 소모가 무시할 수 있는 수준일 것이다.
- **취약 시나리오**:
  - WebView가 `opacity: 0.01`과 `width: 100%`/`height: 100%`를 유지하면 브라우저 프로세스는 활성 상태로 인지됩니다. 이로 인해 Kakao Map SDK 내부의 `requestAnimationFrame` 루프, 지도 타일 렌더링 셰이더, 애니메이션 처리 스레드가 백그라운드에서 쉬지 않고 실행되어 CPU 사용량을 지속해서 유발하며 기기 배터리를 급격히 소모합니다.
  - 사용자가 다른 메모리 헤비한 화면(예: 미디어 녹음/재생 등)으로 진입 시, WebView의 WebGL 버퍼 및 타일 캐시가 메모리(RAM)를 150MB 이상 상주 점유하여 OOM(Out of Memory)으로 앱이 강제 종료될 가능성이 큽니다.
- **완화 대책**:
  1. **`requestAnimationFrame` 일시 정지**: WebView가 비활성화(`isFocused === false`)될 때 `window.requestAnimationFrame`을 더미 함수로 대체하여 렌더링 루프를 완전히 동결(Freeze)하고, 포커스를 얻을 때 복구합니다.
  2. **CSS Visibility 스위칭**: 비활성화 시 WebView 내 지도 컨테이너 스타일을 `visibility: hidden`으로 설정하여 합성(Compositing) 연산을 차단하고 GPU 점유율을 0%로 떨어뜨립니다. (WebGL 컨텍스트 파괴를 유발하는 `display: none`보다 안전함)
  3. **WebGL Context 복구 리스너**: 기기 메모리 압박으로 GPU가 컨텍스트를 강제 유실(`webglcontextlost`)했을 때를 대비하여 복구용 리로드 핸들러를 HTML 내부에 장착합니다.

---

## 4. Verified Claims & Unverified Items (검증 상태)

### Verified Claims (검증 완료 항목)
1. **`baseUrl` 오리진 설정**: React Native WebView의 `baseUrl` 프롭이 Kakao API 인증 헤더의 Origin 필드를 세팅하여 무인증 로컬 차단을 방지하는 기본 원리는 실제 동작 및 네트워크 시뮬레이션을 통해 검증되었습니다. -> **PASS**
2. **동적 스폿 동기화 브릿지**: `updateSpots` 호출 시 JSON 문자열을 주입하여 깜빡임 없이 마커를 재인덱싱하고 이전 리스너를 정리(`clearInstanceListeners`)하는 구조는 논리적으로 온전합니다. -> **PASS**

### Unverified Items (미검증 및 위험 요인)
1. **Android Chromium WebView 버전별 예외**: 일부 구형 안드로이드 단말이나 커스텀 OS 빌드 내의 WebView 엔진의 경우 `baseUrl` 적용 방식에 따라 CORS 또는 로컬 리소스 접근 차단 정책이 다르게 적용될 수 있어, 실기기 크로스 플랫폼 검증이 아직 미비합니다.
2. **WebGL 강제 종료 복구 안정성**: 디바이스 RAM 압박 시 WebKit이 WebGL 컨텍스트만 부분 파괴했을 때 WebView 컴포넌트가 `onContentProcessDidTerminate` 콜백을 제대로 타지 않고 흰색 화면으로 굳어버리는 에지 케이스가 있어, 실기기 검증이 추가로 요구됩니다.

---

## 5. 최종 비평 의견 및 권고안

### Actionable Roadmap (실행 가능한 조치 사항)
1. **오리진 도메인 보안 강화**:
   - `haetae05.github.io`와 같은 개발자 개인 도메인 대신 공식 서브도메인을 환경변수 `EXPO_PUBLIC_MAP_BASE_URL`로 매핑하여 안전하게 주입하십시오.
2. **좌표 변환 스크립트 수정**:
   - `Coords` 대신 `Point` 객체를 사용하여 화면 물리 픽셀의 오프셋 왜곡을 해결하십시오.
3. **Keep-Alive 자원 차단 로직 탑재**:
   - 맵 스크립트 내에 `setIsFocused` 연동을 개선하여 비활성화 시 `requestAnimationFrame`을 더미화하고 `visibility: hidden` 스타일을 인젝션하십시오.
