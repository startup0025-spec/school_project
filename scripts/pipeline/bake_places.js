#!/usr/bin/env node
/**
 * bake_places.js — 부산 명소 BFF 사전 굽기(Pre-baking) 메인 파이프라인
 *
 * [실행 환경]: GitHub Actions (매일 23:30 KST) 또는 로컬 수동 실행
 * [필수 환경변수]:
 *   - TOUR_API_KEY       : 한국관광공사 TourAPI 4.0 서비스 키 (decoding 불필요한 값)
 *   - OPENAI_API_KEY     : OpenAI API 키 (GitHub Secrets로만 주입, 절대 하드코딩 금지)
 *   - GITHUB_TOKEN       : GitHub Pages 배포용 토큰 (GitHub Actions 자동 주입)
 *   - GITHUB_REPOSITORY  : "startup0025-spec/school_project" (GitHub Actions 구동 시)
 *
 * [파이프라인 순서]:
 *  1. 한국관광공사 TourAPI 4.0 → 부산 자연/공원/해변 명소 목록 수집
 *  2. 상업적 키워드 필터링 (맛집, 카페, 웨이팅 등 배제)
 *  3. SHA-256 Differential Caching → 내용 변경/신규 명소만 처리 대상으로 분류
 *  4. OpenAI API → 처리 대상 명소의 설명을 서정적 반말+평서문으로 번역
 *  5. dfs_xy_conv → kmaNx, kmaNy 기상청 격자 자동 계산
 *  6. Haversine → 하천 명소의 waterStationName 자동 매핑
 *  7. 최종 JSON을 출력 디렉토리에 저장 후 GitHub Pages 브랜치에 커밋
 *
 * 근거: prompt_draft.md R1~R4, implementation_plan.md
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const { latLngToGrid } = require('./utils/kma_grid');
const { findNearestStation } = require('./utils/haversine');
const { WATER_STATIONS } = require('./data/water_stations');

// ──────────────────────────────────────────────────────────────
// 0. 환경변수 검증
// ──────────────────────────────────────────────────────────────
const TOUR_API_KEY = process.env.TOUR_API_KEY;

if (!TOUR_API_KEY) {
  console.error('[ERROR] TOUR_API_KEY 환경변수가 설정되어 있지 않습니다.');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────
// 1. 설정 상수
// ──────────────────────────────────────────────────────────────

/** 한국관광공사 TourAPI 4.0 — 부산 지역 코드 */
const BUSAN_AREA_CODE = '6';

/** TourAPI 콘텐츠 타입 코드 (자연관광지:12, 관광지:15, 레포츠:28) */
const CONTENT_TYPE_IDS = ['12', '15', '28'];

/** 상업적 키워드 — 이 단어가 overview에 포함되면 해당 명소를 제외 */
const COMMERCIAL_KEYWORDS = [
  '맛집', '카페', '웨이팅', '유명 식당', '음식점', '레스토랑',
  '쇼핑', '면세', '백화점', '시장 먹거리', '먹방', '투어 상품',
  '패키지', '예약', '할인', '이벤트', '특가',
];

