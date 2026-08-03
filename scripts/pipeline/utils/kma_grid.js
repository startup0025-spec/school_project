/**
 * 기상청 단기예보 격자 좌표 변환 유틸리티 (LCC 투영법)
 *
 * 기상청 공식 dfs_xy_conv 알고리즘 구현.
 * WGS84 위경도(lat, lng) ↔ 기상청 격자(nx, ny) 상호 변환.
 *
 * 근거: 교육청 대회용 앱 간단 설계서.txt, 104라인
 *   "기상청 단기예보 조회 서비스 (현재 풍속 WSD 데이터 추출)"
 *
 * @param {string} code - 'toXY' (위경도→격자) | 'toLL' (격자→위경도)
 * @param {number} v1   - 위도(toXY) 또는 nx(toLL)
 * @param {number} v2   - 경도(toXY) 또는 ny(toLL)
 * @returns {{ x: number, y: number } | { lat: number, lng: number }}
 */

const EARTH_RADIUS = 6371.00877;
const GRID_SPACING = 5.0;
const STD_LAT_1 = 30.0;
const STD_LAT_2 = 60.0;
const ORIGIN_LAT = 38.0;
const ORIGIN_LNG = 126.0;
const ORIGIN_X = 43;
const ORIGIN_Y = 136;

const DEGRAD = Math.PI / 180.0;
const RADDEG = 180.0 / Math.PI;

const re = EARTH_RADIUS / GRID_SPACING;
const slat1 = STD_LAT_1 * DEGRAD;
const slat2 = STD_LAT_2 * DEGRAD;
const olon = ORIGIN_LNG * DEGRAD;
const olat = ORIGIN_LAT * DEGRAD;

let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;

let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
ro = (re * sf) / Math.pow(ro, sn);

/**
 * 위경도 → 기상청 격자 (nx, ny)
 * @param {number} lat 위도
 * @param {number} lng 경도
 * @returns {{ nx: number, ny: number }}
 */
function latLngToGrid(lat, lng) {
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);

  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + ORIGIN_X + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + ORIGIN_Y + 0.5);

  return { nx, ny };
}

module.exports = { latLngToGrid };
