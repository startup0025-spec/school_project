/**
 * stress_test_runner.js — Programmatic Stress Test & Performance Benchmark Runner
 * Project: 'Anyway_the_Sea'
 * 
 * Imports and stress-tests real core logic, algorithms, mathematical calculations,
 * data parsing, audio engine concurrency locks/LRU eviction/stale playback, and API error resilience.
 */

const path = require('path');
const { pathToFileURL } = require('url');

// 1. Load CommonJS production modules from scripts/pipeline
const { haversineDistance, findNearestStation } = require('./pipeline/utils/haversine.js');
const { latLngToGrid } = require('./pipeline/utils/kma_grid.js');
const { WATER_STATIONS } = require('./pipeline/data/water_stations.js');

// Helper to format bytes to MB
function toMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Memory snapshot helper
function getMemorySnapshot() {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    rss: mem.rss,
    external: mem.external,
  };
}

// Format memory snapshot for logging
function formatMem(mem) {
  return `heapUsed: ${toMB(mem.heapUsed)}, heapTotal: ${toMB(mem.heapTotal)}, rss: ${toMB(mem.rss)}`;
}

// Core benchmark runner helper
async function runBenchmark(name, iterations, payloadSize, fn) {
  console.log(`\n==================================================`);
  console.log(`RUNNING BENCHMARK: ${name}`);
  console.log(`Iterations: ${iterations.toLocaleString()} | Payload Size: ${payloadSize}`);
  console.log(`==================================================`);

  if (global.gc) {
    global.gc();
  }

  const initialMem = getMemorySnapshot();
  let peakHeapUsed = initialMem.heapUsed;
  let peakRss = initialMem.rss;

  const startTime = process.hrtime.bigint();

  // Execute test iterations
  for (let i = 0; i < iterations; i++) {
    fn(i);

    // Periodically sample peak memory (every 1000 iterations or at end)
    if (i % 1000 === 0 || i === iterations - 1) {
      const currentMem = process.memoryUsage();
      if (currentMem.heapUsed > peakHeapUsed) peakHeapUsed = currentMem.heapUsed;
      if (currentMem.rss > peakRss) peakRss = currentMem.rss;
    }
  }

  const endTime = process.hrtime.bigint();
  const durationNs = endTime - startTime;
  const durationMs = Number(durationNs) / 1e6;
  const avgTimePerCallMs = durationMs / iterations;
  const opsPerSec = Math.floor((iterations / durationMs) * 1000);

  if (global.gc) {
    global.gc();
  }
  const finalMem = getMemorySnapshot();
  const heapGrowth = finalMem.heapUsed - initialMem.heapUsed;

  console.log(`[Results]`);
  console.log(`Total Duration       : ${durationMs.toFixed(3)} ms`);
  console.log(`Avg Time per Call    : ${avgTimePerCallMs.toFixed(6)} ms (${(avgTimePerCallMs * 1000).toFixed(3)} µs)`);
  console.log(`Throughput           : ${opsPerSec.toLocaleString()} ops/sec`);
  console.log(`Initial Memory       : ${formatMem(initialMem)}`);
  console.log(`Peak Heap Used       : ${toMB(peakHeapUsed)} (Peak RSS: ${toMB(peakRss)})`);
  console.log(`Final Memory         : ${formatMem(finalMem)}`);
  console.log(`Heap Growth (Delta)  : ${(heapGrowth / 1024).toFixed(2)} KB (${toMB(heapGrowth)})`);
  console.log(`Memory Leak Status   : ${heapGrowth > 5 * 1024 * 1024 ? 'WARNING: Significant Heap Growth' : 'PASS: Stable Heap'}`);

  return {
    name,
    iterations,
    payloadSize,
    durationMs,
    avgTimePerCallMs,
    opsPerSec,
    initialMem,
    peakHeapUsed,
    peakRss,
    finalMem,
    heapGrowth,
  };
}

