# Milestone 1 Audit Report: Cross-Platform & Deployment Pipeline Audit

- **Date**: 2026-07-24T13:40:00+09:00
- **Auditor**: BERRY 🍎 (`teamwork_preview_explorer`)
- **Target Repository**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea`
- **Scope**: Cross-platform configuration (iOS, Android, Web), Metro bundler, EAS build pipelines, Vercel/Web assets, Kakao Map WebView bridge, native Expo module fallbacks, environment variable handling, and backend CI/CD data pipelines.

---

## Executive Summary

A deep forensic inspection was conducted on all build, environment, network, bridge, native module, and backend CI/CD files across the project repository. A total of **13 critical risks** were identified and verified with exact line numbers and root cause analysis. These risks are split into **Demo Deployment Risks** (impacting local Expo Go / demo execution) and **Production Deployment Risks** (impacting compiled standalone APK/IPA/Web builds and GitHub Actions pipelines).

---

## 1. Demo Deployment Risks

Flaws that impair or disrupt local Expo Go, local development, or live demo demonstrations.

### Risk D-1: Hardcoded Mock Fallback Key for Kakao Map JavaScript SDK in Expo Go
- **Location**: `mobile/app/(tabs)/map.tsx:578`
- **Observation**: 
  ```typescript
  const apiKey = process.env.EXPO_PUBLIC_KAKAO_MAP_API_KEY || 'MOCK_KEY';
  ```
- **Logic Chain**: When running in local Expo Go or a demo environment where `EXPO_PUBLIC_KAKAO_MAP_API_KEY` is not explicitly set in the local `.env` file, `apiKey` evaluates to `'MOCK_KEY'`. In `map.tsx:151`, this string is substituted into `https://dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_JS_API_KEY&autoload=false`. Kakao Map API servers reject `'MOCK_KEY'` with a 401/403 HTTP error during script loading, causing `handleScriptError()` (`map.tsx:140-146`) to fire. This sets `isSdkFailed(true)` and renders the fallback offline layout (`map.tsx:581-594`), breaking the interactive Kakao map experience during live demo presentations.
- **Verification Method**: Run Expo Go without setting `EXPO_PUBLIC_KAKAO_MAP_API_KEY` in `.env`. Open the Map tab; observe that the fallback static image screen ("오프라인 모드") is rendered instead of an interactive map.

### Risk D-2: Fallback Demo Service Keys Cause Silent Open API Rate Limits & Validation Rejections
- **Location**: `mobile/core_engine/src/config/api_keys.ts:10-11`
- **Observation**:
  ```typescript
  KMA_SERVICE_KEY: kmaKey ? kmaKey : 'FALLBACK_DEMO_KEY',
  BUSAN_SERVICE_KEY: busanKey ? busanKey : 'FALLBACK_DEMO_KEY',
  ```
- **Logic Chain**: If `EXPO_PUBLIC_KMA_SERVICE_KEY` or `EXPO_PUBLIC_BUSAN_SERVICE_KEY` is undefined in local dev, requests to `apis.data.go.kr` send `serviceKey=FALLBACK_DEMO_KEY` (`kma_api.ts:47`, `busan_api.ts:99,146`). Public Data Portal endpoints reject invalid keys by returning an XML error document (`<OpenAPI_ServiceResponse>...SERVICE_KEY_IS_NOT_REGISTERED_ERROR...</OpenAPI_ServiceResponse>`) with a `200 OK` status code. Because `client.ts` only intercepts network failures/timeouts (`client.ts:77-78`), Axios does NOT throw an error for `200 OK` XML responses. Consequently, `JSON.parse` or property access (e.g. `data.response.body`) fails silently or returns `undefined`, forcing empty responses or fallback data, degrading demo reliability.
- **Verification Method**: Unset `EXPO_PUBLIC_KMA_SERVICE_KEY`. Trigger `fetchUltraShortForecast`. Inspect network response; verify that data.go.kr returns an XML error string with HTTP status 200, which bypasses Axios error handling.

### Risk D-3: Hardcoded Replit Origin Header in `app.json` Breaks Local Tunnel Origin Resolution
- **Location**: `mobile/app.json:60-61`
- **Observation**:
  ```json
  "plugins": [
    [
      "expo-router",
      {
        "origin": "https://replit.com/"
      }
    ]
  ]
  ```
