# Absolute Unified Record Schema

## 1. Context & State
- User requested that I verify exactly how the location changes (button click vs GPS) by reading the code, rather than guessing, because the teacher raised a concern about Demo vs Production behavior.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I read `map.tsx` and confirmed:
  - The refresh button (`next-spot`) at line 677 manually increments `setIndex((i) => (i + 1) % places.length)`. This is the sequential override.
  - The GPS watcher at line 424 (`Location.watchPositionAsync`) automatically sorts the `places` array by distance every 3 minutes (cooldown) and resets `setIndex(0)` to the closest spot.
- Therefore, my Dual-Build strategy of conditionally hiding the refresh button (`if EXPO_PUBLIC_BUILD_MODE !== 'PRODUCTION'`) is perfectly aligned with the teacher's requirement.

## 3. Execution Log
- Viewed `C:\mobile\app\(tabs)\map.tsx` and analyzed the `Location.watchPositionAsync` and `Pressable` button logic.
- Wrote log.
- Yielding response to user.
