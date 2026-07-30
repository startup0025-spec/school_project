# Absolute Unified Record Schema

## 1. Context & State
- The Release APK crashes on launch (does not open).
- I need to find the exact cause of the crash.
- I found a local Android emulator (`Pixel_7`) that I can use to reproduce the crash.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will write a NodeJS script that starts the emulator in headless mode, installs the `Prod` APK, launches the app, and dumps the crash logs via `adb logcat`.
- This is the most deterministic way to find the root cause without guessing.

## 3. Execution Log
- Wrote log.
- Triggering `write_to_file` for the diagnostic script.