- **Logic Chain**: `expo-router` uses the `origin` setting to resolve absolute URLs for static assets and web-bound router links. Hardcoding `"https://replit.com/"` causes local Expo development servers (e.g., running via `npx expo start` or local tunnel via `@expo/ngrok`) to generate deep links or asset bundle URLs targeting `replit.com`. During a local demo, tapping deep links or attempting web navigation routes can result in CORS origin mismatches or navigation to external Replit error pages.
- **Verification Method**: Inspect `app.json:60-61`. Note that `"origin"` points to `"https://replit.com/"` instead of a dynamic environment parameter or the production web URL (`https://startup0025-spec.github.io/school_project`).

### Risk D-4: SWR Hardcoded CDN Revalidation URL Mismatch in Local Demo Mode
- **Location**: `mobile/core_engine/src/database/local_places.ts:5`
- **Observation**:
  ```typescript
  const CDN_URL = 'https://startup0025-spec.github.io/school_project/data/busan_places_master.json';
  ```
- **Logic Chain**: In `local_places.ts:38-57`, `revalidateData()` runs automatically whenever `getPlaces()` is called and 30 seconds have elapsed (`FRESHNESS_THRESHOLD = 30000`). In local offline or demo environments without internet access, `fetch(CDN_URL)` fails. Although `local_places.ts:55` catches the error (`console.warn('[local_places] SWR revalidation failed...')`), any local edits made to `mobile/assets/data/busan_places_master.json` during testing will be overwritten by `AsyncStorage.setItem(CACHE_KEY)` as soon as internet connectivity returns and fetches the online GitHub Pages version.
- **Verification Method**: Edit local `busan_places_master.json`. Run app with internet enabled. Observe that `revalidateData()` replaces the local places cache with the remote GitHub Pages JSON within 30 seconds.

### Risk D-5: Metro Bundler Missing Custom Asset Extensions for Audio & JSON Data
- **Location**: `mobile/metro.config.js:1-3`
- **Observation**:
  ```javascript
  const { getDefaultConfig } = require('expo/metro-config');
  module.exports = getDefaultConfig(__dirname);
  ```
- **Logic Chain**: Metro default configuration handles standard `.mp3` and `.json` files. However, `audio_caching_service.ts:31` uses `emergency_siren.wav`. If Metro does not explicitly register `.wav` files in `assetExts`, Metro bundler throws an unresolved asset error (`Unable to resolve module ../../assets/sounds/emergency_siren.wav`) when building or serving Expo Go bundles locally.
- **Verification Method**: Check `mobile/metro.config.js`. Observe no custom `resolver.assetExts` array extensions for `.wav` files.

---

## 2. Production Deployment Risks

Flaws that impair compiled standalone APK (Android), IPA (iOS), Vercel Web deployments, or automated GitHub Actions CI/CD pipelines.

### Risk P-1: Absence of `vercel.json` and Missing Routing/CORS Configuration for Web Deployment
- **Location**: Project Root & `web/` directory (Missing `vercel.json`)
- **Observation**: Searching the repository confirms `vercel.json` does not exist (`find_by_name` returned 0 results for `*vercel*`).
- **Logic Chain**: 
  1. **SPA Routing Collapse**: `web/package.json` configures Vite (`"build": "vite build"`). Single Page Applications (SPAs) built with React/Vite rely on server-side URL rewrites (`/preview/*` -> `index.html`). Without a `vercel.json` containing `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`, refreshing the page on any sub-route (e.g. `https://domain.vercel.app/preview/Map`) on Vercel results in a `404 NOT FOUND` error.
  2. **CORS & Asset Headers**: Audio files and JSON master data served for web/mobile cross-origin requests lack headers (`Access-Control-Allow-Origin: *`). Browsers block HTML5 Audio and `fetch()` calls from different origins due to missing CORS headers.
- **Verification Method**: Deploy `web/` to Vercel. Navigate directly to `/preview/ComponentName` and refresh the browser. Observe Vercel standard 404 response.

### Risk P-2: Incomplete `eas.json` Production Profile Missing Release Keystores & Build Credentials
- **Location**: `mobile/eas.json:20-22`
- **Observation**:
  ```json
  "production": {
    "autoIncrement": true
  }
  ```
