const fs = require('fs');
const files = [
  'node_modules/react-native/src/private/webapis/geometry/DOMRect.js',
  'node_modules/react-native/src/private/webapis/geometry/DOMRectList.js',
  'node_modules/react-native/src/private/webapis/geometry/DOMRectReadOnly.js',
];
files.forEach(f => {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    text = text.replace(/#x/g, '_x');
    text = text.replace(/#y/g, '_y');
    text = text.replace(/#width/g, '_width');
    text = text.replace(/#height/g, '_height');
    text = text.replace(/#length/g, '_length');
    fs.writeFileSync(f, text);
    console.log('Patched ' + f);
  }
});
