# Project: Anyway the Sea (잔물결) - Core Engine Integration

## Architecture
The core engine (`mobile/core_engine`) is a TypeScript-only layer designed to compute safety risks, format audio parameters for sonification, fetch data from public APIs (KMA, Busan Metro), and coordinate local database state with the React Native frontend.

### Data Flow
1. **Background Location Track**: React Native background geofencing service (`geofencing_service.ts`) wakes up on location changes.
2. **Safety Check**: Coordinates with `core_engine/src/api.ts` to call `checkGeofenceAndSafety(lat, lng)`.
3. **API Integration**: Fetches meteorological data (KMA wind speed, weather alerts) and hydrology data (Busan river levels, water quality) via `busan_api.ts` and `kma_api.ts`.
4. **Offline Cache fallback**: If network is offline, `client.ts` interceptor returns cached API responses or mock payloads seamlessly.
5. **Decision Engine**:
   - Computes `SafetyLevel` ('Safe' | 'Warning' | 'Danger') based on water level and wind alerts.
   - Computes `AudioParams` (cross-fade ratios, volumes, pitch, filter frequencies) based on water level, turbidity, and wind speed.
6. **Execution**: React Native UI updates the ripple orb visualization, and `audio_engine_service.ts` updates background audio parameters (ambient flow vs siren).

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Design & Validation | 10-cycle tiqy-taqa validation, plan.md, PROJECT.md | None | DONE |
| 2 | M2: Models Implementation | safety_status.ts, audio_params.ts | M1 | DONE |
| 3 | M3: API Core Service | api.ts logic | M2 | DONE |
| 4 | M4: Core Entry Point | index.ts exports | M3 | DONE |
| 5 | M5: Blueprints & Spec Sync | blueprints/ docs & 교육청 대회용 앱 간단 설계서.txt | M4 | DONE |
| 6 | M6: Compiler Verification | 0 compiler errors check | M5 | DONE |

## Interface Contracts

### 1. `safety_status.ts`
- **Type/Enum**: `SafetyLevel`
  - Values: `'Safe'` | `'Warning'` | `'Danger'`
- **Functions**: Any safety conversion or assessment helpers.

### 2. `audio_params.ts`
- **Interface**: `AudioParams`
  - Holds parameters mapped from real-world data (water level, water quality/turbidity, wind speed) to audio mixing levels:
    - Ambient Sound Select (waterType: sea / river / stream / none)
    - Ambient Volume (sea/river volume scaling: 0.0 to 1.0)
    - Pitch / Filter Frequency (for turbidity/water level changes)
    - Wind Noise Volume (wind speed scaling: 0.0 to 1.0)
    - Alarm Active (boolean, triggers emergency siren)

### 3. `api.ts`
- **Functions**:
  - `checkGeofenceAndSafety(userLat: number, userLng: number): Promise<SafetyLevel>`
    - Determines which place the user is currently inside/near, calculates safety hazard index (hydrology level threshold or meteorological warning), and returns the `SafetyLevel`.
  - `getSonificationParams(place: Place): Promise<AudioParams>`
    - Combines the current place's live API data to calculate the precise parameters for the audio engine.

### 4. `index.ts`
- **Exports**:
  - All public types, enums, functions from `api.ts`, `models/`, `database/`, etc.

## Code Layout
- `mobile/core_engine/src/models/safety_status.ts`
- `mobile/core_engine/src/models/audio_params.ts`
- `mobile/core_engine/src/api.ts`
- `mobile/core_engine/src/index.ts`
