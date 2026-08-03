const fs = require('fs');
const path = require('path');

function replacePrivates(dir) {
  if (!fs.existsSync(dir)) return;
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch(e) { return; }
  
  for (const file of files) {
    if (file === '.cache' || file === '.bin' || file === 'hermes-engine') continue;
    
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch(e) { continue; }
    
    if (stat.isDirectory()) {
      replacePrivates(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts') || fullPath.endsWith('.mjs') || fullPath.endsWith('.cjs')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      content = content.replace(/(?<!['"`/0-9a-fA-F])#([a-zA-Z_]\w*)\b/g, '_$1');
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Patched ' + fullPath);
      }
    }
  }
}

console.log("Patching ALL node_modules for private properties...");
replacePrivates('node_modules');
console.log("Done.");
