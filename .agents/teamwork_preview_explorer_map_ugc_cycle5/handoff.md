# Handoff Report — Cycle 5 Kakao Map & UGC Pivot Implementation Plan

This report serves as the hard handoff for Cycle 5 of the Kakao Map & UGC Pivot. It details the observations, logic chain, caveats, conclusion, and verification method for the implementation plan.

---

## 1. Observation
We observed the following relevant file locations, specifications, and code snippets in the codebase:

*   **Grayscale Tile Filters**:
    Inside `mobile/app/(tabs)/map.tsx` (lines 38-44), a CSS filter rule is defined within the Web HTML content:
    ```css
    #map img[src*="daumcdn.net"], 
    #map img[src*="maps.daumcdn.net"] {
      filter: grayscale(100%) opacity(0.8) contrast(1.1);
      will-change: filter;
      transform: translate3d(0, 0, 0); /* Promote to GPU layer for panning speed */
    }
    ```
*   **Dynamic Markers**:
    Inside `mobile/app/(tabs)/map.tsx` (lines 235-242), the markers are instantiated using the default styling:
    ```javascript
    // Create new marker
    var marker = new kakao.maps.Marker({
      position: latLon,
      title: spot.name
    });
    ```
*   **Place Card Rendering**:
    Inside `mobile/app/(tabs)/map.tsx` (lines 535-564), the `renderCard` method renders place metadata but does not contain a "기록하기" (Log Diary) button or "길찾기" (Directions) button, only a "다른 물길 보기" refresh button.
*   **Diary Entry Signature & State**:
    Inside `mobile/context/RippleContext.tsx` (lines 178-192), `addDiaryEntry` is defined as:
    ```typescript
    const addDiaryEntry = useCallback(() => {
      const label = formatTimeLabel(new Date());
      const entry: DiaryEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        label,
        detail: SOURCE_DIARY_DETAIL[waterSource],
      };
      setDiaryEntries((prev) => {
        const next = [entry, ...prev];
        AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(next)).catch((e) =>
          console.warn('[RippleContext] 일기장 저장 에러:', e)
        );
        return next;
      });
    }, [waterSource]);
    ```
*   **Database Lookup Latency**:
    Inside `mobile/core_engine/src/database/local_places.ts` (lines 93-97), `getPlaceById` executes an asynchronous database search:
    ```typescript
    export const getPlaceById = async (id: string): Promise<Place | null> => {
      const places = await getPlaces();
      const place = places.find((p) => p.id === id);
      return place || null;
    }
    ```
    This function reads from AsyncStorage or the CDN on every call, parsing the JSON data asynchronously.

---

## 2. Logic Chain
Based on the observations, we developed the following implementation plan logic:

1.  **Pure Map Restoration**: Removing lines 38-44 in `map.tsx` removes the tile-level grayscale filters, instantly restoring the pure Kakao Map colors.
2.  **Dynamic Markers**: Passing the `activeSpotId` to `updateSpots` and applying a custom `kakao.maps.MarkerImage` generated via a `data:image/svg+xml` URI allows styling markers dynamically based on their selected status.
3.  **UGC Personal Diary Pivot**:
    *   Updating `addDiaryEntry` in `RippleContext.tsx` with optional parameter arguments (`customText?`, `placeId?`, `placeName?`) enables custom text entry and place binding.
    *   Integrating a React Native `Modal` overlay triggered by a "기록하기" button on the place card (in `renderCard` inside `map.tsx`) captures the custom user text, and passes the text and the active place's details to the updated `addDiaryEntry` function.
    *   The `addDiaryEntry` function implements the **Optimistic State Update Pattern** by immediately calling `setDiaryEntries` and launching the asynchronous file write to AsyncStorage in the background (non-blocking).
4.  **Deep Linking**:
    *   Using the `kakaomap://route` query format with `by=FOOT` triggers walking navigation directly in the native Kakao Map app.
    *   Whitelisting `kakaomap` in `app.json` under `LSApplicationQueriesSchemes` is mandatory on iOS for `Linking.canOpenURL('kakaomap://')` to return `true`.
    *   Encoding the name using `encodeURIComponent(epName)` is required to prevent parser errors in URI schemes.
    *   Falling back to `https://map.kakao.com/link/to/Name,lat,lng` ensures offline or non-installed users can view directions in their mobile web browser.
5.  **Defensive Loading Sequence**:
    *   Introducing a static cache variable `inMemoryPlaces` and an `inMemoryMap` index in `local_places.ts` enables synchronous, $O(1)$ lookups, bypassing repeated disk reads.
    *   Adding an `isPlacesLoaded` state guard in `map.tsx` ensures the WebView does not inject markers or center the camera until the database is loaded.

---

## 3. Caveats
*   **Walking Navigation Restrictions**: Pedestrian walking navigation routes in Kakao Map are only computed if the physical distance between the start point and the destination is under Kakao's internal limit (typically under 30km). For locations further away, Kakao Map will show a routing error.
*   **Web Fallback Layout**: If the destination name contains commas, special characters, or spaces, `encodeURIComponent` correctly formats them, but Kakao Map's web parser might exhibit layout differences depending on browser compatibility.

---

## 4. Conclusion
The proposed plan provides a complete, robust, and performant roadmap for implementing the Cycle 5 specifications. It successfully addresses visual map styling, UGC diary creation, deep linking compatibility, package query rules, and concurrency race conditions without editing any codebase files during the exploration phase.

---

## 5. Verification Method
To verify the implementation once executed by the implementer:
1.  **Map Restoration and Markers**: Inspect the WebView map page visually. Check that the map color is full/standard, and verify that the active spot is styled with a blue SVG pin and inactive spots are styled with grey/slate SVG pins.
2.  **UGC Diary Integration**: Click "기록하기" on a card. Verify that a modal pops up and permits custom input. Click save, verify that a haptic vibration occurs, and inspect `diary.tsx` to verify the entry is logged.
3.  **Handoff Verification Commands**:
    *   To run Expo linting and check typescript compatibility:
        `npm run ts:check` or `npx tsc --noEmit`
    *   To prebuild and check configuration layout:
        `npx expo prebuild --clean` (Inspect `ios/mobile/Info.plist` for `LSApplicationQueriesSchemes`).