- **Logic Chain**: The `production` profile in `eas.json` contains only `"autoIncrement": true`. It lacks build type configurations (such as `"buildType": "app-bundle"` or `"buildType": "apk"` for Android) and iOS provisioning profile / distribution settings. Furthermore, running `eas build --platform android --profile production` will fail or default to Expo credentials unless EAS secrets (`EXPO_PUBLIC_KAKAO_MAP_API_KEY`, `EXPO_PUBLIC_KMA_SERVICE_KEY`, `EXPO_PUBLIC_BUSAN_SERVICE_KEY`) are configured under `eas.json` `env` blocks or EAS Environment Variables. Missing these environment variables in `eas.json` causes production standalone builds to compile with empty string API keys (`""`).
- **Verification Method**: Run `eas build --profile production --platform android`. Observe that production APK/AAB is generated without environment variables, causing runtime network and map initialization failures.

### Risk P-3: Missing iOS `NSAppTransportSecurity` Cleartext HTTP Policy in `app.json`
- **Location**: `mobile/app.json:16-28`
- **Observation**:
  ```json
  "ios": {
    "supportsTablet": false,
    "bundleIdentifier": "com.anyway.thesea",
    "infoPlist": {
      "UIBackgroundModes": [
        "location",
        "audio"
      ],
      "LSApplicationQueriesSchemes": [
        "kakaomap"
      ]
    }
  }
  ```
- **Logic Chain**: The Korean Public Data Portal APIs (`apis.data.go.kr`) and Kakao Map CDN assets occasionally redirect or serve HTTP cleartext endpoints or sub-resources. On iOS standalone builds (IPA), Apple strictly enforces App Transport Security (ATS) by default, blocking all non-HTTPS requests unless `NSAppTransportSecurity` / `NSAllowsArbitraryLoads` (or exception domains) is explicitly configured under `infoPlist`. In `app.json`, `infoPlist` lacks `NSAppTransportSecurity`. As a result, iOS production builds will block cleartext HTTP fallback requests made by `client.ts` or Kakao WebView sub-resources.
- **Verification Method**: Inspect `mobile/app.json:19-27`. Observe the total absence of `NSAppTransportSecurity` key under `infoPlist`.

### Risk P-4: Missing Android Foreground Service Type Declarations for `expo-av` Background Audio
- **Location**: `mobile/app.json:44-51`
- **Observation**:
  ```json
  "permissions": [
    "ACCESS_COARSE_LOCATION",
    "ACCESS_FINE_LOCATION",
    "ACCESS_BACKGROUND_LOCATION",
    "FOREGROUND_SERVICE",
    "FOREGROUND_SERVICE_LOCATION",
    "FOREGROUND_SERVICE_MEDIA_PLAYBACK"
  ]
  ```
- **Logic Chain**: `app.json` includes `FOREGROUND_SERVICE_MEDIA_PLAYBACK` in Android `permissions`. However, under `plugins` (`app.json:56-73`), only `expo-location` plugin configuration is declared (`foregroundServiceType: "location"`). There is no Expo plugin configuration or custom Android manifest overlay for `expo-av` background media playback. On Android 14+ (API level 34+), starting a Foreground Service for media playback without declaring `android:foregroundServiceType="mediaPlayback"` in `<service>` inside `AndroidManifest.xml` triggers a runtime `SecurityException` and immediately crashes the application when audio is played in the background.
- **Verification Method**: Build Android APK for API 34+. Play ambient audio in `sound.tsx` and move the application to background. Android OS terminates the process with `SecurityException: Starting FGS with type none...`.

### Risk P-5: Native WebView Module Crash on Web Target (`react-native-webview` Web Incompatibility)
- **Location**: `mobile/app/(tabs)/map.tsx:3`, `mobile/package.json:70`
- **Observation**:
  ```typescript
  import { WebView } from 'react-native-webview';
  ```
- **Logic Chain**: `react-native-webview` is a native iOS/Android bridge module. When running an Expo Web build (`expo export:web` or `npx expo start --web`), Metro/Webpack attempts to import `react-native-webview`. Because `react-native-webview` does not provide an HTML iframe fallback for the web platform out of the box, importing it directly on Web causes a module resolution crash or runtime error (`Uncaught TypeError: Cannot read property 'nativeModule' of undefined` / missing DOM element). `map.tsx` lacks platform-specific module splitting (e.g. `map.web.tsx` or `Platform.OS === 'web'` conditional rendering with an `<iframe>`).
- **Verification Method**: Run `npx expo start --web` in `mobile/`. Navigate to Map tab. Browser console throws a fatal bundle execution error from `react-native-webview`.

