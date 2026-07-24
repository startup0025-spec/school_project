# Milestone 3: Universal 3-Layer Emotional UX Audit Report

**Target Codebase**: `Anyway_the_Sea/mobile/app/(tabs)` & `notifications.tsx`  
**Auditor**: BERRY 🍎 (`teamwork_preview_critic`)  
**Audit Date**: 2026-07-24  
**Target Platforms**: iOS, Android, Web  

---

## Executive Summary

This report delivers the comprehensive Milestone 3 Universal 3-Layer Emotional UX Audit for the *Anyway_the_Sea* mobile application across iOS, Android, and Web platforms. The audit examines six core screen components against the 3-Layer Emotional UX framework:
1. **Visceral (Gut Reaction / Visuals)**: Raw unhandled errors, missing hover/press states, visual rendering lag/jumps across platforms.
2. **Behavioral (Usability & Friction)**: Destructive actions lacking confirmation/undo, state blindness during async operations (loading spinners/skeletons).
3. **Reflective (Trust & Narrative)**: Machine arrogance (user-blaming error messages), black-box alienation (lack of progress logs & system narrative).

Findings are categorized into **Demo Deployment Risks** (issues that degrade immediate presentation in a contest/demo setup) and **Production Deployment Risks** (issues that impact long-term user retention, accessibility, and platform stability).

---

## Audit Findings Matrix by Screen & UX Layer

### 1. `mobile/app/(tabs)/index.tsx` (Home Screen)

#### [Visceral Layer]
- **Finding 1.1: Missing Active Press Feedback & Web Hover Cursor on Primary Header Controls**
  - **File & Line**: `mobile/app/(tabs)/index.tsx:49-55`, `mobile/app/(tabs)/index.tsx:85-91`
  - **Description**: The notification bell `Pressable` (`notifications-button`) and the banner dismiss `Pressable` (`dismiss-banner`) use flat inline styles without pressed state styling (`({ pressed }) => [...]`) or Web hover styling (`cursor: 'pointer'`). On Web and Android, tapping or hovering over these controls yields zero visual tactile response, creating a "dead element" gut reaction.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: High (Web/Desktop preview feels unresponsive to click interactions).
    - **Production Deployment Risk**: Medium (Violates mobile accessibility & visual feedback guidelines).

#### [Behavioral Layer]
- **Finding 1.2: State Blindness & Initial Banner Flash on Startup**
  - **File & Line**: `mobile/app/(tabs)/index.tsx:26-31`, `mobile/app/(tabs)/index.tsx:69-93`
  - **Description**: `currentMessage` and `orbMode` are consumed directly from `useRipple()`. When the app first mounts or when background location/weather data resolves asynchronously, `currentMessage` initializes with default text and then abruptly updates, causing the top alert banner to pop in and jump the layout without a skeleton loader or smooth entrance animation.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: High (Visible layout shift upon launching app during demo presentation).
    - **Production Deployment Risk**: Low.

#### [Reflective Layer]
- **Finding 1.3: Black-Box Alienation on Safety Banner Status**
  - **File & Line**: `mobile/app/(tabs)/index.tsx:69-93`
  - **Description**: The safety warning banner displays static copy without indicating why or when the safety level changed (e.g., missing "Updated 2m ago based on Busan weather data"). Users cannot verify system credibility.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Low.
    - **Production Deployment Risk**: High (Reduces trust in safety alert accuracy).

---

### 2. `mobile/app/(tabs)/map.tsx` (Quiet Places Map Screen)

#### [Visceral Layer]
- **Finding 2.1: Missing Press Feedback & Web Pointer States on Card Action Controls**
  - **File & Line**: `mobile/app/(tabs)/map.tsx:652`, `mobile/app/(tabs)/map.tsx:656`, `mobile/app/(tabs)/map.tsx:660`, `mobile/app/(tabs)/map.tsx:695`, `mobile/app/(tabs)/map.tsx:698`
  - **Description**: Action buttons (`기록하기`, `길찾기`, `refreshButton`, modal cancel/save) lack pressed state feedback (`({ pressed }) => ...`) and hover pointer cursor (`cursor: 'pointer'` for Web). Touch feedback feels static and sluggish.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Medium.
    - **Production Deployment Risk**: Medium.

