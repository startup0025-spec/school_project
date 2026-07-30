# Absolute Unified Record Schema

## 1. Context & State
- The 5th EAS build attempt failed due to an EAS Free Plan monthly limit being exhausted ("This account has used its Android builds from the Free plan this month").
- Cloud builds are now impossible for this user's account until next month.
- The local Gradle build works perfectly (`gradlew assembleDebug`).

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will bypass the cloud entirely and build the 2 APKs LOCALLY using `gradlew assembleDebug` or `assembleRelease`.
- I need to check `eas.json` to understand how the "preview-demo" and "preview-prod" environments are configured so I can replicate them locally before compiling.
- After local builds, I will copy the APKs to `C:\Users\user\Desktop\보내는 용도` to fulfill the user's request.

## 3. Execution Log
- Wrote log.
- Triggering `eas.json` read.
