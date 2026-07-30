# Project: Dual-Track EAS Profiles, Auto-Indicator UI, and Native Media Session

## Architecture
- Dual-Track Build Pipeline: `eas.json` configured with `preview-demo` and `preview-prod` profiles (`EXPO_PUBLIC_BUILD_MODE="PRODUCTION"` in `preview-prod`).
- UI Mode Transformation: Reactive UI switching based on `process.env.EXPO_PUBLIC_BUILD_MODE === 'PRODUCTION'` in `index.tsx`, `sound.tsx`, `safety.tsx`, and `map.tsx`.
- Native Media Session & Lockscreen Controls: MediaSession setup linked with `audio_engine_service.ts`, lockscreen controller with Play/Pause state synchronization, and custom album art (top half empty, bottom half blue/emerald ripples).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Dual-Track EAS Profiles | `eas.json` configuration | none | DONE |
| 2 | Auto-Indicator UI Transformation | `app/(tabs)/index.tsx`, `app/(tabs)/sound.tsx`, `app/(tabs)/safety.tsx`, `app/(tabs)/map.tsx` | M1 | DONE |
| 3 | Native Media Session & Lockscreen Controls | `lib/services/audio_engine_service.ts`, `lib/services/media_session_service.ts`, artwork assets | M2 | DONE |

## Interface Contracts
### Build Mode Environment Variable
- `EXPO_PUBLIC_BUILD_MODE`: `"PRODUCTION"` (in preview-prod) or undefined / `"DEMO"` (in preview-demo).

### UI Mode Behavior
- Demo Mode: Controls act as interactive manual toggles.
- Production Mode: Controls act as read-only automatic indicators (`pointerEvents="none"` in `index.tsx`, `sound.tsx`, `safety.tsx`; refresh button hidden in `map.tsx`).

### Media Session & Audio Engine Sync
- `media_session_service.ts`: Initializes MediaSession / Audio mode, loads custom album art (top half empty, bottom half blue/emerald ripples), handles lockscreen Play/Pause events.
- Play Action: Resumes audio engine (`playDynamicMix`).
- Pause Action: Halts audio engine (`stopAmbientSound`).

## Code Layout
- Build configuration: `eas.json`
- Tab Screens: `app/(tabs)/index.tsx`, `app/(tabs)/sound.tsx`, `app/(tabs)/safety.tsx`, `app/(tabs)/map.tsx`
- Audio Engine Service: `lib/services/audio_engine_service.ts`
- Media Session Service: `lib/services/media_session_service.ts`