- **Finding 2.2: Abrupt Fallback Image Jump & Incomplete Web Platform Compatibility**
  - **File & Line**: `mobile/app/(tabs)/map.tsx:581-595`
  - **Description**: When Kakao Map SDK load fails (`isSdkFailed`), the screen switches abruptly to a static fallback image (`quiet-map.png`) without a smooth fade transition or a manual "Retry Connection" button. Furthermore, on Web browsers (`Platform.OS === 'web'`), `react-native-webview` renders an unsupported fallback iframe, leading to potential blank screen rendering.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Critical (Web demo fails completely if WebGL/WebView iframe is blocked or key missing).
    - **Production Deployment Risk**: Critical.

#### [Behavioral Layer]
- **Finding 2.3: State Blindness & Card Layout Jump on Location Resolution**
  - **File & Line**: `mobile/app/(tabs)/map.tsx:356-391`, `mobile/app/(tabs)/map.tsx:660-670`
  - **Description**: Initial loading of quiet spots (`getPlaces()`) displays the first mock spot (`QUIET_SPOTS[0]`) immediately, then abruptly jumps to distance-sorted place #0 once background location resolves. Tapping the refresh button (`setIndex`) switches spot details instantly with no loading spinner or transition effect.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: High (Layout pop-in during live demonstration).
    - **Production Deployment Risk**: Medium.

- **Finding 2.4: Destructive Modal Dismissal without Confirmation Modal**
  - **File & Line**: `mobile/app/(tabs)/map.tsx:674-704`
  - **Description**: In the "기록하기" modal, if a user types a multi-line reflection and accidentally taps outside the modal or taps `취소` (Line 695), the input text is instantly wiped without an "Are you sure you want to discard your draft?" confirmation dialog.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Low.
    - **Production Deployment Risk**: High (Causes user frustration and data loss).

#### [Reflective Layer]
- **Finding 2.5: User-Blaming Language ("Machine Arrogance") on SDK / Offline Errors**
  - **File & Line**: `mobile/app/(tabs)/map.tsx:588`
  - **Description**: The offline fallback banner text states `"지도 기능을 이용하려면 네트워크 연결을 확인해 주세요."`. This places full blame on the user's network connection, even when the underlying failure is caused by Kakao Map JS SDK API key restriction, domain whitelist mismatch, or script loading timeout.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Medium.
    - **Production Deployment Risk**: High (Erodes user confidence in app reliability).

- **Finding 2.6: Black-Box Alienation in Dynamic Distance & Re-sorting Engine**
  - **File & Line**: `mobile/app/(tabs)/map.tsx:443-456`
  - **Description**: Background position watcher re-sorts spots on a 3-minute cooldown. The UI provides no status indicator (e.g. "Sorting by distance from your current location") or progress log when re-sorting occurs, leaving users confused when spot order changes silently.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Low.
    - **Production Deployment Risk**: Medium.

---

### 3. `mobile/app/(tabs)/sound.tsx` (Ambient Sound Screen)

#### [Visceral Layer]
- **Finding 3.1: Stiff Touch Controls & Missing Hover Feedback on Sound Source Chips**
  - **File & Line**: `mobile/app/(tabs)/sound.tsx:85-104`, `mobile/app/(tabs)/sound.tsx:115-126`
  - **Description**: Water source selection chips (`시냇물`, `강물`, `바다`) and the play toggle button use unstyled `Pressable` components. Hover states for Web (`cursor: 'pointer'`) and press states are missing.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Medium.
    - **Production Deployment Risk**: Medium.

