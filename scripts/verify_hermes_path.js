const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('  VERIFICATION SCRIPT 1: HERMES COMMAND PATH CHECK  ');
console.log('====================================================\n');

// 1. Locate react-native package directory
const mobileDir = path.resolve(__dirname, '../mobile');
const rnPackageJsonPath = path.resolve(mobileDir, 'node_modules/react-native/package.json');

if (!fs.existsSync(rnPackageJsonPath)) {
  console.error(`[ERROR] Cannot find react-native package at ${rnPackageJsonPath}`);
  process.exit(1);
}

const rnDir = path.dirname(rnPackageJsonPath);
console.log(`[INFO] Resolved react-native root: ${rnDir}`);

// 2. Simulate build.gradle Line 14 evaluation
// Line 14: ... + "/sdks/hermesc/%OS-BIN%/hermesc"
const unexpandedPath = path.join(rnDir, 'sdks', 'hermesc', '%OS-BIN%', 'hermesc');
const unexpandedExists = fs.existsSync(unexpandedPath);

console.log('\n--- EVALUATION 1: Unexpanded Gradle hermesCommand (Line 14) ---');
console.log(`Evaluated path: "${unexpandedPath}"`);
console.log(`Path exists on host OS? ${unexpandedExists ? 'YES (UNEXPECTED)' : 'NO (PROVEN BROKEN)'}`);
if (!unexpandedExists) {
  console.log('[PROVED] The literal path containing "%OS-BIN%" does NOT exist on host file system.');
}

// 3. Determine actual OS-BIN and executable name for current host OS
let osBin = '';
let exeName = 'hermesc';
const platform = process.platform;
const arch = process.arch;

if (platform === 'win32') {
  osBin = arch === 'x64' ? 'win64-bin' : 'win32-bin';
  exeName = 'hermesc.exe';
} else if (platform === 'darwin') {
  osBin = 'osx-bin';
} else {
  osBin = 'linux64-bin';
}

const resolvedPath = path.join(rnDir, 'sdks', 'hermesc', osBin, exeName);
const resolvedExists = fs.existsSync(resolvedPath);

console.log('\n--- EVALUATION 2: RN Gradle Plugin Auto-Resolved hermesCommand ---');
console.log(`Host Platform: ${platform} (${arch})`);
console.log(`Auto-detected OS BIN dir: ${osBin}`);
console.log(`Auto-detected Executable: ${exeName}`);
console.log(`Resolved Path: "${resolvedPath}"`);
console.log(`Path exists on host OS? ${resolvedExists ? 'YES (PROVEN VALID)' : 'NO'}`);

// 4. Check mobile/android/app/build.gradle state
const buildGradlePath = path.resolve(mobileDir, 'android/app/build.gradle');
const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');

// Check for active (uncommented) hermesCommand assignment
const activeLineMatch = buildGradleContent.split('\n').find(l => /^\s*hermesCommand\s*=/.test(l));
const hasActiveLine14 = !!activeLineMatch;

console.log('\n--- EVALUATION 3: mobile/android/app/build.gradle Inspection ---');
console.log(`Target File: ${buildGradlePath}`);
console.log(`Contains active (uncommented) "hermesCommand =" assignment? ${hasActiveLine14 ? 'YES (BUG PRESENT)' : 'NO (PATCHED / REMOVED)'}`);

if (hasActiveLine14) {
  console.log(`Active Line snippet: ${activeLineMatch.trim()}`);
  console.log('[VERDICT] Active hermesCommand line is present, overriding RN Gradle plugin auto-resolution with broken path.');
} else {
  console.log('[VERDICT] Active hermesCommand line has been REMOVED. RN Gradle plugin will correctly auto-resolve hermesCommand.');
}

console.log('\n====================================================');
console.log(`  VERIFICATION RESULT: ${hasActiveLine14 ? 'FAIL (Fix Required)' : 'PASS (Patch Verified)'}`);
console.log('====================================================');
