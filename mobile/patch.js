const fs = require('fs');
const file = "C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt";
let content = fs.readFileSync(file, 'utf8');
let count = 0;
content = content.replace(/(@ReactMethod\s*\n\s*fun\s+\w+\([^)]*\))\s*=\s*scope\.launch\s*\{([\s\S]*?)\n    \}/g, (match, p1, p2) => {
    count++;
    return p1 + ' { scope.launch {' + p2 + '\n    } }';
});
fs.writeFileSync(file, content);
console.log('Replaced ' + count + ' instances.');
