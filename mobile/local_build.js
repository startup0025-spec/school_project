const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const destDir = 'C:\\Users\\user\\Desktop\\보내는 용도';
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const envFile = 'C:\\Users\\user\\Desktop\\school_contest\\Anyway_the_Sea\\mobile\\.env';
const androidDir = 'C:\\Users\\user\\Desktop\\school_contest\\Anyway_the_Sea\\mobile\\android';
const mobileDir = 'C:\\Users\\user\\Desktop\\school_contest\\Anyway_the_Sea\\mobile';

// Dynamically set JAVA_HOME
const programFiles = 'C:\\Program Files\\Microsoft';
if (fs.existsSync(programFiles)) {
    const folders = fs.readdirSync(programFiles).filter(f => f.startsWith('jdk-17'));
    if (folders.length > 0) {
        process.env.JAVA_HOME = path.join(programFiles, folders[0]);
        console.log('✅ Dynamically set JAVA_HOME to:', process.env.JAVA_HOME);
    }
}

function prepare() {
    console.log(`\n======================================`);
    console.log(`🚀 Installing NPM packages and resetting Expo Prebuild...`);
    execSync('npm install', { cwd: mobileDir, stdio: 'inherit' });
    execSync('npx expo prebuild --clean --platform android', { cwd: mobileDir, stdio: 'inherit' });
}

function build(mode, outName) {
    console.log(`\n======================================`);
    console.log(`🚀 Building ${mode} APK locally...`);
    
    let envContent = fs.readFileSync(envFile, 'utf8');
    envContent = envContent.replace(/EXPO_PUBLIC_BUILD_MODE=.*/g, `EXPO_PUBLIC_BUILD_MODE=${mode}`);
    fs.writeFileSync(envFile, envContent);
    
    console.log(`🧹 Cleaning previous build artifacts...`);
    execSync('gradlew.bat clean', { cwd: androidDir, stdio: 'inherit' });
    
    console.log(`🔨 Compiling (This will take a few minutes)...`);
    execSync('gradlew.bat assembleRelease', { cwd: androidDir, stdio: 'inherit' });
    
    const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
    const destPath = path.join(destDir, outName);
    
    if (fs.existsSync(apkPath)) {
        fs.copyFileSync(apkPath, destPath);
        console.log(`🎉 Done building ${mode}! Copied to Desktop`);
    } else {
        console.error(`❌ ERROR: APK was not generated at ${apkPath}`);
    }
}

try {
    prepare();
    build('PRODUCTION', 'Anyway_the_Sea.apk');
    console.log(`\n🌟 LOCAL BUILD COMPLETED SUCCESSFULLY!`);
} catch (e) {
    console.error('\n❌ Build failed:', e.message);
}
