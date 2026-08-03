const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(require('os').homedir(), 'Desktop', '보내는 용도');

console.log('\n=== Building PRODUCTION APK ===');
process.env.JAVA_HOME = 'C:\\Users\\user\\java\\jdk-17.0.20+8';
process.env.EXPO_PUBLIC_BUILD_MODE = 'PRODUCTION';
execSync('npx expo prebuild --platform android --clean', { stdio: 'inherit' });
execSync('cd android && gradlew assembleRelease', { stdio: 'inherit' });
fs.copyFileSync(
  path.join(__dirname, '../android/app/build/outputs/apk/release/app-release.apk'),
  path.join(TARGET_DIR, 'Anyway_the_Sea_Prod.apk')
);
console.log('Production build successful!');
