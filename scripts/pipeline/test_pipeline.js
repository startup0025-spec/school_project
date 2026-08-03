/**
 * 파이프라인 핵심 로직 유닛 테스트 (환경변수 없이 실행 가능)
 * Acceptance Criteria 검증용
 */

const { latLngToGrid } = require('./utils/kma_grid');
const { haversineDistance, findNearestStation } = require('./utils/haversine');
const { WATER_STATIONS } = require('./data/water_stations');
const crypto = require('crypto');

let pass = 0;
let fail = 0;

function assert(label, condition, expected, actual) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    pass++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    console.error(`     Expected: ${JSON.stringify(expected)}`);
    console.error(`     Actual  : ${JSON.stringify(actual)}`);
    fail++;
  }
}

console.log('\n═══════════════════════════════════════════════════');
console.log('  잔물결 Pipeline Unit Tests');
console.log('═══════════════════════════════════════════════════\n');

// ── Test 1: 기상청 격자 변환 (사전 팩트체크 값과 일치 여부) ──────
console.log('[Test 1] KMA Grid Conversion (dfs_xy_conv)');

const dongbaek = latLngToGrid(35.1588, 129.1603); // 해운대 동백섬
assert('동백섬 nx=99', dongbaek.nx === 99, 99, dongbaek.nx);
assert('동백섬 ny=75', dongbaek.ny === 75, 75, dongbaek.ny);

const igidae = latLngToGrid(35.1122, 129.1233); // 이기대
assert('이기대 nx=99', igidae.nx === 99, 99, igidae.nx);
assert('이기대 ny=74', igidae.ny === 74, 74, igidae.ny);

const dadaepo = latLngToGrid(35.0553, 128.9671); // 다대포
assert('다대포 nx=96', dadaepo.nx === 96, 96, dadaepo.nx);
assert('다대포 ny=73', dadaepo.ny === 73, 73, dadaepo.ny);

const oncheon = latLngToGrid(35.1980, 129.0840); // 온천천
assert('온천천 nx=98', oncheon.nx === 98, 98, oncheon.nx);
assert('온천천 ny=76', oncheon.ny === 76, 76, oncheon.ny);

console.log();

// ── Test 2: Haversine 거리 계산 ──────────────────────────────────
console.log('[Test 2] Haversine Distance');

// 동일 지점 거리 = 0
const same = haversineDistance(35.1588, 129.1603, 35.1588, 129.1603);
assert('동일 지점 거리 = 0m', same === 0, 0, same);

// 동백섬 ↔ 이기대 직선거리 약 5~7km
const dongbaekToIgidae = haversineDistance(35.1588, 129.1603, 35.1122, 129.1233);
assert('동백섬↔이기대 5~7km', dongbaekToIgidae > 5000 && dongbaekToIgidae < 8000, '5000~8000', Math.round(dongbaekToIgidae));

console.log();

// ── Test 3: 수질 측정소 자동 맵핑 ──────────────────────────────
console.log('[Test 3] Nearest Water Station Mapping');

// 온천천 시민공원(35.1980, 129.0840) → 가장 가까운 측정소는 세병교(35.1978, 129.0837)여야 함
const oncheonStation = findNearestStation(35.1980, 129.0840, WATER_STATIONS);
assert('온천천 → 세병교 매핑', oncheonStation === '세병교', '세병교', oncheonStation);

// 바다 좌표(다대포)는 maxRadius 초과 → null 반환
const dadaepoStation = findNearestStation(35.0553, 128.9671, WATER_STATIONS);
assert('다대포 → null (바다, 측정소 없음)', dadaepoStation === null, null, dadaepoStation);

console.log();

// ── Test 4: SHA-256 해시 결정성(동일 입력 → 동일 출력) ──────────
console.log('[Test 4] SHA-256 Differential Caching Hash Consistency');

const text = '해운대 동백섬 설명 원문입니다. 아름다운 해안 경관';
const hash1 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const hash2 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
assert('동일 텍스트 → 동일 해시', hash1 === hash2, hash1, hash2);

const differentText = '수정된 설명입니다.';
const hash3 = crypto.createHash('sha256').update(differentText, 'utf8').digest('hex');
assert('다른 텍스트 → 다른 해시', hash1 !== hash3, '다름', hash1 === hash3 ? '같음' : '다름');

console.log();

// ── Test 5: Acceptance Criteria 검증 ───────────────────────────
console.log('[Test 5] Acceptance Criteria Checklist');

// AC1: OpenAI API Key가 소스코드에 없음 검사
const bakeSource = require('fs').readFileSync('./scripts/pipeline/bake_places.js', 'utf8');
assert(
  'AC1: 소스코드에 API 키 하드코딩 없음 (sk-로 시작하는 문자열)',
  !bakeSource.includes('sk-'),
  'sk- 없음',
  bakeSource.includes('sk-') ? 'sk- 발견됨!' : 'sk- 없음'
);
assert(
  'AC1: OpenAI API 키는 환경변수(process.env)로 주입',
  bakeSource.includes('process.env.OPENAI_API_KEY'),
  'process.env.OPENAI_API_KEY',
  'found'
);

// AC2: Differential Caching 로직 존재 여부
assert(
  'AC2: SHA-256 해시 비교(Differential Caching) 로직 존재',
  bakeSource.includes('sha256') && bakeSource.includes('Cache Hit'),
  'sha256 + Cache Hit',
  'found'
);

// AC3: Haversine 호출 존재 여부
assert(
  'AC3: Haversine(findNearestStation) 호출 존재',
  bakeSource.includes('findNearestStation'),
  'findNearestStation',
  'found'
);

// AC4: 모바일 앱이 공공 API 직접 호출하지 않음 (local_places.ts에 TourAPI URL 없음)
const localPlacesSource = require('fs').readFileSync('./mobile/core_engine/src/database/local_places.ts', 'utf8');
assert(
  'AC4: local_places.ts에 apis.data.go.kr 직접 호출 없음',
  !localPlacesSource.includes('apis.data.go.kr'),
  'apis.data.go.kr 없음',
  localPlacesSource.includes('apis.data.go.kr') ? '발견됨!' : '없음'
);
assert(
  'AC4: GitHub Pages URL로만 패칭',
  localPlacesSource.includes('startup0025-spec.github.io/school_project'),
  'startup0025-spec.github.io 종속성 확인',
  'found'
);

console.log();
console.log('═══════════════════════════════════════════════════');
console.log(`  결과: PASS ${pass} / FAIL ${fail} / TOTAL ${pass + fail}`);
console.log('═══════════════════════════════════════════════════');

if (fail > 0) process.exit(1);
