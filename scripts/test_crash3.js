const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const adb = 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const emulator = 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk\\emulator\\emulator.exe';
const apkPath = 'C:\\Users\\user\\Desktop\\보내는 용도\\Anyway_the_Sea_Prod.apk';
const pkg = 'com.anyway.thesea';

console.log('Starting emulator...');
const emuProc = require('child_process').spawn(emulator, ['-avd', 'Pixel_7', '-no-window', '-no-audio']);

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
        
        console.log('Waiting 5 seconds for crash...');
        execSync('node -e "setTimeout(()=>{}, 5000)"');
        
        console.log('Capturing logcat...');
        const logcat = execSync(`"${adb}" logcat -d -v time`).toString();
        
        const lines = logcat.split('\n');
        const interesting = lines.filter(l => 
            l.includes('AndroidRuntime') || 
            l.includes('ReactNativeJS') || 
            l.includes('FATAL') ||
            l.includes(pkg)
        );
        
        console.log('\n--- INTERESTING LOGS ---');
        console.log(interesting.join('\n'));
        console.log('--- END INTERESTING LOGS ---');
        
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        execSync(`"${adb}" emu kill`);
        process.exit(0);
    }
}, 5000);
