const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const adb = 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const emulator = 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk\\emulator\\emulator.exe';
const apkPath = 'C:\\Users\\user\\Desktop\\보내는 용도\\Anyway_the_Sea_Prod.apk';
const pkg = 'com.anyway.thesea';
const logFile = path.join(__dirname, 'logcat_full.txt');

console.log('Starting emulator...');
const emuProc = spawn(emulator, ['-avd', 'Pixel_7', '-no-window', '-no-audio', '-delay-adb']);

setTimeout(() => {
    try {
        console.log('Waiting for device...');
        execSync(`"${adb}" wait-for-device`);
        
        console.log('Waiting for boot...');
        while(true) {
            const boot = execSync(`"${adb}" shell getprop sys.boot_completed`).toString().trim();
            if(boot === '1') break;
            execSync('node -e "setTimeout(()=>{}, 2000)"');
        }
        
        console.log('Uninstalling old app...');
        try { execSync(`"${adb}" uninstall ${pkg}`); } catch(e){ /* ignore uninstall error */ }
        
        console.log('Installing APK...');
        execSync(`"${adb}" install -r "${apkPath}"`);
        
        console.log('Clearing logcat...');
        execSync(`"${adb}" logcat -c`);
        
        console.log('Launching app...');
        execSync(`"${adb}" shell monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
        
        console.log('Capturing logcat for 15 seconds...');
        const logProc = spawn(adb, ['logcat', '-v', 'time']);
        const logStream = fs.createWriteStream(logFile);
        logProc.stdout.pipe(logStream);
        
        execSync('node -e "setTimeout(()=>{}, 15000)"');
        logProc.kill();
        
        console.log('Parsing logcat for interesting errors...');
        const logContent = fs.readFileSync(logFile, 'utf8');
        const lines = logContent.split('\n');
        
        const interestingLines = lines.filter(l => 
            l.includes('AndroidRuntime') || 
            l.includes('ReactNativeJS') || 
            l.includes('com.anyway.thesea') ||
            l.includes('FATAL EXCEPTION')
        );
        
        console.log('\n--- INTERESTING LOGS ---');
        console.log(interestingLines.slice(0, 100).join('\n')); // up to 100 lines
        console.log('--- END INTERESTING LOGS ---');
        
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        execSync(`"${adb}" emu kill`);
        process.exit(0);
    }
}, 5000);