- **Finding 3.2: Unhandled Audio Rejections & Desynchronized Waveform Animation**
  - **File & Line**: `mobile/app/(tabs)/sound.tsx:34-36`, `mobile/app/(tabs)/sound.tsx:42-44`, `mobile/app/(tabs)/sound.tsx:47-49`
  - **Description**: Async audio playback promises (`playDynamicMix`, `stopAmbientSound`) catch errors via `console.warn` without updating UI state. If audio loading fails or is blocked by browser autoplay policies, the `WaveformVisualizer` continues animating in `flow` mode while no sound plays.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Critical (Visualizer animates waves while total silence plays during Web demo).
    - **Production Deployment Risk**: High.

#### [Behavioral Layer]
- **Finding 3.3: State Blindness & Web Autoplay Friction**
  - **File & Line**: `mobile/app/(tabs)/sound.tsx:31-51`, `mobile/app/(tabs)/sound.tsx:87-92`
  - **Description**: Switching water sources (`setWaterSource`) initiates audio buffer loading/mixing asynchronously without displaying a loading spinner or status text ("소리 불러오는 중..."). On Web browsers (Chrome/Safari), mounting `SoundScreen` triggers immediate auto-play which is blocked by browser policy without prompting a "Tap to play audio" gesture banner.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: High (Web preview silent due to browser autoplay restriction).
    - **Production Deployment Risk**: High.

#### [Reflective Layer]
- **Finding 3.4: Black-Box Alienation on Audio Engine Background Service**
  - **File & Line**: `mobile/app/(tabs)/sound.tsx:108-114`
  - **Description**: Notice text claims `"화면을 꺼도 소리는 계속 흘러요" / "이동하면 소리가 자연스럽게 섞여요"`, but provides zero indicator showing active background audio service status, volume mix levels, or buffer status.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Low.
    - **Production Deployment Risk**: Medium.

---

### 4. `mobile/app/(tabs)/diary.tsx` (Diary History Screen)

#### [Visceral Layer]
- **Finding 4.1: Static Non-Interactive Entry Cards & Absence of Touch Feedback**
  - **File & Line**: `mobile/app/(tabs)/diary.tsx:20-41`
  - **Description**: Timeline cards (`entryCard`) are completely static text containers. There is no press feedback, expansion animation, or detail view when a user taps on a diary entry card.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Low.
    - **Production Deployment Risk**: Medium (Expectation of card interactivity is unfulfilled).

#### [Behavioral Layer]
- **Finding 4.2: Lack of Entry Deletion / Editing Capability & Flash on Load**
  - **File & Line**: `mobile/app/(tabs)/diary.tsx:20-41`, `mobile/app/(tabs)/diary.tsx:53-69`
  - **Description**: Diary entries stored in local state/AsyncStorage cannot be deleted or edited from the UI. If a user writes a test entry, it remains stuck forever. Furthermore, on app launch, `diaryEntries` initializes as `[]`, causing the empty view ("아직 조용히 머문 기록이 없어요") to flash briefly before items populate asynchronously (Layout Shift).
  - **Risk Categorization**:
    - **Demo Deployment Risk**: High (Empty state flickering during startup demo).
    - **Production Deployment Risk**: High (Inability to delete test notes).

#### [Reflective Layer]
- **Finding 4.3: Black-Box Alienation of Storage & Sync Status**
  - **File & Line**: `mobile/app/(tabs)/diary.tsx:50-52`
  - **Description**: The screen title describes "흔적 없는 기록", but does not provide clear feedback regarding local device storage status (e.g. "Stored safely on-device").
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Low.
    - **Production Deployment Risk**: Low.

---

### 5. `mobile/app/(tabs)/safety.tsx` (Safety Guard Screen)

#### [Visceral Layer]
- **Finding 5.1: Missing Active Press Feedback on Action Button**
  - **File & Line**: `mobile/app/(tabs)/safety.tsx:54-61`
  - **Description**: The `warningAction` button (`다른 곳 보기`) lacks pressed opacity state and Web hover cursor (`cursor: 'pointer'`).
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Medium.
    - **Production Deployment Risk**: Low.

