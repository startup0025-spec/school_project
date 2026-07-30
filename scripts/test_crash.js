const { spawn, execSync } = require('child_process');
const path = require('path');

const adb = 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const emulator = 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk\\emulator\\emulator.exe';
const apkPath = 'C:\\Users\\user\\Desktop\\보내는 용도\\Anyway_the_Sea_Prod.apk';
const pkg = 'com.anyway.thesea';

console.log('Starting emulator...');
const emuProc = spawn(emulator, ['-avd', 'Pixel_7', '-no-window', '-no-audio', '-delay-adb']);

emuProc.stderr.on('data', d => console.log('EMU:', d.toString().trim()));

setTimeout(() => {
    try {
        console.log('Waiting for device...');
        execSync(`"${adb}" wait-for-device`, { stdio: 'inherit' });
        console.log('Device connected. Waiting for boot...');
        // wait for boot complete
        while(true) {
            const boot = execSync(`"${adb}" shell getprop sys.boot_completed`).toString().trim();
            if(boot === '1') break;
            execSync('node -e "setTimeout(()=>{}, 2000)"');
        }
        console.log('Boot completed. Uninstalling old app...');
        try { execSync(`"${adb}" uninstall ${pkg}`); } catch(e){}
        console.log('Installing APK...');
        execSync(`"${adb}" install -r "${apkPath}"`, { stdio: 'inherit' });
        
        console.log('Clearing logcat...');
        execSync(`"${adb}" logcat -c`);
        
        console.log('Launching app...');
        execSync(`"${adb}" shell monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`, { stdio: 'inherit' });
        
        console.log('Waiting for crash to happen (5 seconds)...');
        execSync('node -e "setTimeout(()=>{}, 5000)"');
        
        console.log('\n--- LOGCAT CRASH DUMP ---');
        const logcat = execSync(`"${adb}" logcat -d -v time *:E`).toString();
        console.log(logcat.substring(Math.max(0, logcat.length - 10000))); // last 10k chars
        console.log('--- END LOGCAT ---');
        
    } catch(e) {
        console.error('Error during test:', e.message);
        if(e.stdout) console.log(e.stdout.toString());
        if(e.stderr) console.log(e.stderr.toString());
    } finally {
        console.log('Killing emulator...');
        execSync(`"${adb}" emu kill`);
        process.exit(0);
    }
}, 5000);
