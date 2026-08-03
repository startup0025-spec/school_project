const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'mobile', 'assets', 'vworld_places.json');

if (!fs.existsSync(targetFile)) {
  console.error('File not found:', targetFile);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
const originalCount = data.places.length;

const badTitleKeywords = ['노래', '주점', '식당', '역', '주차장', '부동산', '모텔', '호텔', '가든', '식육', '횟집', '카페', '커피', '어린이집', '학원', '미용', '슈퍼', '마트', '편의점', '식품', '교회', '성당', '절', '사찰', '병원', '의원', '약국', '은행', 'ATM', '우체국', '부속', '유치원', '빌라', '아파트', '오피스텔', '센터'];

data.places = data.places.filter(place => {
  const title = place.name || '';
  if (badTitleKeywords.some(kw => title.includes(kw))) {
    return false;
  }
  return true;
});

const newCount = data.places.length;
console.log(`Cleaned ${originalCount - newCount} irrelevant POIs.`);
console.log(`Remaining valid POIs: ${newCount}`);

fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf8');

// Also update the root and data directory copies if they exist
const rootPath = path.join(__dirname, '..', 'vworld_places.json');
if (fs.existsSync(rootPath)) fs.writeFileSync(rootPath, JSON.stringify(data, null, 2), 'utf8');

const dataPath = path.join(__dirname, '..', 'mobile', 'assets', 'data', 'vworld_places.json');
if (fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

console.log('Successfully updated all copies.');
