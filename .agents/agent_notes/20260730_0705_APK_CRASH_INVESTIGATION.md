# Absolute Unified Record Schema

## 1. Context & State
- User reported that the Release APK does not open (likely crashing immediately on launch).
- This is a common issue when moving from a Debug/Dev build to a Release build in React Native (usually related to Proguard/Minification, Reanimated, or Hermes).

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will investigate `gradle.properties` to see if minification or shrinking is enabled.
- I will check if `adb` is available to test the crash locally.
- I will analyze the dependencies for known Release-crashing libraries (like `react-native-reanimated`).

## 3. Execution Log
- Wrote log.
- Triggering file views and `adb devices` check.
