const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const adb = 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const emulator = 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk\\emulator\\emulator.exe';
const apkPath = 'C:\\Users\\user\\Desktop\\보내는 용도\\Anyway_the_Sea_Prod.apk';
const pkg = 'com.anyway.thesea';
const logFile = path.join(__dirname, 'raw_crash_log.txt');

console.log('Starting emulator...');
const emuProc = spawn(emulator, ['-avd', 'Pixel_7', '-no-window', '-no-audio']);

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
        try { execSync(`"${adb}" uninstall ${pkg}`); } catch(e){}
        
        console.log('Installing APK...');
        execSync(`"${adb}" install -r "${apkPath}"`);
        
        console.log('Clearing logcat...');
        execSync(`"${adb}" logcat -c`);
        
        console.log('Launching app...');
        execSync(`"${adb}" shell monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
        
        console.log('Waiting 10 seconds...');
        execSync('node -e "setTimeout(()=>{}, 10000)"');
        
        console.log('Dumping full logcat to raw_crash_log.txt...');
        const fullLog = execSync(`"${adb}" logcat -d -v time`).toString();
        fs.writeFileSync(logFile, fullLog);
        
        console.log('Done!');
        
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        execSync(`"${adb}" emu kill`);
        process.exit(0);
    }
}, 5000);
