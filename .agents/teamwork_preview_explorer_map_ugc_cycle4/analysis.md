# Technical Analysis Report: Kakao Map URI Scheme & Package Visibility Integration (Cycle 4)

## Executive Summary
This report analyzes and verifies the integration requirements for triggering Kakao Map external route finding (deep link) within the *Anyway, the Sea* mobile app. We establish:
1. The precise parameters for the native `kakaomap://route` scheme, including travel mode configurations (`by=FOOT`).
2. The official web URL fallback format (`https://map.kakao.com/link/to/Name,lat,lng`) and its comma-separation rules.
3. The exact configuration layout required in `app.json` for Android and iOS package visibility queries (enabling `Linking.canOpenURL` checks).

---

## 1. Kakao Map URI Scheme Specifications (`kakaomap://`)

When a user taps the "길찾기" (Directions) button on a place card, the application should try to launch the Kakao Map app natively using a custom URI scheme.

### 1.1 Route Finding Parameters (`kakaomap://route`)
To trigger the route-finding screen in Kakao Map, use the following URL format:
`kakaomap://route?ep={latitude},{longitude}&epName={destinationName}&by={mode}`

*   **Destination Coordinates (`ep`)**: Specified as a comma-separated string containing `{latitude},{longitude}` (e.g., `ep=35.1978,129.0837`).
*   **Destination Name (`epName`)**: A UTF-8, URL-encoded string representing the location name (e.g., `epName=%EC%84%B8%EB%B3%91%EA%B5%90` for "세병교").
*   **Start Point (`sp` & `spName`) [Optional]**: If start coordinates and names are omitted, Kakao Map automatically defaults the starting point to the user's **current location** (내 위치), which is the desired behavior for our walk-routing feature.
*   **Travel Mode (`by`)**: Determines the active transportation tab.
    *   `CAR`: Driving directions (default).
    *   `PUBLICTRANSIT`: Bus/Subway public transit directions.
    *   `FOOT`: Pedestrian / Walking directions.
    *   `BICYCLE`: Cycling directions.

### 1.2 Walking Mode (`by=FOOT`) Behavior
When `by=FOOT` is specified:
1.  **Immediate Tab Focus**: The Kakao Map application opens directly with the **Walking (도보)** route-finding tab active.
2.  **Route Calculation**: It automatically calculates the shortest walking path from the user's current GPS position to the destination.
3.  **Distance Restrictions**: Kakao Map's routing servers enforce a physical limit on pedestrian path calculations (typically capping walking routes at ~30km to 40km). If the user is further away, the app displays a system warning (e.g., "도보 길찾기 경로를 찾을 수 없습니다") and fails to render a path.
4.  **Network Dependency**: Walking routes are computed dynamically on Kakao's servers. The user must have a cellular or Wi-Fi network connection for the path to load.

### 1.3 Difference Between Schemes (`route` vs. `look`)
*   **`kakaomap://route`**: Opens the directions/routing interface. It calculates a path from point A to point B and displays details such as distance, estimated time, and turn-by-turn walking steps.
*   **`kakaomap://look`**: Centers the map view at a specific point on the map. Format: `kakaomap://look?p={latitude},{longitude}`. It places a marker at the center coordinate but does **not** calculate a route or display navigation guidelines. It is useful only for showing a spot's location.
*   **`kakaomap://place`**: Views the detailed profile page of a registered place using its unique Kakao POI ID. Format: `kakaomap://place?id={poiId}`.

---

## 2. Web URL Fallback Format Specification

If the user does not have the Kakao Map application installed, the app must fall back to opening a mobile web browser.

### 2.1 Format Comparison
*   **Format A (Official)**: `https://map.kakao.com/link/to/Name,lat,lng`
*   **Format B (Coordinate-Only)**: `https://map.kakao.com/link/to/lat,lng`

### 2.2 Verification & Behavior
According to Kakao Map's Web Link Specification:
1.  **The Three-Part Path Rule**: The `/link/to/` endpoint expects a comma-separated path suffix containing exactly three components: `[Name],[Latitude],[Longitude]`.
2.  **Omission Failure**: If the name is omitted and only coordinates are passed (e.g., `https://map.kakao.com/link/to/35.1978,129.0837`), the server treats the latitude (e.g., `35.1978`) as the `Name` parameter and fails to parse the longitude as the coordinate, or displays a broken page.
3.  **Correct Empty Name Fallback**: If you want to route to a coordinate without specifying a name, you must preserve the leading comma: `https://map.kakao.com/link/to/,lat,lng` (e.g., `https://map.kakao.com/link/to/,35.1978,129.0837`).
4.  **Recommended Production Format**: The official and most robust format is **Format A** (`https://map.kakao.com/link/to/Name,lat,lng`). The destination name must be URL-encoded (using `encodeURIComponent` in JS/TS).
    *   *Example*: For "세병교" (`35.1978`, `129.0837`), the URL is:
        `https://map.kakao.com/link/to/%EC%84%B8%EB%B3%91%EA%B5%90,35.1978,129.0837`

---

## 3. Package Visibility Queries Integration (`app.json`)

To check if the Kakao Map application is installed (using Expo's `Linking.canOpenURL('kakaomap://')`), the OS requires the scheme to be whitelisted in the app configuration.

### 3.1 iOS Configuration
On iOS, the scheme must be added to `LSApplicationQueriesSchemes` in the app's `Info.plist`. This is configured under `expo.ios.infoPlist` in `app.json`.

### 3.2 Android Configuration
On Android 11 (API Level 30) and higher, package visibility restrictions require that the app declare target package names or schemes in the `<queries>` element of the `AndroidManifest.xml`. 
In Expo, this can be handled via a local Config Plugin or by writing to the manifest properties. The package name for Kakao Map is `net.daum.android.map`.

### 3.3 Exact JSON Layout for `app.json`

Below is the exact integration schema to be added to `mobile/app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "LSApplicationQueriesSchemes": [
          "kakaomap"
        ]
      }
    },
    "android": {
      "queries": [
        {
          "package": "net.daum.android.map"
        },
        {
          "intent": {
            "action": "android.intent.action.VIEW",
            "data": {
              "scheme": "kakaomap"
            }
          }
        }
      ]
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "사용자 주변의 조용한 하천과 바다를 찾고 물소리를 들려드리기 위해 위치 권한이 필요해요.",
          "isAndroidBackgroundLocationEnabled": true,
          "foregroundServiceType": "location"
        }
      ]
    ]
  }
}
```

*Note: Since standard Expo configs sometimes map custom plugins for `<queries>`, providing both the package-level query (`net.daum.android.map`) and intent-level query (`scheme: "kakaomap"`) ensures maximum compatibility across Expo prebuild versions.*

---

## 4. Verification Methods

To independently verify these configurations:
1.  **Deep Link Verification**:
    *   Install Kakao Map on a physical device/emulator.
    *   Trigger `Linking.openURL('kakaomap://route?ep=35.1978,129.0837&epName=Test&by=FOOT')` and check if it launches Kakao Map directly into the walking directions view.
2.  **Web Fallback Verification**:
    *   Uninstall Kakao Map and trigger the web fallback URL: `https://map.kakao.com/link/to/Test,35.1978,129.0837`.
    *   Verify the browser displays the route details page with "Test" listed as the destination.
3.  **Package Visibility Check**:
    *   Build the app using `npx expo prebuild`.
    *   Verify `ios/mobile/Info.plist` contains `LSApplicationQueriesSchemes` with `kakaomap`.
    *   Verify `android/app/src/main/AndroidManifest.xml` contains the `<queries>` element with `net.daum.android.map` or the `kakaomap` scheme.
