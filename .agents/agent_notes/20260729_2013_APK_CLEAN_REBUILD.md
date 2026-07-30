# Absolute Unified Record Schema

## 1. Context & State
- User complained that the APK files were not updated (timestamps are from July 28th).
- Investigation showed that `gradlew assembleDebug` was cached (`UP-TO-DATE`) because Gradle didn't detect changes to the `assets/data/` JSON file.
- The previous builds were Debug builds (228MB). I need to run `gradlew clean assembleDebug` to force a complete rebuild and re-bundling of the assets.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will modify the script to run `clean` first.
- I will run the script and notify the user to wait another 3 minutes.

## 3. Execution Log
- Wrote log.
- Triggering `replace_file_content` to update the script and `run_command` to execute it.
