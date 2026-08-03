const fs = require('fs');
let content = fs.readFileSync('scripts/fetch_vworld.js', 'utf8');

content = content.replace(/'09DBB978-D1AB-3A87-9204-62EE9F6F06EA'/g, "'58411BA3-A965-3751-B87F-9F551B97F37C'");

fs.writeFileSync('scripts/fetch_vworld.js', content, 'utf8');
