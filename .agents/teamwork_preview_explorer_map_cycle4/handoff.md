# Handoff Report — Kakao Map API Integration Plan

## 1. Observation
We observed and inspected the following files in the project:
- **Relative Coordinates in Mock Data**: In `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\constants\mockData.ts` (lines 47, 56, 63, 70), the `QuietSpot` interface and `QUIET_SPOTS` array use relative coordinate values:
  ```typescript
  export interface QuietSpot {
    ...
    pin: { x: number; y: number }; // relative 0-1 position over the map illustration
  }
  ```
- **Relative Coordinate Rendering**: In `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\map.tsx` (lines 42-50), the pin layout uses absolute CSS offsets:
  ```typescript
  style={[
    styles.pinWrap,
    { left: `${spot.pin.x * 100}%` as const, top: `${spot.pin.y * 100}%` as const },
  ]}
  ```
- **Busan Water Station Coordinates**: In `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\scripts\pipeline\data\water_stations.js` (lines 19-63), the real Busan coordinates are configured:
  ```javascript
  { name: '부곡교', lat: 35.2318, lng: 129.0843, ... }
  { name: '세병교', lat: 35.1978, lng: 129.0837, ... }
  { name: '이섭교', lat: 35.1851, lng: 129.0756, ... }
  { name: '동천교', lat: 35.1978, lng: 129.1323, ... }
  { name: '세월교', lat: 35.2031, lng: 129.1198, ... }
  ```
- **Place Model**: In `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\core_engine\src\models\place_model.ts`, the `Place` interface defines standard properties like `id`, `name`, `latitude`, `longitude`, `description`, `waterType`, `geofenceRadius`, etc.
- **SWR Database Access**: In `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\core_engine\src\database\local_places.ts` (line 41), the `getPlaces` function returns `Promise<Place[]>` using AsyncStorage and CDN revalidation SWR strategy.
- **Baseline Typecheck Command**: Running `powershell -ExecutionPolicy Bypass -Command "npm run typecheck"` inside `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile` returns 6 TypeScript errors originating from `lib/services/audio_caching_service.ts` and `lib/services/audio_engine_service.ts` (e.g. `Property 'documentDirectory' does not exist on type...`). No errors were detected in `map.tsx` or `mockData.ts`.

---

## 2. Logic Chain
1. **Cleanup of Relative Coordinates**: Because the dynamic Kakao Map API renders markers using geographical latitude and longitude values inside a WebView, the relative position properties (`pin: { x, y }`) are obsolete. Removing them from `QuietSpot` and `map.tsx` prevents layout distortions across different devices.
2. **Mock Coordinate Updates**: The `QUIET_SPOTS` elements in `mockData.ts` can be aligned with the real water stations in `water_stations.js` by assigning:
   - `s1` (`수성천 산책로`) -> `latitude: 35.2031, longitude: 129.1198` (close to 세월교)
   - `s2` (`온천천 하류길`) -> `latitude: 35.1978, longitude: 129.0837` (close to 세병교)
   - `s3` (`장전천 벤치`) -> `latitude: 35.2318, longitude: 129.0843` (close to 부곡교)
3. **Core Engine Place Alignment**: By refactoring `QuietSpot` to extend `Place` and renaming `note` to `description`, we achieve type safety and interoperability between static mock data and dynamic API outputs.
4. **Runtime SWR Hook Integration**: In `map.tsx`, calling `getPlaces()` on component mount lets us load dynamic spots. If the return value is empty or fails, we fall back to the updated `QUIET_SPOTS` containing real coordinates.
5. **Dynamic Walk Time**: Since the core `Place` model does not contain a static `walk` field, implementing a Haversine distance calculator in `map.tsx` allows estimating walk time dynamically when user coordinates are available.

---

## 3. Caveats
- **Offline fallback behavior**: The offline map view uses the static illustration `quiet-map.png` but does not render the pin dot, instead showing a warning message. This design choice prevents distorted dot positioning, but can be customized if needed.
- **Pre-existing TS Errors**: The baseline TypeScript errors in the audio cache system are unrelated to this task and must be bypassed or ignored when evaluating type safety of the map module.

---

## 4. Conclusion
The proposed plan provides a clean transition from static mock data to dynamic coordinates. By refactoring the data structures to align with the core `Place` model and integrating the `local_places` SWR strategy with mock fallbacks, the implementer can safely remove the legacy relative coordinate system while maintaining robust offline resilience.

---

## 5. Verification Method
- **Inspect Proposals**: Check the code snippets and migration checklist in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle4\analysis.md`.
- **Verify Compile Integrity**: After applying the changes, run:
  ```powershell
  powershell -ExecutionPolicy Bypass -Command "npm run typecheck"
  ```
  Ensure that no new compiler errors are introduced in `map.tsx` and `mockData.ts`.
