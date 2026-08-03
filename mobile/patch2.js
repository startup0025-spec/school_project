const fs = require('fs');
const file = "C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt";
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/fun updateNowPlayingMetadata\(map: ReadableMap\?, callback: Promise\) = scope\.launch \{([\s\S]*?)\n    \}/g, (match, p1) => {
    return 'fun updateNowPlayingMetadata(map: ReadableMap?, callback: Promise) { scope.launch {' + p1 + '\n    } }';
});
fs.writeFileSync(file, content);
