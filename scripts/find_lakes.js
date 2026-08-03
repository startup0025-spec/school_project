const https = require('https');
const query = `
  [out:json];
  area["name"="부산광역시"]->.searchArea;
  (
    relation["natural"="water"]["water"="reservoir"](area.searchArea);
    way["natural"="water"]["water"="reservoir"](area.searchArea);
    relation["natural"="water"]["water"="lake"](area.searchArea);
    way["natural"="water"]["water"="lake"](area.searchArea);
  );
  out center;
`;
const options = {
  hostname: 'overpass.kumi.systems',
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Nodejs'
  }
};
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const elements = json.elements.filter(e => e.tags && e.tags.name);
      console.log('Total named lakes/reservoirs in Busan:', elements.length);
      elements.forEach(e => {
        const lat = e.center ? e.center.lat : e.lat;
        const lon = e.center ? e.center.lon : e.lon;
        console.log(`${e.tags.name} | Lat: ${lat} | Lon: ${lon}`);
      });
    } catch(e) { console.error('Error parsing JSON:', data.substring(0, 100)); }
  });
});
req.write('data=' + encodeURIComponent(query));
req.end();
