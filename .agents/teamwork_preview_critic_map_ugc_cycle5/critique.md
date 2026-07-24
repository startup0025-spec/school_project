# Cycle 5 Map & UGC Pivot - Critique & Verification Report

## Review Summary

**Verdict**: REQUEST_CHANGES

This report presents a rigorous critique and verification of the Cycle 5 Kakao Map & UGC Pivot implementation plan. While the plan introduces valuable improvements—such as removing grayscale styling, enabling custom SVG markers, incorporating a native diary entry modal, and supporting walking directions via deep links—it contains several critical correctness bugs, syntax errors, and architectural gaps that must be addressed before implementation.

---

## Findings

### [Critical] Finding 1: SVG Color Double-Encoding Bug
- **What**: The proposed custom SVG string variables (`activeSvg` and `inactiveSvg`) use pre-encoded `%23` for the color hex symbol `#` (e.g., `fill="%23007AFF"`). However, the code then calls `encodeURIComponent(activeSvg)` when passing the image to `kakao.maps.MarkerImage`.
- **Where**: `window.updateSpots` function in `KAKAO_MAP_HTML` inside `mobile/app/(tabs)/map.tsx`.
- **Why**: Calling `encodeURIComponent` on a string containing `%23` will escape the `%` to `%25`, resulting in `%2523007AFF` in the injected data URI. The Webview decodes it once, leaving `fill="%23007AFF"` in the SVG XML markup. SVG rendering engines do not perform a second level of URL decoding on XML attributes, so they see `%23` as part of the color string, which is syntactically invalid and causes the marker to render as black or transparent.
- **Suggestion**: Use the literal `#` character (e.g., `fill="#007AFF"` and `fill="#5A6E85"`) in the Javascript SVG templates so that `encodeURIComponent` encodes them exactly once into `%23` in the final output.

### [Major] Finding 2: Recreating `MarkerImage` Instances on Every Update
- **What**: The proposed `window.updateSpots` function instantiates new `MarkerImage` objects via `new kakao.maps.MarkerImage(...)` on every single execution.
- **Where**: `window.updateSpots` function in `KAKAO_MAP_HTML` inside `mobile/app/(tabs)/map.tsx`.
- **Why**: `updateSpots` is triggered whenever the list of places or the `activeIndex` (active spot) changes. Recreating image instances with large SVG data URIs causes significant memory allocation churn and potential memory leaks in mobile Webviews.
- **Suggestion**: Define `activeMarkerImage` and `inactiveMarkerImage` as global variables in the `<script>` tag and initialize them only once (or lazily upon map initialization) to reuse them.

### [Major] Finding 3: Missing React Native Imports for Modal and TextInput
- **What**: The proposed place card updates introduce native `<Modal>` and `<TextInput>` components in `renderCard()`, but do not update the imports from `'react-native'` at the top of the file.
- **Where**: `mobile/app/(tabs)/map.tsx`.
- **Why**: Running this code will result in an immediate compilation failure (`ReferenceError: Modal is not defined`).
- **Suggestion**: Update the imports at the top of `map.tsx` to include `Modal` and `TextInput` from `'react-native'`.

### [Major] Finding 4: Missing Modal Styles in Stylesheet
- **What**: The modal layout references styles (`styles.modalOverlay`, `styles.modalContent`, `styles.modalTitle`, `styles.modalInput`, `styles.modalActionRow`, `styles.modalButton`, `styles.modalButtonText`) that are not defined in the `styles` StyleSheet.
- **Where**: Stylesheet in `mobile/app/(tabs)/map.tsx`.
- **Why**: React Native will render these elements with `undefined` styling, leading to a completely broken UI (e.g., the input box will have no dimensions/borders, and the overlay will not be centered or translucent).
- **Suggestion**: Add the required styling declarations to `styles` stylesheet. Ensure that `textAlignVertical: 'top'` is added to `modalInput` to prevent vertical text centering on Android.

### [Major] Finding 5: Disabling SWR Background Updates
- **What**: The proposed implementation of `getPlaces()` in `local_places.ts` returns the in-memory cache `inMemoryPlaces` immediately if it is not null, but **completely removes** the background SWR checks and `revalidateData()` call.
- **Where**: `mobile/core_engine/src/database/local_places.ts`.
- **Why**: Once the in-memory cache is populated, `getPlaces()` will bypass revalidation entirely. The application will never trigger background network fetches to grab fresh places from the CDN, rendering the SWR cache mechanism obsolete.
- **Suggestion**: Keep the SWR revalidation threshold check and the asynchronous `revalidateData()` execution block at the beginning of `getPlaces()` so that it runs in the background.

### [Major] Finding 6: SWR Revalidation Cache Inconsistency
- **What**: The background revalidation function `revalidateData()` updates AsyncStorage and triggers the SWR update listeners, but does **not** update the static cache fields `inMemoryPlaces` and `inMemoryMap`.
- **Where**: `mobile/core_engine/src/database/local_places.ts`.
- **Why**: If a listener triggers a UI re-render, the active screen might display the fresh data. However, any subsequent calls to `getPlaces()` or `getPlaceByIdSync()` will read from the stale `inMemoryPlaces`/`inMemoryMap` cache, leading to data inconsistency.
- **Suggestion**: Call `updateInMemoryCache(json.places);` inside `revalidateData()` before notifying the SWR listeners.

