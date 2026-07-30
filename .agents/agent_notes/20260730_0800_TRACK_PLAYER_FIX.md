# Absolute Unified Record Schema

## 1. Context & State
- The emulator crash test pinpointed the exact crash cause: `com.facebook.react.internal.turbomodule.core.TurboModuleInteropUtils$ParsingException: Unable to parse @ReactMethod annotations from native module: TrackPlayerModule.`
- `react-native-track-player` (v4.1.2) is incompatible with React Native's New Architecture (`newArchEnabled=true`), causing a fatal exception during module initialization in Release mode.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will disable the New Architecture (`newArchEnabled: false`) in `app.json` to fallback to the stable Paper architecture.
- I will trigger `build_both_apks.js` to rebuild the APKs.

## 3. Execution Log
- Wrote log.
- Triggering `replace_file_content` on `app.json` and then running the build script.