#### [Behavioral Layer]
- **Finding 5.2: State Blindness & Absence of Live Sensor Progress Logs**
  - **File & Line**: `mobile/app/(tabs)/safety.tsx:64-70`
  - **Description**: Text asserts `"수위와 경보 상태를 조용히 지켜보고 있어요"`, but does not display any live sensor telemetry, last weather sync timestamp, or activity loading indicator.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Medium.
    - **Production Deployment Risk**: High (Users cannot verify if safety monitoring is active).

#### [Reflective Layer]
- **Finding 5.3: Informal Warning Language ("Machine Arrogance / Casual Dismissal")**
  - **File & Line**: `mobile/app/(tabs)/safety.tsx:51-53`
  - **Description**: Warning text states `"거긴 소리가 별로네요. 오늘은 위험하니까 다른 데로 가요."`. Using subjective informal terms ("소리가 별로네요") for a safety guard screen undermines system authority and narrative trust compared to objective hazard messaging.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: High (Reduces perceived quality during contest judging).
    - **Production Deployment Risk**: High.

---

### 6. `mobile/app/notifications.tsx` (Notifications Screen)

#### [Visceral Layer]
- **Finding 6.1: Flash of Empty State during AsyncStorage Read**
  - **File & Line**: `mobile/app/notifications.tsx:20-35`, `mobile/app/notifications.tsx:43-47`
  - **Description**: `AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY)` runs asynchronously. Before the promise resolves, `notifications` is `[]`, causing the empty view ("아직 도착한 알림이 없습니다.") to flash on screen before notifications render.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: High (Flicker on entering notifications screen).
    - **Production Deployment Risk**: Low.

#### [Behavioral Layer]
- **Finding 6.2: Static Non-Interactive Items & Lack of Notification Management**
  - **File & Line**: `mobile/app/notifications.tsx:50-60`
  - **Description**: Notification items cannot be tapped, marked as read, or cleared. There is no clear-all button.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Low.
    - **Production Deployment Risk**: Medium.

#### [Reflective Layer]
- **Finding 6.3: Black-Box Alienation on Sync Status**
  - **File & Line**: `mobile/app/notifications.tsx:37-61`
  - **Description**: No status text indicates when notifications were last synchronized or received from background geofence services.
  - **Risk Categorization**:
    - **Demo Deployment Risk**: Low.
    - **Production Deployment Risk**: Medium.

---

## Actionable Recommendations & Prioritized Mitigation Matrix

| Priority | Screen | Issue | Recommended Fix | Impacted Risk |
| :--- | :--- | :--- | :--- | :--- |
| **P0 (Critical)** | `sound.tsx` | Unhandled audio rejections & silent animation on Web | Add `.catch()` handler that pauses visualizer and displays "소리 재생을 위해 터치하세요" banner for Web autoplay policy compliance. | Demo & Production |
| **P0 (Critical)** | `map.tsx` | WebView SDK failure jump & Web iframe incompatibility | Implement smooth fade transition for `isSdkFailed` and add an explicit "지도 새로고침" retry button. Ensure Web fallback component renders cleanly. | Demo & Production |
| **P1 (High)** | All Screens | Missing press/hover feedback on `Pressable` components | Wrap pressable styles with `({ pressed }) => [style, pressed && { opacity: 0.7 }]` and add `{ cursor: 'pointer' }` for Web. | Demo & Production |
| **P1 (High)** | `map.tsx` | Destructive modal cancellation without prompt | Add `Alert.alert('기록 취소', '작성 중인 내용을 파기하시겠습니까?', ...)` before closing diary modal. | Production |
| **P1 (High)** | `diary.tsx`, `notifications.tsx`, `map.tsx` | Layout jump on initial storage / location load | Add a subtle ActivityIndicator or Skeleton loader while initial async data resolves. | Demo |
| **P2 (Medium)** | `safety.tsx` | Informal safety message ("소리가 별로네요") | Replace with objective system narrative: "수위 상승 및 안전 경보가 발령되었습니다. 조용한 다른 장소로 이동을 권장합니다." | Demo & Production |

---

*Report compiled by BERRY 🍎 — Milestone 3 Universal 3-Layer Emotional UX Audit Complete.*
