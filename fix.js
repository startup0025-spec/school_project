const fs = require('fs');
let content = fs.readFileSync('scripts/fetch_vworld.js', 'utf8');

// Fix the encoding corruption that happened in PowerShell
content = content.replace(/\?안/g, '연안');
content = content.replace(/\?소/g, '호소');
content = content.replace(/\?천구역/g, '하천구역');
content = content.replace(/\?천\?/g, '하천망');
content = content.replace(/지방하\?/g, '지방하천');
content = content.replace(/\?로/g, '도로');

// Update arrays
content = content.replace(/const WATER_LAYERS = \[[\s\S]*?\];/, `const WATER_LAYERS = [
  { name: '연안', typename: 'lt_c_wgispl2abs', waterType: 'sea', radius: 3000, priority: 1 },
  { name: '하천망', typename: 'lt_c_wkmstrm', waterType: 'river', radius: 1000, priority: 4 }
];`);

content = content.replace(/const OBSTACLE_LAYERS = \[[\s\S]*?\];/, `const OBSTACLE_LAYERS = [
  { name: '건물', typename: 'lt_c_spbd' },
  { name: '도로', typename: 'lt_c_uq111' }
];`);

fs.writeFileSync('scripts/fetch_vworld.js', content, 'utf8');
