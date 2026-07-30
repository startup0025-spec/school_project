const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content.replace(/reactnativekeyboardcontroller/g, 'rkc');
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Updated ' + filePath);
        }
    }
}

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    let files = fs.readdirSync(dir);
    for (let f of files) {
        let p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            processDir(p);
            // Rename directory if needed
            if (f === 'reactnativekeyboardcontroller') {
                let newP = path.join(dir, 'rkc');
                fs.renameSync(p, newP);
                console.log('Renamed dir ' + p);
            }
        } else if (p.match(/\.(cpp|h|mm|txt|json|cmake)$/)) {
            replaceInFile(p);
        }
    }
}

let root = 'C:\\mobile\\node_modules\\rkc';

// Special fix for package.json to ONLY replace codegenConfig name, not javaPackageName
let pkgPath = path.join(root, 'package.json');
let pkgContent = fs.readFileSync(pkgPath, 'utf8');
pkgContent = pkgContent.replace(/"name":\s*"reactnativekeyboardcontroller"/, '"name": "rkc"');
fs.writeFileSync(pkgPath, pkgContent, 'utf8');
console.log('Updated package.json');

processDir(path.join(root, 'android', 'src', 'main', 'jni'));
processDir(path.join(root, 'common'));
processDir(path.join(root, 'ios'));
