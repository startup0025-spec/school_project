# Handoff Report: Kakao Map URI Scheme & Integration Verification (Cycle 4)

## 1. Observation
- **`mobile/app.json`**: Current configuration (lines 16-35) defines iOS and Android platforms:
  ```json
  "ios": {
    "supportsTablet": false,
    "bundleIdentifier": "com.anyway.thesea",
    "infoPlist": {
      "UIBackgroundModes": [
        "location",
        "audio"
      ]
    }
  },
  "android": {
    "package": "com.anyway.thesea",
    "permissions": [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION"
    ]
  }
  ```
  Neither iOS nor Android lists package visibility queries or intent declarations for external map routing.
- **`agent_notes/20260716_1247_EXTERNAL_MAP_ROUTING.md`**: Outlines the decision to use external map routing (Deep Link):
  ```markdown
  2. 장소 카드에 `[길찾기]` 버튼을 만들고, 누르면 `Linking.openURL` 등을 이용해 카카오맵 앱이나 기기 기본 지도 앱으로 목적지 위경도 좌표를 쏴서 외부 앱이 열리게 만듦.
  ```
- **Kakao Map SDK Specifications**:
  - Route finding URI scheme: `kakaomap://route?ep={lat},{lng}&epName={name}&by=FOOT`
  - Look scheme: `kakaomap://look?p={lat},{lng}`
  - Official web fallback: `https://map.kakao.com/link/to/{Name},{lat},{lng}` (comma-separated 3-part suffix).

---

## 2. Logic Chain
1. To implement the external map routing via `Linking.canOpenURL` and `Linking.openURL` in React Native, the application needs permission to query the availability of the `kakaomap` scheme.
2. In iOS, this requires declaring `LSApplicationQueriesSchemes` containing `kakaomap` in the application's `Info.plist`, which maps to `ios.infoPlist` in Expo's `app.json`.
3. In Android 11+ (API Level 30+), package visibility restrictions prevent `Linking.canOpenURL` from working unless the package name `net.daum.android.map` or the scheme `kakaomap` is explicitly declared under the `<queries>` element in the `AndroidManifest.xml`.
4. In Expo, adding these declarations is accomplished by updating the `android` block with a `"queries"` array.
5. In addition, if the Kakao Map application is not installed on the user's device, the app must fall back to a Web URL.
6. The Kakao Map Web Link Specification requires a three-part path `Name,lat,lng` for routing. Omiting the name segment without maintaining the comma separator causes coordinate parsing failures. Thus, `https://map.kakao.com/link/to/Name,lat,lng` is the official, correct format.

---

## 3. Caveats
- Since we are operating in a read-only explorer role, we have only formulated the technical specifications and `app.json` updates. We have not directly modified any application code or configuration files.
- The actual implementation of the button trigger in the React Native UI components (e.g., place cards or `map.tsx` drawer) must be performed by the implementer agent.
- Device testing was not performed on actual hardware due to running in a simulated code workspace environment.

---

## 4. Conclusion
- Native deep linking to Kakao Map route finding must use the format `kakaomap://route?ep={lat},{lng}&epName={name}&by=FOOT` to open directly into the walking directions view.
- Web URL fallbacks must use the format `https://map.kakao.com/link/to/{encodedName},{lat},{lng}`.
- To ensure package queries (`canOpenURL`) resolve correctly:
  - iOS requires `LSApplicationQueriesSchemes` with `kakaomap` in `app.json`.
  - Android requires the `queries` configuration declaring package `net.daum.android.map` and scheme `kakaomap`.

---

## 5. Verification Method
1. **Prebuild Generation Check**:
   - Run `npx expo prebuild` in the `mobile` directory.
   - Inspect `ios/mobile/Info.plist` and verify the `LSApplicationQueriesSchemes` key is present and contains `<string>kakaomap</string>`.
   - Inspect `android/app/src/main/AndroidManifest.xml` and verify that the `<queries>` tag contains the `<package android:name="net.daum.android.map"/>` and `<intent>` with scheme `kakaomap`.
2. **Deep Link Test**:
   - Call `Linking.canOpenURL('kakaomap://')` on both platforms. It must return `true` if the Kakao Map app is installed.
   - Call `Linking.openURL('kakaomap://route?ep=35.1978,129.0837&epName=TestPlace&by=FOOT')` and verify the Kakao Map app opens the walking directions to coordinates `(35.1978, 129.0837)`.