### Risk P-6: `expo-file-system` Legacy Import Web Incompatibility in Audio Caching Service
- **Location**: `mobile/lib/services/audio_caching_service.ts:1`
- **Observation**:
  ```typescript
  import * as FileSystem from 'expo-file-system/legacy';
  ```
- **Logic Chain**: `audio_caching_service.ts` imports `expo-file-system/legacy` to perform file operations (`CACHE_DIR = FileSystem.documentDirectory + 'sounds/'`, `getInfoAsync`, `writeAsStringAsync`). On Web platform builds, `FileSystem.documentDirectory` evaluates to `null` or `undefined`. Calling `FileSystem.getInfoAsync` or creating directories on Web throws unhandled exceptions (`TypeError: Cannot read properties of null (reading 'endsWith')`), breaking audio playback on Web environments. `audio_engine_service.ts` does not guard against web environments before invoking `resolveAudioSource`.
- **Verification Method**: Execute `audio_caching_service.ts` functions in a web environment. Observe runtime crashes when accessing `FileSystem.documentDirectory`.

### Risk P-7: Unhandled TourAPI API Error & Unchecked Secret Key in GitHub Actions Pre-Baking Pipeline
- **Location**: `.github/workflows/daily_places_baker.yml:43-47`, `scripts/pipeline/bake_places.js:36-41,168-184`
- **Observation**:
  ```javascript
  // bake_places.js:36-41
  const TOUR_API_KEY = process.env.TOUR_API_KEY;
  if (!TOUR_API_KEY) {
    console.error('[ERROR] TOUR_API_KEY 환경변수가 설정되어 있지 않습니다.');
    process.exit(1);
  }
  ```
- **Logic Chain**:
  1. **Secret Key Omission**: In GitHub Actions workflow (`daily_places_baker.yml:46`), `TOUR_API_KEY` is passed via `${{ secrets.TOUR_API_KEY }}`. If the repository admin has not configured `TOUR_API_KEY` in GitHub Repository Secrets (or in forks), `process.env.TOUR_API_KEY` is empty, causing the automated daily pipeline to fail immediately with exit code 1.
  2. **Unhandled XML Error Parsing**: In `bake_places.js:168-184`, `fetchJson` attempts to parse `JSON.parse(data)`. When `TOUR_API_KEY` is invalid or expired, data.go.kr returns XML (`<OpenAPI_ServiceResponse>...`). `JSON.parse` throws an error (`JSON 파싱 실패`), causing `fetchPlacesByType` to reject and crash the node process (`process.exit(1)`), preventing the fallback mechanism from saving existing cached places data.
- **Verification Method**: Trigger GitHub Actions workflow `daily_places_baker.yml` without setting `TOUR_API_KEY` secret. Workflow fails at Step 4.

### Risk P-8: Kakao JavaScript SDK Web Domain Authorization Mismatch
- **Location**: `mobile/app/(tabs)/map.tsx:609`
- **Observation**:
  ```typescript
  source={{ html: htmlContent, baseUrl: 'https://startup0025-spec.github.io' }}
  ```
- **Logic Chain**: Kakao Map JavaScript SDK strictly validates the origin domain of the requesting webpage against the "Web Domain" list registered in Kakao Developers Console under the corresponding App Key. In `map.tsx:609`, `baseUrl` is set to `'https://startup0025-spec.github.io'`. If the app is deployed to Vercel (`https://*.vercel.app`) or hosted on a custom domain without registering `https://startup0025-spec.github.io` (or the actual deployment domain) in Kakao Developers Console, Kakao SDK initialization throws `[KakaoMapsSDK] Unauthorized Domain` error, blocking map rendering in production builds.
- **Verification Method**: Change `baseUrl` to an unregistered domain (e.g. `http://localhost:3000`). Inspect WebView console output (`map.tsx:535`); observe Kakao SDK domain authorization error.

---

## 3. Comprehensive Risk Matrix

