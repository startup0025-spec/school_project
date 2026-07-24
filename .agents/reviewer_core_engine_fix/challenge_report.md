## Challenge Summary

**Overall risk assessment**: LOW

## Challenges

### [Low] Challenge 1 — 입력 인자의 NaN 유입 가능성
- Assumption challenged: `haversineDistance()` 함수로 전달되는 위도/경도 값이 언제나 유효한 숫자 형식일 것이라는 가정.
- Attack scenario: 외부 GPS 센서 불량 또는 데이터 흐름상의 오류로 인해 `lat1`, `lng1` 등의 값에 `NaN`이 유입될 경우, `a`가 `NaN`이 되고 `clampedA` 역시 `NaN`이 됩니다. 이로 인해 최종 반환값 `c`도 `NaN`이 되어 거리 검증 시스템이 예기치 못한 상태에 빠질 수 있습니다.
- Blast radius: 거리 계산 오류로 인한 예외가 올바르게 처리되지 않을 경우 앱 크래시나 무한 오동작을 초래할 수 있습니다.
- Mitigation: 함수 초입에 `if (Number.isNaN(lat1) || ...)` 검증 구문을 추가하여 `NaN`이 유입되면 `0` 또는 예외를 던지도록 안전 장치를 보강할 수 있습니다.

### [Low] Challenge 2 — 한국 표준시(KST) 변환 로직의 부동소수점 및 시스템 시간 의존성
- Assumption challenged: 사용자 단말기의 시스템 시간이 비교적 동기화되어 있을 것이라는 가정.
- Attack scenario: 사용자가 임의로 기기 시간을 기상청 발표 기준 시각 이전으로 조작하거나, 타임존 오프셋이 비정상적으로 계산될 경우 실제 기상 정보와 매칭되지 않는 과거 시점의 `baseTime`이 반환되어 날씨 정보 조회 실패(Empty/Null Response)를 초래할 수 있습니다.
- Blast radius: 날씨 정보 조회 실패 및 안전 경보 미발생으로 인한 오인 안내 가능성.
- Mitigation: 단말 시스템 시간 외에 서버의 타임스탬프를 보조적으로 사용하거나, API 호출 실패 시 백업 데이터를 활용하도록 구성되어 있으므로 위험도가 낮습니다.

## Stress Test Results

- `a > 1` (예: `1.0000000002` 부동소수점 오차 상황) → `clampedA`가 `1`로 안정적으로 고정되며 `Math.sqrt(1 - clampedA)`가 `0`이 되어 `NaN` 없이 정상 작동 완료 → PASS
- `a < 0` (수학적으로 불가능하지만 극단적 오차 상황) → `clampedA`가 `0`으로 안정적으로 고정되며 `Math.sqrt(clampedA)`가 `0`이 되어 `NaN` 없이 정상 작동 완료 → PASS
- `minutes < 45` 기상청 배치 경계 테스트 (예: 13시 30분) → `baseTime`이 `1200`으로 1시간 이전의 정시 시각을 정확히 리턴함 → PASS
- `hours = 0` 및 `minutes < 45` 날짜 전환 경계 테스트 (예: 00시 15분) → 전날 `2300`으로 정상 일자 감산 및 시각 리턴 확인 → PASS

## Unchallenged Areas

- 기상청 서버의 일시적 다운타임이나 네트워크 차단 상황에 대한 지연 시간(Timeout) 매커니즘은 코어 연산 엔진 범위 밖이므로 모킹/테스트 범위에서 제외되었습니다.
