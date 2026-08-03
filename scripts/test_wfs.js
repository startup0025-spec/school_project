const https = require('https');
require('dotenv').config();

const apiKey = process.env.VWORLD_API_KEY || '09DBB978-D1AB-3A87-9204-62EE9F6F06EA'; // I'll just use a mock or the env if exists
const url = `https://api.vworld.kr/req/wfs?service=WFS&request=GetFeature&version=2.0.0&crs=EPSG:4326&typename=LT_C_W_COASTLINE&bbox=128.73,34.93,129.32,35.40&size=10&format=json&key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json.features ? json.features.slice(0, 2) : json, null, 2));
    } catch(e) {
      console.log(data);
    }
  });
}).on('error', console.error);