/** 최종 출력 파일 경로 */
const OUTPUT_DIR = path.join(__dirname, '../../mobile/assets/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'busan_places_master.json');
const CACHE_FILE = path.join(__dirname, '.cache_hashes.json');

// ──────────────────────────────────────────────────────────────
// 2. 유틸리티 함수
// ──────────────────────────────────────────────────────────────

/**
 * HTTPS GET 요청 (Promise 기반)
 * @param {string} url
 * @returns {Promise<any>}
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON 파싱 실패: ${e.message}\n응답: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 문자열을 SHA-256 해시로 변환
 * @param {string} text
 * @returns {string}
 */
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * 상업적 키워드 포함 여부 검사
 * @param {string} text
 * @returns {boolean} true면 제외 대상
 */
function isCommercial(text) {
  if (!text) return false;
  return COMMERCIAL_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * 물 타입 추론 (TourAPI 카테고리 코드 기반)
 * cat1/cat2/cat3 코드와 장소명으로 대략 분류
 * @param {object} item TourAPI 아이템
 * @returns {'sea'|'river'|'stream'|'none'}
 */
function inferWaterType(item) {
  const title = item.title || '';
  const cat3 = item.cat3 || '';

  const seaKeywords = ['해수욕장', '해변', '해안', '바다', '항', '포구', '갯벌'];
  const riverKeywords = ['하천', '강', '수변', '천', '냇', '수영강', '온천천', '낙동강'];
  const streamKeywords = ['계곡', '시냇', '폭포'];

  if (seaKeywords.some((kw) => title.includes(kw) || cat3.includes(kw))) return 'sea';
  if (riverKeywords.some((kw) => title.includes(kw))) return 'river';
  if (streamKeywords.some((kw) => title.includes(kw))) return 'stream';

  // 콘텐츠 타입이 자연관광지(12)이면 기본 'none' (내륙 자연지)
  return 'none';
}

/**
 * 행정구역명 추출 (주소 문자열에서 '구' 단위 파싱)
 * @param {string} addr 도로명주소 또는 지번주소
 * @returns {string}
 */
function extractDistrict(addr) {
  if (!addr) return '부산광역시';
  const match = addr.match(/부산광역시\s+(\S+구)/);
  return match ? match[1] : '부산광역시';
}

// ──────────────────────────────────────────────────────────────
// 3. TourAPI 4.0 — 부산 명소 목록 수집
// ──────────────────────────────────────────────────────────────

/**
 * 단일 콘텐츠 타입의 명소를 모두 페이징하여 수집
 * @param {string} contentTypeId
 * @returns {Promise<Array>}
 */
async function fetchPlacesByType(contentTypeId) {
  const results = [];
  const PAGE_SIZE = 100;
  let pageNo = 1;
  let totalCount = Infinity;

  while (results.length < totalCount) {
    const url =
      `https://apis.data.go.kr/B551011/KorService1/areaBasedList1` +
      `?serviceKey=${encodeURIComponent(TOUR_API_KEY)}` +
      `&numOfRows=${PAGE_SIZE}&pageNo=${pageNo}` +
      `&MobileOS=ETC&MobileApp=AnywayTheSea` +
      `&_type=json&areaCode=${BUSAN_AREA_CODE}` +
      `&contentTypeId=${contentTypeId}`;

    console.log(`  [TourAPI] contentTypeId=${contentTypeId}, page=${pageNo} 요청 중...`);
    const json = await fetchJson(url);

    const body = json?.response?.body;
    if (!body) {
      console.warn(`  [WARN] 응답 body 없음. contentTypeId=${contentTypeId}, page=${pageNo}`);
      break;
    }

    totalCount = body.totalCount || 0;
    const items = body.items?.item || [];
    if (!Array.isArray(items) || items.length === 0) break;

    results.push(...items);
    if (results.length >= totalCount) break;
    pageNo++;

    // Rate limit 방어: 0.3초 대기
    await new Promise((r) => setTimeout(r, 300));
  }

  return results;
}

/**
 * 모든 콘텐츠 타입에서 부산 명소 전체 수집
 * @returns {Promise<Array>}
 */
async function fetchAllBusanPlaces() {
  console.log('[Step 1] 한국관광공사 TourAPI 4.0 에서 부산 명소 수집 시작...');
  const allItems = [];

  for (const typeId of CONTENT_TYPE_IDS) {
    const items = await fetchPlacesByType(typeId);
    console.log(`  → contentTypeId=${typeId}: ${items.length}건 수집`);
    allItems.push(...items);
  }

  // contentId 기준 중복 제거
  const seen = new Set();
  const unique = allItems.filter((item) => {
    if (seen.has(item.contentid)) return false;
    seen.add(item.contentid);
    return true;
  });

  console.log(`[Step 1 완료] 총 ${unique.length}건 (중복 제거 후)\n`);
  return unique;
}

// ──────────────────────────────────────────────────────────────
// 4. 상업적 키워드 필터링
// ──────────────────────────────────────────────────────────────

/**
 * @param {Array} places
 * @returns {Array}
 */
function filterCommercialPlaces(places) {
  console.log('[Step 2] 상업적 키워드 필터링...');
  const filtered = places.filter((p) => {
    // overview가 없으면 일단 포함 (Step 4에서 OpenAI가 처리)
    return !isCommercial(p.overview || '');
  });
  console.log(`[Step 2 완료] ${places.length}건 → 필터링 후 ${filtered.length}건\n`);
  return filtered;
}

// ──────────────────────────────────────────────────────────────
// 5. SHA-256 Differential Caching
// ──────────────────────────────────────────────────────────────

/**
 * 어제 캐시와 비교하여 변경/신규 항목만 처리 대상으로 표시
 * @param {Array} places
 * @returns {{ toProcess: Array, unchanged: Map<string, object> }}
 */
function diffWithCache(places) {
  console.log('[Step 3] SHA-256 Differential Caching 적용...');

  let oldCache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      oldCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
      console.warn('  [WARN] 캐시 파일 읽기 실패. 전체 재처리합니다.');
    }
  }

  const toProcess = [];
  const unchanged = new Map();

  for (const place of places) {
    const rawText = (place.overview || place.title || '').trim();
    const hash = sha256(rawText);
    const id = place.contentid;

    if (oldCache[id] && oldCache[id].hash === hash && oldCache[id].description) {
      // 내용 동일 → 기존 번역본 재사용 (OpenAI 호출 없음)
      unchanged.set(id, { ...place, _cachedDescription: oldCache[id].description, _hash: hash });
    } else {
      // 신규 또는 내용 변경 → OpenAI 처리 필요
      toProcess.push({ ...place, _hash: hash });
    }
  }

  console.log(`[Step 3 완료] 재사용(Cache Hit): ${unchanged.size}건, OpenAI 처리 필요: ${toProcess.length}건\n`);
  return { toProcess, unchanged };
}

