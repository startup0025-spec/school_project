const fs = require('fs');
const path = require('path');
const dirs = [
  'node_modules/react-native/src',
  'node_modules/react-native/Libraries',
  'node_modules/react-native-worklets',
  'node_modules/react-native-reanimated'
];
const privates = new Set();

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) scan(full);
    else if (full.endsWith('.js') || full.endsWith('.ts')) {
      const text = fs.readFileSync(full, 'utf8');
      // match any #word that doesn't follow a quote or slash
      const matches = text.matchAll(/(?<!['"`/0-9A-Fa-f])#([a-zA-Z_]\w*)\b/g);
      for (const m of matches) privates.add(m[1]);
    }
  }
}
dirs.forEach(scan);
console.log('FOUND_PRIVATES:', Array.from(privates).join(', '));
