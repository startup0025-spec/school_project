# Hallucination Check Report — Cycle 4

## 1. Codebase Verification (No Guessing)
- **Kakao Map Deep Link Parameters**:
  - *Claim*: The destination name is passed via `en` parameter in `kakaomap://route`.
  - *Fact Check*: **Hallucination Detected**. According to Kakao Map URI specifications, `epName` is the correct parameter for passing destination name in route navigation, whereas `en` is not recognized. We have corrected the parameter to `epName=${encodeURIComponent(place.name)}`.
- **Web Fallback URL Separation**:
  - *Claim*: Passing only coordinate numbers (e.g. `https://map.kakao.com/link/to/lat,lng`) is sufficient.
  - *Fact Check*: **Hallucination Detected**. Web link specifications require a name segment before coordinates. Omission of the name fails, or requires preserving the leading comma (e.g. `https://map.kakao.com/link/to/,lat,lng`). The official format is `https://map.kakao.com/link/to/[Name],[lat],[lng]`, which we will implement.
- **Android Intent Visibility Queries**:
  - *Fact Check*: Verified. On Android 11+, standard Expo configs need package and intent definitions for `kakaomap` scheme under `expo.android.queries` in `app.json` to enable package visibility.

## 2. Identified Potential Hallucinations & Corrections
- The team has corrected the deep link parameter from `en` to `epName`, corrected the comma-separated fallback web URL format, and specified the Android package visibility query layout for `app.json`.

## 3. Verdict
**PROCEED WITH INCORPORATED DEEP LINK SCHEMES**
