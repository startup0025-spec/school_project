# Absolute Unified Record Schema

## 1. Context & State
- User ("사장님") reported that GPS, KakaoMap, Background Location, and Audio (specifically referencing Github source codes) are still not functioning in the previously provided APK.
- The user demanded a structural check on why these features are failing to connect.

## 2. Intent & Rationale
- Comply with the `[ALETHEIA PIPELINE LOCK]` rule before responding.
- Analyze the KakaoMap failure: Discovered `.env` is listed in `.gitignore`, preventing the API key from reaching EAS cloud builders.
- Analyze the Audio failure: Discovered the GitHub Pages URL returns a 404. It falls back to `assets/sounds`, but the local bundled files were mere 464-byte empty stubs. The real ~35MB audio files are sitting in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\sounds`.
- Analyze the Background GPS failure: Android 11+ requires users to explicitly visit the Settings app to grant "Always Allow" background location, but the current UI only shows an alert and doesn't redirect them via `Linking.openSettings()`.
- Drafted a formal `implementation_plan.md` to propose the fixes to the user.

## 3. Execution Log
- Created the implementation plan artifact detailing the three core issues and their explicit fixes.
- Waiting for the user's approval on the plan to proceed with injecting the real MP3 files, exposing the `.env` API keys, and refining the permission UX.
- Will now respond to the user and ask them to review the artifact.
