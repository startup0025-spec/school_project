# Project: Mobile Map Location Recommendation Refactor

## Architecture
- React Native / Expo Mobile Application (`map.tsx`)
- Storage: `AsyncStorage` (`@anywayTheSea:bg_location_state`) storing `{ lastLatitude, lastLongitude }`
- Calculation: Haversine formula for spherical distance between user coordinates and place coordinates
- Throttle / Cooldown logic: 3 minutes (180,000 ms) strict interval between re-sorts
- UI State: Array of places re-sorted by distance (index 0 closest), with safe `activeIndex` tracking to avoid index out-of-bounds or invalid state crashes.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Location & Sorting Refactor | `map.tsx`, `haversine.ts`, unit tests | none | DONE |

## Interface Contracts
### Location Storage State (`@anywayTheSea:bg_location_state`)
- Schema: `{ lastLatitude: number, lastLongitude: number, timestamp?: number }`

### Haversine Distance Helper
- Input: `(lat1: number, lon1: number, lat2: number, lon2: number) => number` (returns distance in meters or kilometers)

### Safe Re-sorting & Active Index Update
- Input: `places: Place[]`, `currentActivePlaceId: string | null`, `userLocation: Location`
- Output: `sortedPlaces: Place[]`, `newActiveIndex: number` (preserving currently selected place or falling back safely to 0 if invalid)

## Code Layout
- Main view: `app/(tabs)/map.tsx` or similar map view file
- Utilities: `src/utils/` or `utils/` (for Haversine & sorting logic if modularized)
