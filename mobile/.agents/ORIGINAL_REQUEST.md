# Original User Request

## Initial Request — 2026-07-24T02:14:30Z

<USER_REQUEST>
# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Refactor the place recommendation logic in `map.tsx` to sort places by closest GPS distance, utilizing the existing background geofencing persistent state (`@anywayTheSea:bg_location_state`) for instant initialization and throttled real-time updates.

Working directory: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile`
Integrity mode: development

## Requirements

### R1. Integrate Background GPS State
Modify `map.tsx` to retrieve the last known user location (`lastLatitude`, `lastLongitude`) from `AsyncStorage` (`@anywayTheSea:bg_location_state`) upon component mount.

### R2. Distance-Based Sorting
When places are loaded and the user's location is known (either from background cache or foreground update), sort the places array by Haversine distance so that the geometrically closest place becomes index 0.

### R3. Stable UI Sorting (3-Minute Throttle)
To prevent UI flickering while the user walks, the continuous distance-based re-sorting must be throttled. The array should re-sort in real-time, but enforce a strict **3-minute (180,000 ms) cooldown/interval** between sorts. 

## Acceptance Criteria

### Verification
- [ ] On initial load, the map's recommended place (index 0) must be the closest spot to the user's last known background location.
- [ ] If no background location exists, it must wait for the first foreground location update to execute the initial sort.
- [ ] As the user's foreground GPS updates, the place list must re-sort by distance, but it MUST NOT re-sort more frequently than once every 3 minutes.
- [ ] The current `activeIndex` must be safely managed during a re-sort so the app does not crash or throw out-of-bounds errors.
</USER_REQUEST>
