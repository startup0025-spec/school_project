# Hallucination Check Report — Cycle 2

## 1. Codebase Verification (No Guessing)
- **Kakao Map SDK Domain restriction**:
  - *Claim*: We can use `baseUrl: 'https://haetae05.github.io'` to bypass Kakao origin block.
  - *Fact Check*: Verified. React Native WebView indeed sets the origin header based on the `baseUrl` prop. However, using a hardcoded personal github.io domain is a security and App Store rejection risk.
- **WebView coordinate transformation API**:
  - *Claim*: Explorer proposed using `kakao.maps.Coords` for screen-to-LatLng conversion.
  - *Fact Check*: **Hallucination Detected**. In the Kakao Maps Javascript SDK, `kakao.maps.Coords` represents Kakao's internal WCONGNAMUL meter-based coordinate system. Utilizing this for client touch coordinates (like `200, 300`) will return wrong coordinates near the origin. The correct API to use is `kakao.maps.Point` and `projection.pointToLatLng(point)`.
- **Offset correction**:
  - *Fact Check*: BoundingClientRect relative offset must be subtracted from clientX/Y to account for headers, margins, or relative positioning of the map container.

## 2. Identified Potential Hallucinations & Corrections
- **Point vs Coords API**: corrected the coordinate conversion method to `new kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top)` and `projection.pointToLatLng(point)`.
- **Multi-touch gesture leaks**: Added `touches.length > 1` cancellation checks to clear the long-press timer during zoom gestures.
- **Offscreen resource leak**: Added visibility toggling (`visibility: hidden` when unfocused) and `requestAnimationFrame` freezing scripts inside the WebView to stop WebGL threads and CPU rendering cycles.

## 3. Verdict
**PROCEED TO CYCLE 3 WITH CORRECTED ARCHITECTURE**
