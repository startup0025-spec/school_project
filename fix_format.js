const fs = require('fs');
let content = fs.readFileSync('scripts/fetch_vworld.js', 'utf8');

content = content.replace(/format=json/g, 'output=application/json');

fs.writeFileSync('scripts/fetch_vworld.js', content, 'utf8');