// ──────────────────────────────────────────────────────────────
// 6. 텍스트 처리 (OpenAI 제거)
// ──────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// 7. 최종 Place 객체 조립
// ──────────────────────────────────────────────────────────────

/**
 * TourAPI 아이템 + 번역 결과를 Place 인터페이스에 맞게 조립
 * @param {object} item TourAPI 아이템
 * @param {string} description 서정적 설명
 * @returns {object} Place 객체
 */
function assemblePlaceObject(item, description) {
  const lat = parseFloat(item.mapy) || 0;
  const lng = parseFloat(item.mapx) || 0;
  const waterType = inferWaterType(item);
  const district = extractDistrict(item.addr1 || item.addr2 || '');
  const { nx, ny } = latLngToGrid(lat, lng);

  const place = {
    id: `place-${item.contentid}`,
    name: item.title || '이름 없는 장소',
    latitude: lat,
    longitude: lng,
    description,
    waterType,
    imageUrl: item.firstimage || item.firstimage2 || undefined,
    tags: ['자연', '산책', '고요'],
    geofenceRadius: waterType === 'sea' ? 500 : waterType === 'none' ? 200 : 150,
    kmaNx: nx,
    kmaNy: ny,
    district,
  };

  // 하천/시냇물 → 최단 거리 수질 측정소 자동 매핑
  if (waterType === 'river' || waterType === 'stream') {
    const stationName = findNearestStation(lat, lng, WATER_STATIONS);
    if (stationName) {
      place.waterStationName = stationName;
    }
  }

  return place;
}

// ──────────────────────────────────────────────────────────────
// 8. 캐시 저장
// ──────────────────────────────────────────────────────────────

/**
 * 다음 실행을 위한 해시+번역 캐시 저장
 * @param {Array<object>} allPlaces 최종 Place 배열
 * @param {Array} rawItems 원본 TourAPI 아이템 (hash 포함)
 */
function saveCache(allPlaces, rawItems) {
  const cache = {};
  for (const item of rawItems) {
    const place = allPlaces.find((p) => p.id === `place-${item.contentid}`);
    if (place) {
      cache[item.contentid] = {
        hash: item._hash,
        description: place.description,
      };
    }
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`[Cache] ${Object.keys(cache).length}건 캐시 저장 완료 → ${CACHE_FILE}`);
}

// ──────────────────────────────────────────────────────────────
// 9. 메인 실행 흐름
// ──────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  잔물결(Anyway the Sea) — 장소 DB 사전 굽기 시작');
  console.log(`  실행 시각: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Step 1: TourAPI에서 부산 명소 수집
  const rawPlaces = await fetchAllBusanPlaces();

  // Step 2: 상업적 키워드 필터링
  const filtered = filterCommercialPlaces(rawPlaces);

  // Step 3: Differential Caching (변경/신규만 처리)
  const { toProcess, unchanged } = diffWithCache(filtered);

  // Step 4: OpenAI 번역 생략 (원본 텍스트 유지)
  console.log('[Step 4] OpenAI 번역 생략 (로컬 Fallback)...');

  // Step 5~7: 최종 Place 객체 조립
  console.log('[Step 5] 최종 Place 객체 조립 중...');
  const allRaw = [...toProcess, ...Array.from(unchanged.values())];
  const finalPlaces = [];

  for (const item of allRaw) {
    let description;
    if (unchanged.has(item.contentid)) {
      description = unchanged.get(item.contentid)._cachedDescription;
    } else {
      description = (item.overview || item.title || '조용한 곳이야.').slice(0, 60);
    }
    finalPlaces.push(assemblePlaceObject(item, description));
  }

  // 위도 기준 정렬 (북쪽 → 남쪽)
  finalPlaces.sort((a, b) => b.latitude - a.latitude);

  console.log(`[Step 5 완료] 총 ${finalPlaces.length}개 Place 객체 생성\n`);

  // Step 6: 출력 JSON 파일 저장
  console.log('[Step 6] 출력 JSON 저장 중...');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    totalCount: finalPlaces.length,
    places: finalPlaces,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[Step 6 완료] ${OUTPUT_FILE} 저장 완료\n`);

  // Step 7: 캐시 저장
  saveCache(finalPlaces, allRaw);

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✅ 굽기 완료! ${finalPlaces.length}개 명소 데이터가 생성되었습니다.`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