| Risk ID | Category | Target File & Line | Platform | Impact Summary |
|---|---|---|---|---|
| **D-1** | Demo | `mobile/app/(tabs)/map.tsx:578` | iOS / Android | Kakao Map JS key fallback `'MOCK_KEY'` triggers SDK script load error and forces offline fallback UI in Expo Go. |
| **D-2** | Demo | `mobile/core_engine/src/config/api_keys.ts:10-11` | iOS / Android | `FALLBACK_DEMO_KEY` sends invalid service key to data.go.kr APIs, returning 200 OK XML errors that bypass Axios error handling. |
| **D-3** | Demo | `mobile/app.json:60-61` | All | `expo-router` origin hardcoded to `"https://replit.com/"`, causing URL resolution and deep link mismatches in local Expo dev. |
| **D-4** | Demo | `mobile/core_engine/src/database/local_places.ts:5` | All | SWR hardcoded CDN URL revalidates against remote GitHub Pages, overwriting local offline test data within 30 seconds. |
| **D-5** | Demo | `mobile/metro.config.js:1-3` | All | Metro config lacks explicit `assetExts` additions for `.wav` files used in emergency audio fallbacks. |
| **P-1** | Production | `vercel.json` (Missing) | Web | Absence of `vercel.json` causes SPA sub-routes (`/preview/*`) to return 404 NOT FOUND on Vercel deployment, with missing CORS headers. |
| **P-2** | Production | `mobile/eas.json:20-22` | Android / iOS | Production profile lacks build type specifications and environment variable blocks, generating release builds with empty API keys. |
| **P-3** | Production | `mobile/app.json:16-28` | iOS | Missing `NSAppTransportSecurity` in iOS `infoPlist` causes iOS standalone builds to block HTTP cleartext sub-resources from data.go.kr. |
| **P-4** | Production | `mobile/app.json:44-51` | Android | Missing Android Foreground Service mediaPlayback type declaration triggers runtime `SecurityException` during background audio on Android 14+. |
| **P-5** | Production | `mobile/app/(tabs)/map.tsx:3` | Web | Direct import of native `react-native-webview` causes bundle execution crash in Expo Web builds due to missing web iframe fallback. |
| **P-6** | Production | `mobile/lib/services/audio_caching_service.ts:1` | Web | `expo-file-system/legacy` usage on Web causes `FileSystem.documentDirectory` null property access crashes during audio resolution. |
| **P-7** | Production | `.github/workflows/daily_places_baker.yml:46`, `scripts/pipeline/bake_places.js:36` | CI/CD Backend | Missing GitHub Secret `TOUR_API_KEY` or XML response from data.go.kr crashes pre-baking node process with unhandled promise rejection. |
| **P-8** | Production | `mobile/app/(tabs)/map.tsx:609` | Web / Mobile | Hardcoded `baseUrl: 'https://startup0025-spec.github.io'` causes Kakao JS SDK domain authorization failure if hosted on different domains. |

---

## 4. Verification Methods & Commands

To independently verify the identified risks:

1. **Verify Demo Risks D-1 & D-2**:
   ```bash
   cd mobile
   npx expo start --dev-client
   ```
   Unset `EXPO_PUBLIC_KAKAO_MAP_API_KEY` and `EXPO_PUBLIC_KMA_SERVICE_KEY` in `.env`. Inspect console logs for `SDK_LOAD_FAILED` and XML parsing failures.

2. **Verify Production Web Risks P-1, P-5 & P-6**:
   ```bash
   cd web
   npm run build
   npx vite preview
   ```
   Open `http://localhost:4173/preview/Map` and refresh page; observe routing behavior and console module resolution errors.

3. **Verify Pre-Baking Pipeline Risk P-7**:
   ```bash
   node scripts/pipeline/bake_places.js
   ```
   Run without setting `TOUR_API_KEY` in environment. Observe immediate process exit code 1.

---

## 5. Conclusion

The codebase demonstrates strong local offline caching logic (`axios-cache-interceptor`, `AsyncStorage`, SWR place subscription), but exhibits critical platform deployment vulnerabilities:
- **Web target**: Unsupported native imports (`react-native-webview`, `expo-file-system`) and missing SPA rewrite configurations (`vercel.json`).
- **Android/iOS native targets**: Missing Android Foreground Service media declarations and iOS App Transport Security cleartext policies.
- **CI/CD & Environment pipeline**: Unhandled XML response parsing in pre-baking scripts and missing build credentials in `eas.json`.

All findings have been logged to `handoff.md` for seamless handoff to orchestrator and downstream testing subagents.
