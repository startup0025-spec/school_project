const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt');

let code = fs.readFileSync(filePath, 'utf8');
let lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('= scope.launch {')) {
        lines[i] = lines[i].replace('= scope.launch {', '{ scope.launch {');
        
        // Find matching closing brace
        let openCount = 1;
        let j = i + 1;
        while (j < lines.length && openCount > 0) {
            // Count { and } in lines[j]
            const opens = (lines[j].match(/\{/g) || []).length;
            const closes = (lines[j].match(/\}/g) || []).length;
            
            openCount += opens;
            openCount -= closes;
            
            if (openCount === 0) {
                // We found the closing brace line. Add an extra } at the end.
                lines[j] = lines[j].replace('}', '} }');
                break;
            }
            j++;
        }
    }
}

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Successfully patched MusicModule.kt');
