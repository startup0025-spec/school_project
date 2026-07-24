# M3 Emotional UX & UI Audit Report

**Project**: `Anyway_the_Sea`  
**Auditor**: Critic 1 (Emotional UX & UI Reviewer)  
**Target Scope**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile`  
**Date**: 2026-07-24  
**Audit Standard**: 3-Layer Emotional UX Rules (Visceral, Behavioral, Reflective)

---

## Executive Summary

An exhaustive audit of the `Anyway_the_Sea` React Native mobile codebase (`mobile/app`, `mobile/components`, `mobile/context`, `mobile/lib/services`, and `mobile/core_engine`) was conducted against the **3-Layer Emotional UX Framework**.

A total of **19 specific Emotional UX violations** across 6 core dimensions were identified with exact file locations, line numbers, and actionable remediation guidelines.

| Emotional UX Level | Category | Violations Count | Key Risk Summary |
|---|---|:---:|---|
| **Level 1: Visceral** | 1. Visual Aggression | 2 | Raw stack traces in DEV fallback & unlocalized English 404 error screen |
| | 2. Vitality Absence | 7 | Static Pressables lacking touch feedback (`pressed` state) & font loading blank screens |
| **Level 2: Behavioral** | 3. Irreversible Actions | 2 | Permanent alert banner dismissal & non-deletable diary entries without undo |
| | 4. State Blindness | 4 | Hidden loading states during location monitoring, audio engine mixing & storage reads |
| **Level 3: Reflective** | 5. Machine Arrogance | 4 | User-blaming alerts, cold English error copy, & cynical/dismissive system messages |
| | 6. Black-box Alienation | 3 | Background API safety calculations & dynamic audio synthesis running without user breakdown |
| **Total** | | **19** | |

---

## Detailed Audit Findings by Category

### [Level 1: Visceral (Gut Reaction)]

#### 1. Visual Aggression
> *Flag any hardcoded raw system errors (e.g., stack traces, unhandled error text) dumped to the UI without a polite wrapper.*

- **Finding 1.1: Raw Dev Stack Trace Exposed in Error Fallback Modal**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\components\ErrorFallback.tsx` (Lines 36–41, 148–160)
  - **Snippet**:
    ```tsx
    36: const formatErrorDetails = (): string => {
    37:   let details = `Error: ${error.message}\n\n`;
    38:   if (error.stack) {
    39:     details += `Stack Trace:\n${error.stack}`;
    40:   }
    41:   return details;
    42: };
    ...
    158: {formatErrorDetails()}
    ```
  - **Issue**: In `__DEV__` mode, unhandled system errors and raw stack traces are rendered directly into a monospaced text view inside a modal. Dumping raw technical stack traces directly to the user violates visceral visual comfort.
  - **Recommendation**: Wrap technical details inside a collapsible "개발자 진단 정보" expander with polite, comforting Korean error phrasing.

- **Finding 1.2: Unlocalized Default 404 Screen Text**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\+not-found.tsx` (Lines 10, 13, 18)
  - **Snippet**:
    ```tsx
    10: <Stack.Screen options={{ title: 'Oops!' }} />
    13: This screen doesn't exist.
    18: Go to home screen!
    ```
  - **Issue**: Displays unhandled default English boilerplate error text (`Oops!`, `This screen doesn't exist.`). When an invalid route is reached, the abrupt transition to raw English breaks the calm ocean narrative.
  - **Recommendation**: Replace with localized Korean copy (e.g. `길을 잃으셨나요? 잔잔한 물결이 흐르는 홈으로 돌아갑니다`).

---

#### 2. Vitality Absence
> *Flag missing pressable feedback, active states, animation transitions, or skeleton loaders that make the app feel "dead" or frozen.*

