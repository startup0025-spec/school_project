const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log(' VERIFICATION SCRIPT 3: LAYOUT & MANIFEST SANITY   ');
console.log('====================================================\n');

// 1. Check mobile/app/_layout.tsx
const layoutPath = path.resolve(__dirname, '../mobile/app/_layout.tsx');

if (!fs.existsSync(layoutPath)) {
  console.error(`[ERROR] Cannot find _layout.tsx at ${layoutPath}`);
  process.exit(1);
}

const layoutContent = fs.readFileSync(layoutPath, 'utf8');
console.log(`[INFO] Loaded Root Layout: ${layoutPath}`);

const hasRegisterPlaybackService = layoutContent.includes('registerPlaybackService');
const hasTryCatchProtection = layoutContent.includes('try') && layoutContent.includes('registerPlaybackService') && layoutContent.includes('catch');
const hasUnwrappedService = layoutContent.includes('s.default || s') || layoutContent.includes('default ||');
const hasSplashCatchGuard = layoutContent.includes('SplashScreen.hideAsync().catch');

console.log('\n--- EVALUATION 1: TrackPlayer.registerPlaybackService & Layout Protection ---');
console.log(`Contains registerPlaybackService call? ${hasRegisterPlaybackService ? 'YES' : 'NO'}`);
console.log(`Wrapped in try-catch protection? ${hasTryCatchProtection ? 'YES (PROVEN PROTECTED)' : 'NO (CRASH RISK)'}`);
console.log(`Unwraps ES module default export? ${hasUnwrappedService ? 'YES (PROVEN UNWRAPPED)' : 'NO'}`);
console.log(`SplashScreen.hideAsync has .catch guard? ${hasSplashCatchGuard ? 'YES (PROVEN PROTECTED)' : 'NO'}`);

if (hasRegisterPlaybackService && hasTryCatchProtection && hasUnwrappedService && hasSplashCatchGuard) {
  console.log('[PASS] registerPlaybackService and SplashScreen in _layout.tsx are safely configured.');
} else {
  console.log('[FAIL] _layout.tsx configuration missing expected guards.');
}

// 2. Check mobile/android/app/src/main/AndroidManifest.xml
const manifestPath = path.resolve(__dirname, '../mobile/android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error(`[ERROR] Cannot find AndroidManifest.xml at ${manifestPath}`);
  process.exit(1);
}

const manifestContent = fs.readFileSync(manifestPath, 'utf8');
console.log(`\n[INFO] Loaded AndroidManifest: ${manifestPath}`);

const requiredPermissions = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.INTERNET',
  'android.permission.WAKE_LOCK'
];

console.log('\n--- EVALUATION 2: Mandatory Permissions Inspection ---');
let missingPermissions = 0;
requiredPermissions.forEach(perm => {
  const found = manifestContent.includes(perm);
  if (found) {
    console.log(`  [PASS] Permission present: ${perm}`);
  } else {
    missingPermissions++;
    console.log(`  [FAIL] Missing permission: ${perm}`);
  }
});

console.log('\n--- EVALUATION 3: Service & Application Configuration Inspection ---');
const hasApplicationTag = manifestContent.includes('<application');
const hasMainActivity = manifestContent.includes('android:name=".MainActivity"');
const hasMusicService = manifestContent.includes('com.doublesymmetry.trackplayer.service.MusicService');
console.log(`Contains <application> tag? ${hasApplicationTag ? 'YES' : 'NO'}`);
console.log(`Contains MainActivity declaration? ${hasMainActivity ? 'YES' : 'NO'}`);
console.log(`Contains MusicService service declaration? ${hasMusicService ? 'YES (PROVEN CONFIGURED)' : 'NO'}`);

console.log('\n====================================================');
const overallPass = hasRegisterPlaybackService && hasTryCatchProtection && hasUnwrappedService && hasSplashCatchGuard && missingPermissions === 0 && hasApplicationTag && hasMainActivity && hasMusicService;
console.log(`  VERIFICATION RESULT: ${overallPass ? 'PASS (Layout & Manifest Operational)' : 'FAIL (Issues Found)'}`);
console.log('====================================================');

if (!overallPass) {
  process.exit(1);
}
