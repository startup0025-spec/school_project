# Scope: Pure Kakao Map & UGC Pivot & Deep Linking Planning

## Architecture
This orchestrator run is a planning phase focusing on:
1. **Kakao Map WebView Restoration**: Reverting grayscale filter logic and fully integrating pure Kakao Map.
2. **Dynamic Marker Customization**: Integrating dynamic color markers based on theme context (`useColors()`).
3. **UGC Personal Diary Pivot**: Designing the user interface and state integration for adding personal logs and binding them to places.
4. **Deep Linking Integration**: Implementing navigation hooks/schemes to Kakao Map (e.g., Kakaomap app deep links vs web URL fallback).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Codebase Discovery | Investigating existing codebase (map.tsx, diary.tsx, RippleContext.tsx, local_places.ts) and dependencies | None | PLANNED |
| 2 | M2: Discussion Cycle 1 | Addressing BERRY's kick-off points: grayscale removal, useColors() custom marker integration, place card deep links | M1 | PLANNED |
| 3 | M3: Discussion Cycle 2 | Pure Kakao Map script/WebView restoration and communication protocol validation | M2 | PLANNED |
| 4 | M4: Discussion Cycle 3 | Personal Diary UGC screen state integration and AsyncStorage plan | M3 | PLANNED |
| 5 | M5: Discussion Cycle 4 | Deep Linking scheme verification (Kakao map scheme, custom parameters, fallback URL) | M4 | PLANNED |
| 6 | M6: Discussion Cycle 5 | Synthesis, edge cases, error-free validation, and final consensus | M5 | PLANNED |
| 7 | M7: Final Plan Output | Write final implementation plan to root and report completion | M6 | PLANNED |

## Interface Contracts
- **Web-Native Bridge**: Define postMessage schema for map centering, marker click, place details overlay, etc.
- **Theme Color Sync**: Dynamic stylesheet modifications in WebView injected JavaScript based on `useColors()`.
- **Deep Link Interface**: Helper function `openKakaoMapNav(destName, lat, lng)` using React Native `Linking`.
