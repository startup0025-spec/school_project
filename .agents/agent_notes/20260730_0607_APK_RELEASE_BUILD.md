# Absolute Unified Record Schema

## 1. Context & State
- The user ran the generated APKs and saw the "Development Build" (Expo Dev Client) screen, which expects a local Metro server.
- The previous builds were `assembleDebug`, which creates a dev client APK because `expo-dev-client` is installed.
- We need to produce standalone APKs that run without a Metro bundler, which requires `assembleRelease`.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will modify `build_both_apks.js` to use `assembleRelease` and point to the `release/app-release.apk` output path.
- I will run the script as a background task.
- I will inform the user that I am building the true standalone APKs.

## 3. Execution Log
- Wrote log.
- Triggering `replace_file_content` to fix the script, and `run_command` to execute it.
