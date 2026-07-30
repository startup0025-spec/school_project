# Absolute Unified Record Schema

## 1. Context & State
- Local Gradle build revealed that Expo SDK 54 explicitly dropped support for Kotlin < 2.0.0 because of the KSP plugin requirements.
- The `kotlinVersion` downgrade to 1.8.0 caused the 3rd EAS build (and local build) to fail outright.
- This means the first two EAS builds failed because of `react-native-track-player` Kotlin 2.0+ null-safety errors (as originally theorized from the web search).

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I have removed the `expo-build-properties` downgrade.
- I will run the local Gradle build again using the default Kotlin 2.0+ to catch the exact `compileDebugKotlin` error in `react-native-track-player`.
- Once I see the exact line number, I will use `patch-package` to fix the library's source code and finally succeed with the EAS build.

## 3. Execution Log
- Reverted `app.json`.
- Wrote log.
- Triggering local Gradle build to catch the Kotlin error.
