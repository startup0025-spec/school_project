/**
 * Haversine 공식 기반 지구 표면 최단 거리 계산 유틸리티
 *
 * 두 위경도 좌표 간의 지구 표면 거리를 미터(m) 단위로 반환.
 * 부산시 수질 측정소(waterStationName) 자동 맵핑에 사용.
 *
 * 근거: 교육청 대회용 앱 간단 설계서.txt, 98~99라인
 *   "부산광역시 주요 하천 수위 정보 API"
 *   "부산광역시 하천 수질 자동측정망 정보 API (수온, 탁도 추출)"
 *
 * blueprints_by_place_model.ts.md:
 *   "waterStationName: 부산시 API는 위경도가 아니라 측정소 명칭으로 데이터를 조회"
 */

const EARTH_RADIUS_M = 6371000; // 지구 반경 (미터)

/**
 * 두 좌표 사이의 거리 (미터)
 * @param {number} lat1 출발지 위도
 * @param {number} lng1 출발지 경도
 * @param {number} lat2 도착지 위도
 * @param {number} lng2 도착지 경도
 * @returns {number} 거리 (미터)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * 가장 가까운 수질 측정소를 찾아 이름을 반환
 * @param {number} lat 명소 위도
 * @param {number} lng 명소 경도
 * @param {Array<{name: string, lat: number, lng: number, maxRadius: number}>} stations 측정소 목록
 * @returns {string|null} 최단 거리 측정소 이름 (maxRadius 초과 시 null 반환)
 */
function findNearestStation(lat, lng, stations) {
  let nearest = null;
  let minDist = Infinity;

  for (const station of stations) {
    const dist = haversineDistance(lat, lng, station.lat, station.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = { ...station, distance: dist };
    }
  }

  // 최단 거리 측정소가 maxRadius(m) 이내에 있을 때만 매핑
  if (nearest && nearest.distance <= nearest.maxRadius) {
    return nearest.name;
  }
  return null;
}

module.exports = { haversineDistance, findNearestStation };
