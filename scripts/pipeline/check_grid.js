/**
 * 실제 좌표 → 기상청 격자 변환 결과 확인 스크립트
 * 공식 LCC 공식 출력값을 확인하여 seed 데이터에 반영
 */
const { latLngToGrid } = require('./scripts/pipeline/utils/kma_grid');

const places = [
  { name: '해운대 동백섬',    lat: 35.1588, lng: 129.1603 },
  { name: '이기대 해안산책로', lat: 35.1122, lng: 129.1233 },
  { name: '다대포 생태탐방로', lat: 35.0553, lng: 128.9671 },
  { name: '온천천 시민공원',   lat: 35.1980, lng: 129.0840 },
];

for (const p of places) {
  const { nx, ny } = latLngToGrid(p.lat, p.lng);
  console.log(`${p.name}: lat=${p.lat}, lng=${p.lng} → nx=${nx}, ny=${ny}`);
}
