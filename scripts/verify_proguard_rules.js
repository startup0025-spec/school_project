const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log(' VERIFICATION SCRIPT 2: PROGUARD / R8 RULES CHECK   ');
console.log('====================================================\n');

const proguardPath = path.resolve(__dirname, '../mobile/android/app/proguard-rules.pro');

if (!fs.existsSync(proguardPath)) {
  console.error(`[ERROR] Cannot find proguard-rules.pro at ${proguardPath}`);
  process.exit(1);
}

const proguardContent = fs.readFileSync(proguardPath, 'utf8');

console.log(`[INFO] Loaded ProGuard configuration: ${proguardPath}`);
console.log(`[INFO] File size: ${proguardContent.length} bytes\n`);

const requiredChecks = [
  {
    category: 'React Native TrackPlayer (MusicService & Player)',
    requirements: [
      { name: 'MusicService Keep Rule', pattern: /com\.doublesymmetry\.trackplayer\.service\.MusicService/ },
      { name: 'TrackPlayer Package Keep Rule', pattern: /com\.doublesymmetry\.trackplayer\.\*\*/ },
      { name: 'KotlinAudio Package Keep Rule', pattern: /com\.github\.doublesymmetry\.kotlinaudio\.\*\*/ },
      { name: 'ExoPlayer2 / Media3 Keep Rule', pattern: /androidx\.media3\.\*\*|com\.google\.android\.exoplayer2\.\*\*/ }
    ]
  },
  {
    category: 'React Native WebView & KakaoMap JS Bridge',
    requirements: [
      { name: 'JavascriptInterface Annotation Keep Rule', pattern: /@android\.webkit\.JavascriptInterface/ },
      { name: 'RNCWebView Package Keep Rule', pattern: /com\.reactnativecommunity\.webview\.\*\*/ }
    ]
  },
  {
    category: 'Reanimated / Worklets & JNI @DoNotStrip',
    requirements: [
      { name: 'Reanimated Package Keep Rule', pattern: /com\.swmansion\.reanimated\.\*\*/ },
      { name: 'Worklets Package Keep Rule', pattern: /com\.swmansion\.worklets\.\*\*/ },
      { name: 'JNI Native Methods Keep Rule', pattern: /native\s+<methods>/ },
      { name: 'DoNotStrip Annotations Rule', pattern: /DoNotStrip/ }
    ]
  },
  {
    category: 'Expo Modules & Autolinking Entry Points',
    requirements: [
      { name: 'Expo Modules Base Rule', pattern: /expo\.modules\./ },
      { name: 'ExpoModulesPackage Entrypoint', pattern: /expo\.modules\.ExpoModulesPackage/ },
      { name: 'Autolinked Packages Rules', pattern: /com\.reactnativekeyboardcontroller|com\.swmansion\.gesturehandler|com\.th3rdwave\.safeareacontext|com\.swmansion\.rnscreens|com\.horcrux\.svg|com\.reactnativecommunity\.asyncstorage/ }
    ]
  }
];

let totalChecks = 0;
let passedChecks = 0;
let missingChecks = 0;

requiredChecks.forEach((cat, idx) => {
  console.log(`--- Category ${idx + 1}: ${cat.category} ---`);
  cat.requirements.forEach(req => {
    totalChecks++;
    const found = req.pattern.test(proguardContent);
    if (found) {
      passedChecks++;
      console.log(`  [PASS] ${req.name}`);
    } else {
      missingChecks++;
      console.log(`  [FAIL - MISSING] ${req.name}`);
    }
  });
  console.log('');
});

console.log('====================================================');
console.log(`  SUMMARY: ${passedChecks} / ${totalChecks} rules present.`);
if (missingChecks > 0) {
  console.log(`  STATUS: FAIL (${missingChecks} critical keep rules missing)`);
  console.log('  IMPACT: Release APK (DEMO & PROD) will experience runtime crashes.');
} else {
  console.log('  STATUS: PASS (All required ProGuard keep rules present)');
  console.log('  IMPACT: Release APK is fully protected against R8 obfuscation crashes.');
}
console.log('====================================================');
