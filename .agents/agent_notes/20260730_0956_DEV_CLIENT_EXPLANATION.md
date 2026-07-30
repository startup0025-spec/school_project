# Absolute Unified Record Schema

## 1. Context & State
- User uploaded a screenshot of the `expo-dev-client` launcher UI on their phone.
- The user is confused why the older APK (July 28) shows this screen and thinks it might be an Expo-level error.
- The older APK (223MB) was a "Development Build" that included `expo-dev-client`.
- Development builds do not bundle the JS code and require a local Metro bundler (`npx expo start`) running on the same network to fetch the JS bundle. Since the bundler isn't running, it defaults to the launcher UI.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]` and Rule 8.
- Explain to the user that this is a completely normal behavior for a Development Build and exactly why we stripped `expo-dev-client` out of the final 143MB Production APK.
- Reassure the user that the new APK being built right now will skip this screen and boot directly into the app natively.

## 3. Execution Log
- Wrote log.
- Replying to Master with the explanation.
