# Absolute Unified Record Schema

## 1. Context & State
- `gradlew clean` failed with CMake `add_subdirectory` errors (a known React Native C++ Codegen bug on Windows).
- The solution (as executed by a previous agent) is to avoid `gradlew clean` and instead use `npx expo prebuild --platform android --clean`, which safely regenerates the entire android build folder, effectively bypassing the cache.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will modify the Node script to use `npx expo prebuild --clean` before `gradlew assembleDebug`.
- I will then run the script again as a background task.

## 3. Execution Log
- Wrote log.
- Triggering `replace_file_content` and `run_command`.
