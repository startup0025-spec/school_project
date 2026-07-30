# Absolute Unified Record Schema

## 1. Context & State
- User reported that the freshly built `Anyway_the_Sea_Prod.apk` (with the `postinstall` patch) STILL crashes immediately on launch.
- User is questioning the root causes of crashes ("튕기는 데엔 이유가 보통 뭐가 있냐").
- I need to stop guessing and immediately use my local Android Emulator to extract the new crash log for this supposedly "patched" APK.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will install the new APK on the existing Pixel 7 emulator and dump the logcat.
- If it's the exact same TrackPlayer error, it means my Kotlin patch syntax didn't actually change the Java return type signature. If it's a different error (e.g., Reanimated, Kakao Map), I need to pivot.

## 3. Execution Log
- Wrote log.
- Initiating ADB install and logcat extraction for the new APK on the local emulator.
