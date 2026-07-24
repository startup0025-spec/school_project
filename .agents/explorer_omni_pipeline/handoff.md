# Handoff Report: Milestone 1 Cross-Platform & Deployment Pipeline Audit

## 1. Observation
Direct forensic inspection was performed across all project build configurations, platform implementations, bridge code, environment handlers, and backend CI/CD pipelines:
- `mobile/app.json` (lines 16-28, 44-51, 60-61): Observed hardcoded Replit origin, missing `NSAppTransportSecurity` in iOS `infoPlist`, and missing `android:foregroundServiceType="mediaPlayback"` plugin config.
- `mobile/eas.json` (lines 20-22): Observed empty production build profile lacking build type and environment variable declarations.
- Project root / `web/`: Verified absence of `vercel.json` for SPA URL rewrites and CORS headers.
- `mobile/app/(tabs)/map.tsx` (lines 3, 578, 609): Observed native `react-native-webview` import (crashes web builds), hardcoded `'MOCK_KEY'` fallback for Kakao Map JS key, and hardcoded `baseUrl` domain.
- `mobile/core_engine/src/config/api_keys.ts` (lines 10-11): Observed `'FALLBACK_DEMO_KEY'` default values causing data.go.kr 200 OK XML error responses.
- `mobile/lib/services/audio_caching_service.ts` (line 1): Observed `expo-file-system/legacy` import causing `documentDirectory` null pointer crashes on Web target.
- `.github/workflows/daily_places_baker.yml` (line 46) & `scripts/pipeline/bake_places.js` (lines 36-41, 168-184): Observed strict process exit on missing `TOUR_API_KEY` secret and unhandled XML error parsing during pre-baking.

## 2. Logic Chain
1. In Expo Go / local demo mode, missing environment variables fall back to string literals (`'MOCK_KEY'`, `'FALLBACK_DEMO_KEY'`). Kakao SDK script loading fails, triggering offline mode UI. Public Data Portal returns 200 OK XML responses that bypass Axios error handlers, leading to unhandled JSON parsing or property access errors.
2. In production builds:
   - **Web Target**: Missing `vercel.json` causes 404 errors on direct sub-route refreshes. Native imports (`react-native-webview`, `expo-file-system/legacy`) cause JavaScript runtime bundle crashes.
   - **iOS Target**: Missing `NSAppTransportSecurity` blocks cleartext HTTP sub-resources from data.go.kr APIs.
   - **Android Target**: Missing mediaPlayback foreground service type causes Android 14+ OS process termination when playing audio in background.
   - **CI/CD Pipeline**: Missing GitHub secrets or API XML error responses cause `bake_places.js` to crash the GitHub Actions pipeline without recovering cached data.

## 3. Caveats
- No code modifications were made to `mobile/`, `web/`, or `scripts/` source files, adhering strictly to the read-only investigation constraint.
- Live EAS cloud builds and Vercel deployments were not triggered during this audit step; findings are based on static analysis and configuration evaluation.

## 4. Conclusion
Milestone 1 audit is 100% complete. A total of 13 verified risks (5 Demo Deployment Risks, 8 Production Deployment Risks) have been documented with exact file paths and line numbers. The full structured report is stored at `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\explorer_omni_pipeline\M1_omni_pipeline_audit.md`.

## 5. Verification Method
- Inspect report at `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\explorer_omni_pipeline\M1_omni_pipeline_audit.md`.
- Verify file existence and path references via `view_file`.
