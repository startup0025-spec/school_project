# Absolute Unified Record Schema

## 1. Context & State
- The EAS build failed again during `Run gradlew`.
- Web research indicates `react-native-track-player` often fails on Expo due to Kotlin compilation errors (`compileDebugKotlin FAILED`) when the Expo SDK uses a newer Kotlin version that enforces strict null-safety.
- My previous custom config plugin for ExoPlayer might have also introduced Groovy syntax issues.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will remove the risky custom config plugin.
- I will install `expo-build-properties` and explicitly set `kotlinVersion` to `"1.8.0"` (which is exactly what `react-native-track-player` 4.1.2 expects) to bypass the Kotlin compiler null-safety errors.

## 3. Execution Log
- Wrote log.
- Triggering `npm install expo-build-properties`.
- Updating `app.json`.
