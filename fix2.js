const fs = require('fs');
let content = fs.readFileSync('scripts/fetch_vworld.js', 'utf8');

content = content.replace(/\?름/g, '이름');
content = content.replace(/\?계/g, '경계');

fs.writeFileSync('scripts/fetch_vworld.js', content, 'utf8');
