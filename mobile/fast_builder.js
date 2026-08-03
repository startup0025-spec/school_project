const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const destDir = 'C:\\Users\\user\\Desktop\\보내는 용도';
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const tempDir = 'C:\\b';
const sourceDir = 'C:\\Users\\user\\Desktop\\school_contest\\Anyway_the_Sea\\mobile';

console.log('🚀 Copying source files to short path C:\\b to bypass Windows MAX_PATH limit...');
if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir);

// Simple copy ignoring large generated folders
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  const basename = path.basename(src);
  
  if (basename === 'node_modules' || basename === 'android' || basename === '.expo' || basename.endsWith('.js') && basename.includes('build')) return;
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}
copyRecursiveSync(sourceDir, tempDir);

// Dynamically set JAVA_HOME
const programFiles = 'C:\\Program Files\\Microsoft';
if (fs.existsSync(programFiles)) {
    const folders = fs.readdirSync(programFiles).filter(f => f.startsWith('jdk-17'));
    if (folders.length > 0) {
        process.env.JAVA_HOME = path.join(programFiles, folders[0]);
        console.log('✅ Dynamically set JAVA_HOME to:', process.env.JAVA_HOME);
    }
}

const envFile = path.join(tempDir, '.env');
const androidDir = path.join(tempDir, 'android');

console.log('🚀 Installing dependencies in C:\\b...');
execSync('npm install', { cwd: tempDir, stdio: 'inherit' });
execSync('npx expo prebuild --clean --platform android', { cwd: tempDir, stdio: 'inherit' });

console.log('🚀 Running local patch scripts in C:\\b...');
try { execSync('node patch-domrect.js', { cwd: tempDir, stdio: 'inherit' }); } catch(e){}
try { execSync('node patch-trackplayer.js', { cwd: tempDir, stdio: 'inherit' }); } catch(e){}


function build(mode, outName) {
    console.log(`\n======================================`);
    console.log(`🚀 Building ${mode} APK locally...`);
    
    let envContent = fs.readFileSync(envFile, 'utf8');
    envContent = envContent.replace(/EXPO_PUBLIC_BUILD_MODE=.*/g, `EXPO_PUBLIC_BUILD_MODE=${mode}`);
    fs.writeFileSync(envFile, envContent);
    

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
    build('PRODUCTION', 'Anyway_the_Sea.apk');
    console.log(`\n🌟 LOCAL BUILD COMPLETED SUCCESSFULLY!`);
} catch (e) {
    console.error('\n❌ Build failed:', e.message);
}
