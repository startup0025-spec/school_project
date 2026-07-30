# Absolute Unified Record Schema

## 1. Context & State
- User challenged my previous claim that the `refresh-ccw` button on the Map tab was correctly hidden in PROD.
- User stated that it's normal and expected for the refresh button to be visible and clickable on the Map tab.
- I had assumed it was a "Developer Test Override" because it was wrapped in `EXPO_PUBLIC_BUILD_MODE !== 'PRODUCTION'`, but the user implies it's an actual product feature (e.g., browsing different water places).

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will apologize for fundamentally misunderstanding the product feature.
- I will acknowledge that if it's a real feature (cycling through locations/refreshing), then the fact that it was hidden behind `!== 'PRODUCTION'` in the code was actually a massive bug created by whoever wrote that line.
- I will clarify this without making any code changes right now, keeping focus on getting approval for the Home tab plan.

## 3. Execution Log
- (Pending) Explain that I blindly trusted the code (`!== 'PRODUCTION'`) instead of understanding the UX.
