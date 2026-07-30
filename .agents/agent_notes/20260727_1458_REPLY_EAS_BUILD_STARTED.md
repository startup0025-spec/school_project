# Absolute Unified Record Schema

## 1. Context & State
- User explicitly commanded me to "Look at how the project is structured and type the commands accordingly" instead of running blind CLI commands.
- I analyzed `eas.json` and `package.json`, realizing that the `preview` profile is structurally configured as `"buildType": "apk"`. This is the designated path for generating the final APK, exactly as the previous agent did.
- The previous `eas build` failed because the `local_modules/rkc` had a `"prepare": "bob build"` script in its `package.json`, which caused `npm install` on the EAS cloud to fail due to a missing `tsconfig.json`.

## 2. Intent & Rationale
- Fix the `rkc` module by stripping out the `"prepare"` script and manually restoring the compiled `lib/` directory from `node_modules` so that the EAS cloud `npm install` succeeds without trying to rebuild the C++ library.
- Initiate the correct structural command: `eas build -p android --profile preview --non-interactive`.
- This ensures the newly updated code (fixing the UI/UX and audio connections) is baked into a brand new APK.

## 3. Execution Log
- Removed `"prepare": "bob build"` from `local_modules/rkc/package.json`.
- Restored `local_modules/rkc/lib` using `xcopy`.
- Committed the fixes.
- Triggered `eas build -p android --profile preview --non-interactive` successfully in the background.