async function main() {
  console.log('--------------------------------------------------');
  console.log('ANYWAY THE SEA — PROGRAMMATIC STRESS TEST SUITE');
  console.log('Timestamp: ' + new Date().toISOString());
  console.log('Node Version: ' + process.version);
  console.log('PID: ' + process.pid);
  console.log('--------------------------------------------------');

  // Load TypeScript modules from mobile/core_engine/src/utils/haversine.ts
  const mobileHaversinePath = path.resolve(__dirname, '../mobile/core_engine/src/utils/haversine.ts');
  const mobileHaversineModule = await import(pathToFileURL(mobileHaversinePath).href);
  const { getHaversineDistance, isValidCoordinate, sortPlacesByDistance } = mobileHaversineModule;

  // Re-create geofencing pure logic from mobile/lib/services/geofencing_service.ts
  function classifySpeed(speedMps) {
    if (speedMps < 0.8) return 'STATIONARY';
    if (speedMps < 2.5) return 'WALKING';
    if (speedMps < 8.0) return 'RUNNING';
    return 'FAST';
  }

  function evaluateNextBin(distance, geofenceRadius, previousBin) {
    switch (previousBin) {
      case 'INSIDE':
        if (distance > geofenceRadius + 30) return 'NEAR';
        return 'INSIDE';
      case 'NEAR':
        if (distance <= geofenceRadius) return 'INSIDE';
        if (distance > 1150) return 'APPROACH';
        return 'NEAR';
      case 'APPROACH':
        if (distance <= geofenceRadius) return 'INSIDE';
        if (distance <= 1000) return 'NEAR';
        if (distance > 6000) return 'FAR';
        return 'APPROACH';
      case 'FAR':
        if (distance <= geofenceRadius) return 'INSIDE';
        if (distance <= 1000) return 'NEAR';
        if (distance <= 5000) return 'APPROACH';
        if (distance > 22000) return 'OUT_OF_BOUNDS';
        return 'FAR';
      case 'OUT_OF_BOUNDS':
      default:
        if (distance <= geofenceRadius) return 'INSIDE';
        if (distance <= 1000) return 'NEAR';
        if (distance <= 5000) return 'APPROACH';
        if (distance <= 20000) return 'FAR';
        return 'OUT_OF_BOUNDS';
    }
  }

  // Re-create pipeline text parsing logic from scripts/pipeline/bake_places.js
  const COMMERCIAL_KEYWORDS = [
    '맛집', '카페', '웨이팅', '유명 식당', '음식점', '레스토랑',
    '쇼핑', '면세', '백화점', '시장 먹거리', '먹방', '투어 상품',
    '패키지', '예약', '할인', '이벤트', '특가',
  ];

  function isCommercial(text) {
    if (!text) return false;
    return COMMERCIAL_KEYWORDS.some((kw) => text.includes(kw));
  }

  function inferWaterType(title, cat3) {
    title = title || '';
    cat3 = cat3 || '';
    const seaKeywords = ['해수욕장', '해변', '해안', '바다', '항', '포구', '갯벌'];
    const riverKeywords = ['하천', '강', '수변', '천', '냇', '수영강', '온천천', '낙동강'];
    const streamKeywords = ['계곡', '시냇', '폭포'];

    if (seaKeywords.some((kw) => title.includes(kw) || cat3.includes(kw))) return 'sea';
    if (riverKeywords.some((kw) => title.includes(kw))) return 'river';
    if (streamKeywords.some((kw) => title.includes(kw))) return 'stream';
    return 'none';
  }

  function extractDistrict(addr) {
    if (!addr) return '부산광역시';
    const match = addr.match(/부산광역시\s+(\S+구)/);
    return match ? match[1] : '부산광역시';
  }

  // Re-create sonification math parameter logic from mobile/core_engine/src/api.ts
  function calculateSonificationParams(wsd, waterLevel, turbidity, waterType) {
    const alarmActive = wsd >= 14 || (waterLevel !== undefined && waterLevel >= 1.5);
    const windVolume = Math.max(0, Math.min(1, wsd / 15.0));

    let ambientVolume = 0.6;
    if (waterType === 'none') {
      ambientVolume = 0;
    } else if (waterLevel !== undefined) {
      ambientVolume = Math.max(0, Math.min(1, waterLevel / 2.0 + 0.3));
    }

    let filterFrequency = 20000;
    if (turbidity !== undefined) {
      filterFrequency = Math.max(200, Math.min(20000, 20000 - turbidity * 1000));
    }

    let pitch = 1.0;
    if (waterLevel !== undefined) {
      pitch = Math.max(0.5, Math.min(2.0, 1.0 + (waterLevel - 0.5)));
    }

    return { waterType, ambientVolume, windVolume, pitch, filterFrequency, alarmActive };
  }

  // Pure logic replica of audio_caching_service.ts & audio_engine_service.ts
  class SimulatedAudioCacheEngine {
    constructor() {
      this.MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
      this.PRUNE_TARGET_BYTES = 30 * 1024 * 1024;  // 30MB
      this.pinnedFiles = new Set();
      this.loadingFiles = new Map();
      this.metadata = new Map(); // filename -> { lastUsed, size }
      this.activePlaybackRequestId = 0;
      this.activeSounds = new Set();
    }

    lockFileForLoading(filename) {
      const current = this.loadingFiles.get(filename) || 0;
      this.loadingFiles.set(filename, current + 1);
    }

    unlockFileForLoading(filename) {
      const current = this.loadingFiles.get(filename) || 0;
      if (current <= 1) {
        this.loadingFiles.delete(filename);
      } else {
        this.loadingFiles.set(filename, current - 1);
      }
    }

    isFileLoading(filename) {
      return (this.loadingFiles.get(filename) || 0) > 0;
    }

    pinFile(filename) {
      this.pinnedFiles.add(filename);
    }

    unpinFile(filename) {
      this.pinnedFiles.delete(filename);
    }

    touchFile(filename, size) {
      this.metadata.set(filename, { lastUsed: Date.now(), size });
    }

    enforceCacheLimits() {
      let totalSize = 0;
      for (const [_, meta] of this.metadata.entries()) {
        totalSize += meta.size;
      }

      if (totalSize <= this.MAX_CACHE_SIZE_BYTES) return { evicted: 0, totalSize };

      let evictedCount = 0;
      const sorted = Array.from(this.metadata.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);

      for (const [file, meta] of sorted) {
        if (totalSize <= this.PRUNE_TARGET_BYTES) break;
        if (this.pinnedFiles.has(file) || this.isFileLoading(file)) continue;

        totalSize -= meta.size;
        this.metadata.delete(file);
        evictedCount++;
      }

      return { evicted: evictedCount, totalSize };
    }

    requestPlayback(filename) {
      const reqId = ++this.activePlaybackRequestId;
      this.lockFileForLoading(filename);

      // Return simulator promise function that checks for superseding
      return {
        reqId,
        isSuperseded: () => reqId !== this.activePlaybackRequestId,
        complete: () => {
          this.unlockFileForLoading(filename);
        }
      };
    }
  }

  // Pure logic replica of defensive API normalization from busan_api.ts, kma_api.ts, client.ts
  function parseBusanWaterLevelDefensive(data) {
    let rawItems = [];
    if (data?.getRvrwtLevelInfo?.body?.items?.item) {
      rawItems = data.getRvrwtLevelInfo.body.items.item;
    } else if (data?.WaterLevelList?.row) {
      rawItems = data.WaterLevelList.row;
    } else if (Array.isArray(data)) {
      rawItems = data;
    }

    return rawItems.map((item) => {
      const stationName = item?.siteName || item?.stationName || '';
      const rawVal = item?.waterLevel;
      let waterLevel = 0.0;
      if (rawVal !== undefined && rawVal !== null) {
        const parsed = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
        waterLevel = Number.isNaN(parsed) ? 0.0 : parsed;
      }
      return { stationName, waterLevel };
    });
  }

  function parseBusanWaterQualityDefensive(data) {
    let rawItems = [];
    if (data?.getRiverQualityStation?.body?.items?.item) {
      rawItems = data.getRiverQualityStation.body.items.item;
    } else if (data?.WaterQualityList?.row) {
      rawItems = data.WaterQualityList.row;
    } else if (Array.isArray(data)) {
      rawItems = data;
    }

    return rawItems.map((item) => {
      const stationName = item?.locNamel || item?.stationName || '';
      const rawTemp = item?.temp !== undefined ? item?.temp : item?.waterTemp;
      let waterTemp = 0.0;
      if (rawTemp !== undefined && rawTemp !== null) {
        const parsed = typeof rawTemp === 'number' ? rawTemp : parseFloat(rawTemp);
        waterTemp = Number.isNaN(parsed) ? 0.0 : parsed;
      }

      const rawTurbid = item?.turbid !== undefined ? item?.turbid : item?.turbidity;
      let turbidity = 0.0;
      if (rawTurbid !== undefined && rawTurbid !== null) {
        const parsed = typeof rawTurbid === 'number' ? rawTurbid : parseFloat(rawTurbid);
        turbidity = Number.isNaN(parsed) ? 0.0 : parsed;
      }

      return { stationName, waterTemp, turbidity };
    });
  }

  function parseKMAForecastDefensive(data) {
    const items = data?.response?.body?.items?.item || [];
    const wsdItem = items.find((it) => it?.category === 'WSD');
    if (!wsdItem) return { wsd: 0, obsrTimeMissing: !items.some(i => i?.baseTime || i?.fcstTime) };

    const parsed = parseFloat(wsdItem.fcstValue);
    const wsd = Number.isNaN(parsed) ? 0 : parsed;
    return { wsd, obsrTimeMissing: !wsdItem.fcstTime && !wsdItem.baseTime };
  }

  function simulateAxiosOfflineInterceptor(error, fallbackData) {
    const isNetworkError = !error || !error.response || error.code === 'ERR_NETWORK' || error.status === 500 || error.status === 404 || error.code === 'ETIMEDOUT';
    if (isNetworkError) {
      return {
        data: fallbackData,
        status: 200,
        statusText: 'OK (Mock Fallback)',
        headers: {},
      };
    }
    throw error;
  }

  const results = [];

  // =========================================================================
  // TEST 1: Haversine Distance Calculation (scripts/pipeline/utils/haversine.js)
  // =========================================================================
  {
    const testCoords = [];
    for (let i = 0; i < 1000; i++) {
      testCoords.push({
        lat1: 35.0 + Math.random() * 0.3,
        lng1: 128.9 + Math.random() * 0.4,
        lat2: 35.0 + Math.random() * 0.3,
        lng2: 128.9 + Math.random() * 0.4,
      });
    }

    const res1 = await runBenchmark(
      'Haversine Distance (Pipeline JS)',
      100000,
      '100,000 calls / 1,000 random Busan coordinate pairs',
      (idx) => {
        const pair = testCoords[idx % testCoords.length];
        haversineDistance(pair.lat1, pair.lng1, pair.lat2, pair.lng2);
      }
    );
    results.push(res1);

    const res2 = await runBenchmark(
      'Haversine Distance (Mobile TS with Validation)',
      100000,
      '100,000 calls / 1,000 random Busan coordinate pairs',
      (idx) => {
        const pair = testCoords[idx % testCoords.length];
        getHaversineDistance(pair.lat1, pair.lng1, pair.lat2, pair.lng2);
      }
    );
    results.push(res2);
  }

  // =========================================================================
  // TEST 2: KMA Grid LCC Projection Math (scripts/pipeline/utils/kma_grid.js)
  // =========================================================================
  {
    const coords = [];
    for (let i = 0; i < 1000; i++) {
      coords.push({
        lat: 35.0 + Math.random() * 0.3,
        lng: 128.9 + Math.random() * 0.4,
      });
    }

    const res = await runBenchmark(
      'KMA Grid LCC Projection (latLngToGrid)',
      100000,
      '100,000 calls / WGS84 to KMA Grid (nx, ny)',
      (idx) => {
        const c = coords[idx % coords.length];
        latLngToGrid(c.lat, c.lng);
      }
    );
    results.push(res);
  }

  // =========================================================================
  // TEST 3: Nearest Water Station Lookup (scripts/pipeline/utils/haversine.js)
  // =========================================================================
  {
    const coords = [];
    for (let i = 0; i < 1000; i++) {
      coords.push({
        lat: 35.15 + Math.random() * 0.1,
        lng: 129.05 + Math.random() * 0.1,
      });
    }

    const res1 = await runBenchmark(
      'Find Nearest Water Station (Default 5 Stations DB)',
      50000,
      '50,000 calls / 5 Stations DB',
      (idx) => {
        const c = coords[idx % coords.length];
        findNearestStation(c.lat, c.lng, WATER_STATIONS);
      }
    );
    results.push(res1);

    const scaled100Stations = [];
    for (let s = 0; s < 100; s++) {
      scaled100Stations.push({
        name: `Station_${s}`,
        lat: 35.0 + Math.random() * 0.3,
        lng: 128.9 + Math.random() * 0.4,
        maxRadius: 3000 + Math.random() * 2000,
      });
    }

    const res2 = await runBenchmark(
      'Find Nearest Water Station (Scaled 100 Stations DB)',
      50000,
      '50,000 calls / 100 Stations DB',
      (idx) => {
        const c = coords[idx % coords.length];
        findNearestStation(c.lat, c.lng, scaled100Stations);
      }
    );
    results.push(res2);
  }

  // =========================================================================
  // TEST 4: Places List Sorting by Distance (mobile/core_engine/src/utils/haversine.ts)
  // =========================================================================
  {
    const createPlaceList = (count) => {
      const places = [];
      for (let i = 0; i < count; i++) {
        places.push({
          id: `place-${i}`,
          name: `Place ${i}`,
          latitude: 35.0 + Math.random() * 0.3,
          longitude: 128.9 + Math.random() * 0.4,
        });
      }
      return places;
    };

    const userLocation = { latitude: 35.1796, longitude: 129.0756 };

    const smallPlaces = createPlaceList(10);
    const resSmall = await runBenchmark(
      'Sort Places by Distance (N=10 Places)',
      10000,
      'N=10 places per array sort',
      () => {
        sortPlacesByDistance(smallPlaces, userLocation);
      }
    );
    results.push(resSmall);

    const mediumPlaces = createPlaceList(100);
    const resMed = await runBenchmark(
      'Sort Places by Distance (N=100 Places)',
      10000,
      'N=100 places per array sort',
      () => {
        sortPlacesByDistance(mediumPlaces, userLocation);
      }
    );
    results.push(resMed);

    const largePlaces = createPlaceList(500);
    const resLarge = await runBenchmark(
      'Sort Places by Distance (N=500 Places)',
      2000,
      'N=500 places per array sort',
      () => {
        sortPlacesByDistance(largePlaces, userLocation);
      }
    );
    results.push(resLarge);

    function optimizedSortPlacesByDistance(placesList, userCoords) {
      if (!placesList || placesList.length === 0) return [];
      const userLat = userCoords.latitude;
      const userLng = userCoords.longitude;
      if (!isValidCoordinate(userLat, userLng)) {
        return placesList.filter((p) => p != null);
      }

      const decorated = [];
      for (let i = 0; i < placesList.length; i++) {
        const item = placesList[i];
        if (item != null) {
          const dist = getHaversineDistance(userLat, userLng, item.latitude, item.longitude);
          decorated.push({ item, dist: Number.isNaN(dist) ? Number.MAX_VALUE : dist });
        }
      }

      decorated.sort((a, b) => a.dist - b.dist);
      return decorated.map((d) => d.item);
    }

    const resOpt = await runBenchmark(
      'Sort Places by Distance OPTIMIZED O(N) Pre-computed (N=500 Places)',
      2000,
      'N=500 places per array sort (Decorated O(N) Distance Pre-compute)',
      () => {
        optimizedSortPlacesByDistance(largePlaces, userLocation);
      }
    );
    results.push(resOpt);
  }

  // =========================================================================
  // TEST 5: Geofence Distance Bin & Hysteresis State Machine (mobile/lib/services/geofencing_service.ts)
  // =========================================================================
  {
    const bins = ['INSIDE', 'NEAR', 'APPROACH', 'FAR', 'OUT_OF_BOUNDS'];
    const speeds = [0.2, 1.5, 4.0, 12.0];
    const distances = [10, 500, 2000, 10000, 25000];

    const res = await runBenchmark(
      'Geofence Hysteresis State Machine & Speed Classification',
      100000,
      '100,000 state evaluation transitions',
      (idx) => {
        const prevBin = bins[idx % bins.length];
        const dist = distances[idx % distances.length];
        const speedVal = speeds[idx % speeds.length];

        const speedClass = classifySpeed(speedVal);
        const nextBin = evaluateNextBin(dist, 300, prevBin);
      }
    );
    results.push(res);
  }

  // =========================================================================
  // TEST 6: Place Filtering, Keyword Regex & Inferencing (scripts/pipeline/bake_places.js)
  // =========================================================================
  {
    const sampleOverviews = [
      '해운대 해수욕장은 부산을 대표하는 해변으로 매년 여름 수많은 피서객이 방문합니다.',
      '금정산성 인근에 위치한 유명 맛집 식당으로 웨이팅이 2시간에 달합니다.',
      '수영강 산책로는 조용하고 평화로운 하천길로 고요한 소리를 선사합니다.',
      '온천천 시민공원은 봄마다 벚꽃이 가득한 계곡 및 시냇가 정취를 느낄 수 있습니다.',
      '부산 해운대구 우동 145번지 도로명 주소 매장 특가 할인 이벤트 패키지 안내',
    ];

    const res = await runBenchmark(
      'Place Keyword Filtering & Water Type Inferencing',
      100000,
      '100,000 parsing & regex match operations',
      (idx) => {
        const text = sampleOverviews[idx % sampleOverviews.length];
        const comm = isCommercial(text);
        const water = inferWaterType(text, '자연관광지');
        const dist = extractDistrict('부산광역시 해운대구 우동 100');
      }
    );
    results.push(res);
  }

  // =========================================================================
  // TEST 7: Sonification Parameter Math Transformations (mobile/core_engine/src/api.ts)
  // =========================================================================
  {
    const waterTypes = ['sea', 'river', 'stream', 'none'];

    const res = await runBenchmark(
      'Sonification Parameter Math Transformations',
      100000,
      '100,000 parameter calculation iterations',
      (idx) => {
        const wsd = (idx % 30);
        const wl = (idx % 300) / 100.0;
        const turb = (idx % 200) / 10.0;
        const type = waterTypes[idx % waterTypes.length];

        calculateSonificationParams(wsd, wl, turb, type);
      }
    );
    results.push(res);
  }

  // =========================================================================
  // TEST 8: Haversine & Geofence Math Edge Cases (NaN, Negative, Zero, Out-of-Bounds)
  // =========================================================================
  {
    const edgeCasePairs = [
      { lat1: NaN, lng1: 129.0, lat2: 35.1, lng2: 129.1 }, // NaN
      { lat1: 35.1, lng1: undefined, lat2: 35.1, lng2: 129.1 }, // undefined
      { lat1: 35.1, lng1: 129.1, lat2: 35.1, lng2: 129.1 }, // Zero distance
      { lat1: -35.1796, lng1: -129.0756, lat2: -35.2000, lng2: -129.1000 }, // Negative coordinates
      { lat1: 95.0, lng1: 129.0, lat2: 35.1, lng2: 129.1 }, // Out of bounds lat > 90
      { lat1: 35.1, lng1: -185.0, lat2: 35.1, lng2: 129.1 }, // Out of bounds lng < -180
      { lat1: 90, lng1: 0, lat2: -90, lng2: 180 }, // Pole to Pole antipodes
      { lat1: null, lng1: null, lat2: 35.1, lng2: 129.1 }, // nulls
    ];

    const res = await runBenchmark(
      'Haversine Math Edge Cases (NaN, Negative, Zero, Out-of-Bounds)',
      100000,
      '100,000 edge case evaluations',
      (idx) => {
        const pair = edgeCasePairs[idx % edgeCasePairs.length];
        const distTS = getHaversineDistance(pair.lat1, pair.lng1, pair.lat2, pair.lng2);
        const valid1 = isValidCoordinate(pair.lat1, pair.lng1);
        const valid2 = isValidCoordinate(pair.lat2, pair.lng2);
      }
    );
    results.push(res);
  }

  // =========================================================================
  // TEST 9: Audio Engine Concurrency Locks, LRU Eviction & Stale Playback
  // =========================================================================
  {
    const cacheSim = new SimulatedAudioCacheEngine();
    
    // Seed virtual cache files (60 files x 1MB = 60MB, exceeds 50MB limit)
    for (let f = 0; f < 60; f++) {
      cacheSim.touchFile(`sound_${f}.mp3`, 1024 * 1024);
    }
    cacheSim.pinFile('sound_0.mp3');
    cacheSim.lockFileForLoading('sound_1.mp3');

    const resLocksEviction = await runBenchmark(
      'Audio Engine Concurrency Locks, LRU Eviction & Stale Playback',
      50000,
      '50,000 simulated lock/unlock, LRU prune & request superseding operations',
      (idx) => {
        const filename = `sound_${idx % 60}.mp3`;
        
        // 1. Concurrency locks
        cacheSim.lockFileForLoading(filename);
        const loading = cacheSim.isFileLoading(filename);
        cacheSim.unlockFileForLoading(filename);

        // 2. Playback superseding simulation
        const handle = cacheSim.requestPlayback(filename);
        if (idx % 3 === 0) {
          // Rapid next request supersedes previous
          cacheSim.requestPlayback(`sound_${(idx + 1) % 60}.mp3`);
          const superseded = handle.isSuperseded();
        }
        handle.complete();

        // 3. LRU Eviction check
        if (idx % 1000 === 0) {
          cacheSim.touchFile(`sound_${idx % 60}.mp3`, 1024 * 1024);
          cacheSim.enforceCacheLimits();
        }
      }
    );
    results.push(resLocksEviction);
  }

  // =========================================================================
  // TEST 10: API Error Resilience & Defensive Parsing (Malformed JSON, 500/404, Missing Fields)
  // =========================================================================
  {
    const malformedPayloads = [
      {}, // Empty object
      { getRvrwtLevelInfo: "unexpected_string_instead_of_obj" },
      { WaterLevelList: { row: [ { stationName: "구포", waterLevel: "INVALID_FLOAT" } ] } },
      { getRiverQualityStation: { body: { items: { item: [ { locNamel: "화명", temp: "22.5", turbid: "1.2" } ] } } } },
      { getRiverQualityStation: { body: null } }, // null body
      { response: { header: { resultCode: "00" }, body: { items: { item: [ { category: "WSD", fcstValue: "12.5" } ] } } } },
      { response: { header: { resultCode: "99" }, body: undefined } }, // missing obsrTime / items
      [ { siteName: "사상", waterLevel: null } ], // array format
    ];

    const simulatedErrors = [
      { status: 500, message: "Internal Server Error" },
      { status: 404, message: "Not Found" },
      { code: "ERR_NETWORK", message: "Network Error" },
      { code: "ETIMEDOUT", message: "Timeout" },
    ];

    const mockFallback = { items: [], fallback: true };

    const resAPIResilience = await runBenchmark(
      'API Error Resilience & Defensive Parsing (500/404/Timeout/Malformed)',
      50000,
      '50,000 error handling & defensive payload normalization operations',
      (idx) => {
        const payload = malformedPayloads[idx % malformedPayloads.length];
        const err = simulatedErrors[idx % simulatedErrors.length];

        // 1. Defensive water level parsing
        const parsedWater = parseBusanWaterLevelDefensive(payload);

        // 2. Defensive water quality parsing (handles locNamel)
        const parsedQuality = parseBusanWaterQualityDefensive(payload);

        // 3. Defensive KMA forecast parsing (handles missing obsrTime/WSD)
        const parsedKMA = parseKMAForecastDefensive(payload);

        // 4. Offline Axios Interceptor simulation
        const response = simulateAxiosOfflineInterceptor(err, mockFallback);
      }
    );
    results.push(resAPIResilience);
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n==================================================');
  console.log('SUMMARY BENCHMARK EXECUTIVE TABLE');
  console.log('==================================================');
  console.log(
    '| Index | Benchmark Name                                                       | Iterations | Total (ms) | Avg (us/call) | Ops/sec      | Peak Heap | Heap Delta |'
  );
  console.log(
    '|-------|----------------------------------------------------------------------|------------|------------|---------------|--------------|-----------|------------|'
  );
  results.forEach((r, idx) => {
    const name = r.name.padEnd(68, ' ');
    const iters = r.iterations.toLocaleString().padStart(10, ' ');
    const totalMs = r.durationMs.toFixed(2).padStart(10, ' ');
    const avgUs = (r.avgTimePerCallMs * 1000).toFixed(2).padStart(13, ' ');
    const ops = r.opsPerSec.toLocaleString().padStart(12, ' ');
    const peak = toMB(r.peakHeapUsed).padStart(9, ' ');
    const delta = ((r.heapGrowth / 1024).toFixed(2) + ' KB').padStart(10, ' ');
    console.log(`| ${String(idx).padStart(5, ' ')} | ${name} | ${iters} | ${totalMs} | ${avgUs} | ${ops} | ${peak} | ${delta} |`);
  });

  console.log('\n[STRESS TEST COMPLETED SUCCESSFULLY]');
}

main().catch((err) => {
  console.error('STRESS TEST RUNNER FATAL ERROR:', err);
  process.exit(1);
});