- **Finding 2.1: Header Bell Button Lacks Pressable Touch Feedback**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\index.tsx` (Lines 49–55)
  - **Snippet**:
    ```tsx
    49: <Pressable
    50:   onPress={() => router.push('/notifications')}
    51:   style={[styles.bellButton, { backgroundColor: colors.secondary }]}
    52: >
    ```
  - **Issue**: The `Pressable` notification bell uses a static style object without dynamic `pressed` callback feedback (`opacity: pressed ? 0.7 : 1` or scale animation), making the button feel rigid and frozen on touch.
  - **Recommendation**: Use `style={({ pressed }) => [styles.bellButton, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}`.

- **Finding 2.2: Banner Dismiss 'X' Button Lacks Pressable Active State**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\index.tsx` (Lines 85–91)
  - **Snippet**:
    ```tsx
    85: <Pressable
    86:   onPress={() => setBannerDismissed(true)}
    87:   style={styles.dismiss}
    88: >
    ```
  - **Issue**: The banner dismiss button has a small touch target (`padding: 2`) and no visual active state when pressed.
  - **Recommendation**: Expand hit area with `hitSlop={12}` and add pressing feedback style.

- **Finding 2.3: Map Action Buttons and Refresh Control Lack Active Visual Feedback**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\map.tsx` (Lines 652–669, 695–700)
  - **Snippet**:
    ```tsx
    652: <Pressable onPress={() => setDiaryModalVisible(true)} style={styles.actionButton}>
    656: <Pressable onPress={handleDeepLink} style={styles.actionButton}>
    660: <Pressable onPress={...} style={styles.refreshButton}>
    695: <Pressable onPress={() => setDiaryModalVisible(false)} style={styles.modalCancel}>
    698: <Pressable onPress={handleSaveDiary} style={[styles.modalSave, ...]} >
    ```
  - **Issue**: All map card action buttons ("기록하기", "길찾기", refresh icon) and modal buttons ("취소", "저장") use static style arrays without `pressed` visual states.
  - **Recommendation**: Apply standard active press visual states (`opacity` or `scale`) across all action buttons.

- **Finding 2.4: Sound Source Chips & Play Button Lack Visual Press Feedback**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\sound.tsx` (Lines 85–103, 115–125)
  - **Snippet**:
    ```tsx
    85: <Pressable key={option.value} onPress={...} style={[styles.chip, ...]} >
    115: <Pressable onPress={...} style={[styles.playButton, ...]} >
    ```
  - **Issue**: Selecting water sources ("시냇물", "강물", "바다") and toggling play/pause provides haptics but lacks visual press state feedback prior to state change.
  - **Recommendation**: Add pressed state styles to `chip` and `playButton`.

- **Finding 2.5: Safety Zone Action Button Lacks Press Feedback**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\safety.tsx` (Lines 54–61)
  - **Snippet**:
    ```tsx
    54: <Pressable onPress={() => router.push('/map')} style={styles.warningAction} >
    ```
  - **Issue**: "다른 곳 보기" action button in warning banner lacks pressed state visual feedback.
  - **Recommendation**: Add active press style.

- **Finding 2.6: SegmentedControl Tab Buttons Lack Touch States**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\components\SegmentedControl.tsx` (Lines 29–53)
  - **Snippet**:
    ```tsx
    29: <Pressable key={option.value} onPress={...} style={[styles.segment, ...]} >
    ```
  - **Issue**: Reusable `SegmentedControl` component used in Home and Safety screens does not provide active visual touch feedback during user press.
  - **Recommendation**: Add `opacity: pressed ? 0.8 : 1` to `styles.segment`.

- **Finding 2.7: Font Loading Gate Returns Blank Screen (`null`) Without Skeleton/Splash**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\_layout.tsx` (Line 96)
  - **Snippet**:
    ```tsx
    96: if (!fontsLoaded && !fontError) return null;
    ```
  - **Issue**: Returning `null` renders a completely empty/blank screen if fonts take time to load, leaving the user with a dead/frozen feeling.
  - **Recommendation**: Retain native splash screen or render a tranquil skeleton container until assets load.

---

### [Level 2: Behavioral (Usability & Friction)]

#### 3. Irreversible Actions
> *Flag dangerous actions (e.g., delete, clear cache, destructive actions) that lack confirmation modals or undo functionality.*

- **Finding 3.1: Irreversible Home Banner Dismissal Without Recall/Undo**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\index.tsx` (Lines 69–93)
  - **Snippet**:
    ```tsx
    69: {!bannerDismissed && (
    70:   <View style={[styles.banner, ...]}>
    86:     <Pressable onPress={() => setBannerDismissed(true)}>
    ```
  - **Issue**: Clicking 'x' permanently hides critical ambient/safety messages (`currentMessage`) until message state changes, with no option to view dismissed messages again or undo.
  - **Recommendation**: Provide an alert history drawer or undo snackbar ("알림이 숨겨졌습니다. [되돌리기]").

- **Finding 3.2: Immediate Diary Entry Persistence Without Delete or Edit Functionality**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\context\RippleContext.tsx` (Lines 185–201) & `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\diary.tsx` (Lines 20–41)
  - **Snippet**:
    ```tsx
    185: const addDiaryEntry = useCallback((customText?: string, placeId?: string, placeName?: string) => {
    ...
    197:   AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(next));
    ```
  - **Issue**: Saving a diary entry immediately commits it to persistent storage, but the Diary screen (`diary.tsx`) provides zero delete, clear, or edit actions. If a user accidentally submits a typo or test entry, it is permanently locked in their diary list.
  - **Recommendation**: Add a swipe-to-delete or delete icon with confirmation modal ("이 기록을 삭제하시겠습니까?") to `diary.tsx`.

---

#### 4. State Blindness
> *Flag async operations (API calls, data fetching, location tracking) that do not show a Loading Spinner, ActivityIndicator, or Status Text.*

- **Finding 4.1: Location Monitoring & Re-sorting Operates Privately Without Status Indicator**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\map.tsx` (Lines 425–465)
  - **Snippet**:
    ```tsx
    425: const sub = await Location.watchPositionAsync(..., (loc) => { ... setUserLocation({ latitude, longitude }); });
    ```
  - **Issue**: When the map component mounts or acquires location, if `userLocation` is `null`, the card shows fallback distance ("도보 15분") without informing the user "현재 위치를 찾는 중입니다...".
  - **Recommendation**: Add a small status tag (`<Text>📍 현재 위치 확인 중...</Text>`) or spinner while GPS coordinates resolve.

- **Finding 4.2: Audio Mixing and Asset Resolution Lack Buffer Loading Indicator**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\sound.tsx` (Lines 31–51, 115–125) & `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\lib\services\audio_engine_service.ts` (Lines 169–215)
  - **Snippet**:
    ```tsx
    34: playDynamicMix(waterSource).catch((err) => ...);
    ```
  - **Issue**: `playDynamicMix` asynchronously resolves CDN/local sound files across 4 audio tracks. Switching sound sources in `sound.tsx` exhibits latency while audio loads, but the UI shows no loading spinner or status text ("물소리를 채집하고 있습니다..."), giving the impression of an unresponding UI.
  - **Recommendation**: Expose `isAudioLoading` state from audio service and render an ambient loading wave or spinner.

- **Finding 4.3: Async Storage History Read Causes Flash of Empty State**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\notifications.tsx` (Lines 20–35, 43–47)
  - **Snippet**:
    ```tsx
    21: AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY).then(...)
    43: ListEmptyComponent={<Text>아직 도착한 알림이 없습니다.</Text>}
    ```
  - **Issue**: While `AsyncStorage.getItem` is executing asynchronously, `notifications` is `[]`, displaying "아직 도착한 알림이 없습니다." momentarily even when notifications exist.
  - **Recommendation**: Introduce an `isLoading` state and render an `ActivityIndicator` or skeleton loader during storage read.

- **Finding 4.4: SWR Background Place Cache Revalidation Has No Visual Refresh Indicator**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\core_engine\src\database\local_places.ts` (Lines 38–67)
  - **Snippet**:
    ```tsx
    38: async function revalidateData(): Promise<void> { ... fetch(CDN_URL) ... }
    ```
  - **Issue**: Background revalidation fetches CDN place data without any status update to the UI.
  - **Recommendation**: Provide subtle subtle status text when revalidating ("최신 물길 정보를 동기화하는 중입니다").

---

### [Level 3: Reflective (Trust & Narrative)]

#### 5. Machine Arrogance
> *Flag error messages that blame the user (e.g., "Invalid Input", "Bad request") instead of taking system responsibility with helpful guidance.*

- **Finding 5.1: User-Blaming Input Validation Alert in Map Screen**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\app\(tabs)\map.tsx` (Lines 568–571)
  - **Snippet**:
    ```tsx
    568: if (diaryText.trim().length === 0) {
    569:   Alert.alert('알림', '기록할 내용을 적어주세요.');
    570:   return;
    571: }
    ```
  - **Issue**: Direct command blaming the user ("적어주세요") rather than warm, narrative guidance.
  - **Recommendation**: Rephrase with empathy: `Alert.alert('마음의 소리', '이곳에서의 느낌이나 생각을 한 줄 남겨주시면 조용히 기록해 드릴게요.');`.

- **Finding 5.2: Cold Machine English Copy in Dev/Production Error Boundary**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\components\ErrorFallback.tsx` (Lines 71–77, 90–94)
  - **Snippet**:
    ```tsx
    71: <Text style={styles.title}>Something went wrong</Text>
    75: <Text style={styles.message}>Please reload the app to continue.</Text>
    93: <Text style={styles.buttonText}>Try Again</Text>
    ```
  - **Issue**: Robotic English system message commanding the user to reload ("Please reload the app"), lacking ownership or emotional connection.
  - **Recommendation**: Replace with narrative Korean copy: `Text style={styles.title}>물결이 잠시 흐트러졌어요</Text>`, `Text style={styles.message}>앱을 다시 불러와 평온한 소리를 찾아볼게요.</Text>`.

- **Finding 5.3: Cynical / Dismissive Home Screen Status Message**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\context\RippleContext.tsx` (Line 51)
  - **Snippet**:
    ```tsx
    51: calm: '오늘 날씨 좋은데 굳이 안 나가도 돼요. 창밖 소리나 들으세요.'
    ```
  - **Issue**: Phrasing ("굳이 안 나가도 돼요", "창밖 소리나 들으세요") can sound dismissive or passive-aggressive rather than calming.
  - **Recommendation**: Rephrase to: `'오늘은 창밖 물결 소리와 함께 집에서 편안한 휴식을 취해 보는 것도 좋아요.'`.

- **Finding 5.4: Trivializing Environmental Danger as "Sound is Bad"**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\context\RippleContext.tsx` (Line 56) & `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\lib\services\geofencing_service.ts` (Line 328)
  - **Snippet**:
    ```tsx
    56: const DANGER_MESSAGE = '거긴 소리가 별로네요. 오늘은 위험하니까 다른 데로 가요.';
    ```
  - **Issue**: Describing life-threatening water rise or storm warnings as "소리가 별로네요" (the sound isn't great) trivializes actual environmental hazards.
  - **Recommendation**: Rephrase to maintain narrative warmth while respecting safety urgency: `'이 근처 하천 수위가 높아지고 있어요. 안전을 위해 지금은 다른 물길로 이동해 주세요.'`.

---

#### 6. Black-box Alienation
> *Flag automated background processes (e.g., AI calculation, route calculation, background sync) that do not provide status/progress feedback to the user.*

- **Finding 6.1: Hidden Multi-API Safety Check Process**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\core_engine\src\api.ts` (Lines 55–144) & `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\lib\services\geofencing_service.ts` (Lines 313–348)
  - **Snippet**:
    ```tsx
    315: safetyLevel = await checkGeofenceAndSafety(latitude, longitude);
    ```
  - **Issue**: `checkGeofenceAndSafety` performs real-time queries against KMA weather warnings, wind speeds, and Busan river water level sensors. However, the user is never shown a breakdown or status report of how safety was evaluated.
  - **Recommendation**: On the Safety tab (`safety.tsx`), provide a breakdown section displaying live metric values (e.g. `풍속: 3.2m/s | 수위: 0.4m (정상)`).

- **Finding 6.2: Dynamic Audio Mix Generation Lacks Context Breakdown**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\lib\services\audio_engine_service.ts` (Lines 169–278)
  - **Snippet**:
    ```tsx
    169: export async function playDynamicMix(waterType: string | undefined): Promise<void>
    ```
  - **Issue**: `playDynamicMix` algorithmically selects distinct ambient audio tracks and overlays wind gust volume envelopes in real time. The user is presented only with static tab labels ("시냇물", "강물", "바다") without feedback explaining how wind speed or distance shapes their current audio mix.
  - **Recommendation**: Include a narrative sound badge in `sound.tsx` (e.g. `🍃 현재 바람 세기(2.4m/s)에 맞추어 유기적으로 입혀진 잔물결 소리입니다`).

- **Finding 6.3: Background Location Geofencing State Engine operates as an Opaque Black Box**
  - **Location**: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\lib\services\geofencing_service.ts` (Lines 209–396)
  - **Snippet**:
    ```tsx
    306: if (nextBin !== state.currentBin) { ... }
    ```
  - **Issue**: Adaptive geofencing transitions across 5 discrete bins (`INSIDE`, `NEAR`, `APPROACH`, `FAR`, `OUT_OF_BOUNDS`) based on speed and distance hysteresis. The user has no visibility into their current geofencing zone state until they cross into `INSIDE`.
  - **Recommendation**: Expose `currentBin` in debug/settings or show distance progress towards nearest quiet spot.

---

## Action Plan & Verification Matrix

| Priority | Targeted Component | Proposed Refactoring | Verification Test Method |
|:---:|---|---|---|
| **P0** | `components/ErrorFallback.tsx` | Wrap stack trace in developer accordion; localize fallback text to Korean | Trigger Error Boundary mock; verify UI displays comforting Korean text without raw trace |
| **P0** | `app/+not-found.tsx` | Replace English 404 text with localized brand copy | Navigate to invalid route `/invalid_test`; verify Korean message |
| **P1** | `app/(tabs)/*` | Add `pressed` state styles (`opacity: pressed ? 0.7 : 1`) to all static `Pressables` | Tap buttons on Home, Map, Sound, and Safety tabs; verify visual press feedback |
| **P1** | `app/(tabs)/map.tsx` & `context/RippleContext.tsx` | Add delete/clear functionality with confirmation modal for Diary entries | Create diary entry; verify confirmation modal appears before deletion |
| **P2** | `app/(tabs)/sound.tsx` | Add audio loading status indicator when switching water sources | Switch water source chip; verify loading spinner/status text appears during mix resolution |
| **P2** | `app/(tabs)/safety.tsx` | Expose safety metric breakdown (wind speed, water level) in UI | Toggle safety levels; verify live sensor breakdown card renders |

---

*Report written by Critic 1 (Emotional UX & UI Reviewer).*  
*File Path*: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\critic_1\M3_emotional_ux_audit.md`