### [Minor] Finding 7: Insecure Active Spot Injection Type Casting
- **What**: The active spot ID is injected into the WebView script via `"${activeSpotId}"` string templating.
- **Where**: `useEffect` spot updater in `mobile/app/(tabs)/map.tsx`.
- **Why**: If `activeSpotId` is `null` (e.g., when no spot is active), it will be stringified into the Javascript literal `"null"`. In `updateSpots`, the comparison `spot.id === activeSpotId` checks if `spot.id` matches the string `"null"`.
- **Suggestion**: Use `JSON.stringify(activeSpotId)` instead of wrapping it in double quotes (e.g., `window.updateSpots(..., ${JSON.stringify(activeSpotId)})`) to properly pass `null` or a quoted string.

### [Minor] Finding 8: Cold Start Cache Map Initialization
- **What**: `getPlaceByIdSync` will return `null` if called on app startup before the async `getPlaces()` has resolved, because `inMemoryMap` is initially empty.
- **Where**: `mobile/core_engine/src/database/local_places.ts`.
- **Why**: Components requiring synchronous spot lookup might fail to resolve places during initial cold start.
- **Suggestion**: Pre-populate `inMemoryPlaces` and `inMemoryMap` synchronously using the bundled master JSON data at the module top-level.

---

## Verified Claims

- **Kakao Map Grayscale Inversion Removal** → **Verified via code review** → **PASS**
  - Removing the `filter: grayscale(100%)...` rule from CSS style in `KAKAO_MAP_HTML` successfully restores the native colored tiles.
- **Walking Directions Deep Link Parameters** → **Verified via research** → **PASS**
  - Kakao Map scheme `kakaomap://route?ep=lat,lng&epName=...&by=FOOT` is verified to be the official way to launch walking navigation. Web fallback `https://map.kakao.com/link/to/Name,lat,lng` is also verified.
- **`addDiaryEntry` backward compatibility** → **Verified via code review** → **PASS**
  - Updating `addDiaryEntry` parameters to `(customText?: string, placeId?: string, placeName?: string)` maintains compatibility with the parameterless calls in `diary.tsx` and falls back correctly to ambient logging.

---

## Coverage Gaps

### 1. Missing Android Package Visibility in `app.json`
- **Risk Level**: **High**
- **Impact**: On Android 11 (API 30) and above, package query visibility is restricted. If `queries` is not declared in `AndroidManifest.xml` via `app.json` configuration, `Linking.canOpenURL('kakaomap://')` will silently return `false` even if the Kakao Map app is installed. This forces the app to always fall back to the web browser on Android.
- **Recommendation**: Introduce the Android intent query configuration in `app.json` or, alternatively, bypass `canOpenURL` altogether by directly calling `Linking.openURL()` and catching the failure to launch the web fallback.

### 2. Missing Core Packages in `package.json` Dependencies
- **Risk Level**: **Medium**
- **Impact**: Running `npm run typecheck` fails because standard libraries used by the services (such as `axios`, `expo-file-system`, `expo-av`, `expo-task-manager`, and `expo-notifications`) are missing from the `mobile/package.json` dependencies list.
- **Recommendation**: Add all missing dependencies to the respective package configuration files.

---

## Unverified Items

- **Physical Deep Link Execution**
  - **Reason**: We cannot test the physical launch of the Kakao Map native application on iOS or Android devices without a real device/emulator setup.

---

# Adversarial Challenge (Lead Critic Lens)

## Challenge Summary

**Overall risk assessment**: MEDIUM

While the guards and cache optimization provide significant protection against race conditions, the following scenarios present potential failures that the implementer must mitigate.

## Challenges

### [High] Challenge 1: Redundant WebView Marker Drawing Race Condition
- **Assumption challenged**: That separating the spot updates into two independent `useEffect` hooks is safe.
- **Attack scenario**: In the proposed layout, the WebView has one `useEffect` for syncing spots (depending on `places`) and another for viewport centering (depending on `activeIndex`). If `places` and `activeIndex` change concurrently, both effects fire. This causes the WebView to receive two consecutive `injectJavaScript` calls in a fraction of a millisecond. If the first script redraws all markers without highlighting, and the second script pan-centers the view, a visual glitch occurs where markers briefly flash as inactive before updating.
- **Blast radius**: UI flickering and Webview thread execution bottlenecks.
- **Mitigation**: Combine the marker synchronization and active highlight update into a single `useEffect` that listens to `[isPlacesLoaded, isMapReady, isSdkFailed, places, activeIndex]`.

### [Medium] Challenge 2: Keyboard Clashing on Small Screens
- **Assumption challenged**: That rendering a native `<Modal>` with a multiline `<TextInput>` works on all devices without keyboard management.
- **Attack scenario**: On smaller screen devices (e.g. iPhone SE), when the user opens the modal and tap-focuses the multiline input box, the virtual keyboard slides up and completely covers the modal submit/cancel buttons. Because there is no `KeyboardAvoidingView` or keyboard dismiss handler, the user is trapped and cannot tap the "기록 완료" button.
- **Blast radius**: High friction/usability block on smaller devices.
- **Mitigation**: Wrap the modal content in a `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.

### [Medium] Challenge 3: Unhandled Empty/Spaces Diary Entries
- **Assumption challenged**: That check `if (diaryText.trim())` is sufficient to prevent empty diary entries.
- **Attack scenario**: If the user presses "기록 완료" with only whitespace characters, the modal closes and updates the state. However, the input is trimmed to empty, triggering the fallback text `SOURCE_DIARY_DETAIL[waterSource]`. This creates a confusing UX where the user writes nothing but the app saves a log saying "강가 산책로에서 10분 머물렀어요."
- **Blast radius**: Broken user intent representation.
- **Mitigation**: If the input is empty or contains only spaces, either disable the submit button, show an alert, or save it explicitly as a blank text option rather than auto-falling back to ambient details.
