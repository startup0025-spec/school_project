const fs = require('fs');
let content = fs.readFileSync('scripts/fetch_vworld.js', 'utf8');

const replacement = `
    const bboxParts = BBOX.split(',').map(Number);
    const ptMin = turf.toMercator(turf.point([bboxParts[0], bboxParts[1]]));
    const ptMax = turf.toMercator(turf.point([bboxParts[2], bboxParts[3]]));
    const bbox3857 = \`\${ptMin.geometry.coordinates[0]},\${ptMin.geometry.coordinates[1]},\${ptMax.geometry.coordinates[0]},\${ptMax.geometry.coordinates[1]}\`;
    const url = \`https://api.vworld.kr/req/wfs?service=WFS&request=GetFeature&version=1.1.0&typename=\${layer.typename}&bbox=\${bbox3857}&output=application/json&key=\${VWORLD_API_KEY}&domain=https://github.com/startup0025-spec/school_project.git&size=3000\`;
`;

content = content.replace(/const url = `.*?`;/, replacement);

fs.writeFileSync('scripts/fetch_vworld.js', content, 'utf8');
