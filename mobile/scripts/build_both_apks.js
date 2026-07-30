const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const androidDir = path.join(__dirname, '..', 'android');
const apkOutput = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const desktopDir = 'C:\\Users\\user\\Desktop\\보내는 용도';

const baseEnv = `EXPO_PUBLIC_KAKAO_MAP_API_KEY=24af09ad3bb319a067ce7cfc5e83fc2d
EXPO_PUBLIC_KMA_SERVICE_KEY=0ccf1bb01212098d2fb3580fc9ad1cb5f6962d33efe1fdcc9591e4bbc5a28a3f
EXPO_PUBLIC_BUSAN_SERVICE_KEY=0ccf1bb01212098d2fb3580fc9ad1cb5f6962d33efe1fdcc9591e4bbc5a28a3f
`;

process.env.JAVA_HOME = 'C:\\Users\\user\\java\\jdk-17.0.20+8';

function buildApk(mode, destName) {
    console.log(`\n=== Building ${mode} APK ===`);
    fs.writeFileSync(envPath, baseEnv + `EXPO_PUBLIC_BUILD_MODE=${mode}\n`);
    
    try {
        execSync('npx expo prebuild --platform android --clean', { cwd: 'C:\\mobile', stdio: 'inherit' });
        execSync('gradlew assembleRelease', { cwd: androidDir, stdio: 'inherit' });
        const destPath = path.join(desktopDir, destName);
        fs.copyFileSync(apkOutput, destPath);
        console.log(`Successfully copied to ${destPath}`);
    } catch (e) {
        console.error(`Failed to build ${mode} APK:`, e.message);
        process.exit(1);
    }
}

// Ensure destination directory exists
if (!fs.existsSync(desktopDir)) {
    fs.mkdirSync(desktopDir, { recursive: true });
}

console.log('\n=== Preparing for Standalone Release (Stripping expo-dev-client) ===');
execSync('npm uninstall expo-dev-client', { cwd: 'C:\\mobile', stdio: 'inherit' });

buildApk('DEMO', 'Anyway_the_Sea_Demo.apk');
buildApk('PRODUCTION', 'Anyway_the_Sea_Prod.apk');

console.log('\n=== Restoring Development Environment ===');
execSync('npm install expo-dev-client', { cwd: 'C:\\mobile', stdio: 'inherit' });

console.log('\nAll builds completed successfully!');
