# Cycle 3 Kakao Map & UGC Pivot - Lead Critic Handoff Report

## 1. Observation
We observed the following files and configurations in the codebase and the Lead Explorer's Cycle 3 report:
1. **Explorer's Analysis Report** (`.agents/teamwork_preview_explorer_map_ugc_cycle3/analysis.md`):
   - Suggests dynamic import:
     ```typescript
     import('../../core_engine/src/database/local_places').then(({ getPlaceById }) => { ... })
     ```
     at line 104 in `RippleContext.tsx` and in the mount-level background state restore `useEffect`.
   - Proposes UI rendering in `diary.tsx`:
     ```tsx
     {item.placeName && (
       <View style={[styles.placeBadge, { backgroundColor: colors.primary + '10' }]}>
         <Feather name="map-pin" size={10} color={colors.primary} />
         <Text style={[styles.placeBadgeText, { color: colors.primary }]}>{item.placeName}</Text>
       </View>
     )}
     ```
2. **Project Root Structure**:
   - `Anyway_the_Sea/` contains `mobile/`, `web/`, and `scripts/` directories.
   - `mobile/core_engine` is nested inside `mobile/`. No root-level `core_engine` exists.
3. **`local_places.ts` Database Retrieval** (`mobile/core_engine/src/database/local_places.ts`):
   - `getPlaceById` calls `getPlaces()` on every call:
     ```typescript
     export const getPlaceById = async (id: string): Promise<Place | null> => {
       const places = await getPlaces();
       const place = places.find((p) => p.id === id);
       return place || null;
     }
     ```
   - `getPlaces()` reads from AsyncStorage on every call:
     ```typescript
     const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
     ```
4. **Local Fallback JSON File** (`mobile/assets/data/busan_places_master.json`):
   - Contains:
     ```json
     {
       "generatedAt": "2026-07-15T00:00:00Z",
       "totalCount": 0,
       "places": []
     }
     ```
5. **Design System Colors** (`mobile/constants/colors.ts`):
   - Defines `colors.light` with `primary: '#2F6F6B'` and `secondary: '#E3EEEA'`.
6. **Existing Diary Loading** (`mobile/context/RippleContext.tsx`):
   - Loads initial diary list using:
     ```typescript
     const parsed = JSON.parse(data);
     if (Array.isArray(parsed)) {
       setDiaryEntries(parsed);
     }
     ```

---

## 2. Logic Chain
1. **Dynamic Import Relative Path Error**:
   - From `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\context\RippleContext.tsx`, going up two directories via `../../` leads to the workspace root `Anyway_the_Sea/`.
   - Resolving `../../core_engine/...` attempts to find `Anyway_the_Sea/core_engine/`, which does not exist because `core_engine` is located inside `mobile/` (`Anyway_the_Sea/mobile/core_engine/`).
   - Therefore, the proposed relative import path is invalid and will cause a compilation error. The correct path is `../core_engine/...` or the alias `@/core_engine/...`.
2. **Metro Bundler Dynamic Import Behavior**:
   - React Native's Metro bundler bundles all JS modules into a single index bundle file by default.
   - Metro compiles dynamic `import()` into a synchronous `require` wrapped in a resolved promise (`Promise.resolve(require(...))`).
   - Thus, dynamic import yields no bundle size or startup memory benefits, while introducing promise chain complexity in high-frequency event listeners.
3. **AsyncStorage Disk I/O Performance Bottleneck**:
   - `onTrackingStateUpdate` fires frequently during geofence tracking.
   - Calling `getPlaceById` every time triggers `getPlaces()`, which executes a disk read (`AsyncStorage.getItem`) and a full JSON parse (`JSON.parse`).
   - Asynchronous disk access on mobile devices is slow, blocked by SQLite read transactions, and consumes significant CPU, which can cause UI stuttering and high battery consumption.
   - By implementing an in-memory array cache (`cachedPlacesInMemory`) and a Map (`cachedPlacesMap`), subsequent lookups are resolved in memory at $O(1)$ without disk read operations.
4. **Empty Local Fallback Database**:
   - If the app is launched offline for the first time, the CDN fetch fails, and the AsyncStorage cache is empty.
   - The app falls back to `assets/data/busan_places_master.json`, which contains `places: []`.
   - Consequently, the manual selection list is empty and geofenced coordinates cannot resolve to place names. Pre-populating the bundled JSON file with seed data is required.
5. **Historical Data Parsing Vulnerability**:
   - Direct `JSON.parse` values from AsyncStorage are not type-safe at runtime.
   - If historical entries are corrupted, missing, or have invalid object properties, rendering them inside `<Text>` will cause a Red Screen crash. Sanitizing and validating types during loading is necessary.
6. **Fragile Opacity Interpolation**:
   - Concatenating `'10'` to `colors.primary` assumes `colors.primary` will always be a 7-character hex string.
   - If the palette changes to RGB/RGBA or CSS variables, color parsing will fail. Utilizing `colors.secondary` offers a safer, more consistent alternative.

---

## 3. Caveats
- Metro bundler config is assumed to be the default Expo configuration. If an advanced RAM bundle structure or lazy bundle loading is configured, dynamic import behavior might differ, but static imports remain preferred for core utilities.
- We did not measure performance on physical Android/iOS devices, but our conclusions are based on standard mobile database access patterns.

---

## 4. Conclusion
We recommend issuing a **REQUEST_CHANGES** verdict. The proposed Cycle 3 implementation plan must be updated to address:
1. Fixing the relative import path to `@/core_engine/src/database/local_places` or `../core_engine/src/database/local_places`, and making it a static top-level import.
2. Adding a memory-based caching mechanism to `local_places.ts` using module-scoped variables and a Map lookup.
3. Seeding the local bundled fallback JSON file `busan_places_master.json` with default water places.
4. Implementing sanitization/type validation on historical diary parsing inside `RippleContext.tsx` to prevent runtime crashes.
5. Changing the color opacity concatenation to use `colors.secondary`.

---

## 5. Verification Method
- **Verification of path correctness**:
  - Run typecheck in `mobile/`: `cmd.exe /c "npm run typecheck"`
  - Verify that no import errors occur once the import is statically resolved from `@/core_engine/...`.
- **Verification of memory cache functionality**:
  - Add console logs inside `getPlaces` in `local_places.ts` to log when `AsyncStorage.getItem` is called.
  - Verify that multiple successive calls to `getPlaces()` or `getPlaceById()` only trigger the log on the very first invocation, and subsequent calls return immediately without disk read logs.
- **Verification of sanitization logic**:
  - Write a mock test item to AsyncStorage with an invalid structure (e.g. `{ id: 123, label: null }`) and check that it is successfully filtered out and does not crash the app.
