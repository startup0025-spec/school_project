# Handoff Report - Cycle 3 Map & UGC Pivot (Lead Explorer)

## 1. Observation
* **DiaryEntry definition** in `mobile/context/RippleContext.tsx` (lines 17-21):
  ```typescript
  export interface DiaryEntry {
    id: string;
    label: string;
    detail: string;
  }
  ```
* **addDiaryEntry definition** in `mobile/context/RippleContext.tsx` (lines 178-192):
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
* **Geofencing state emission** in `mobile/lib/services/geofencing_service.ts` (line 355):
  ```typescript
  DeviceEventEmitter.emit('onTrackingStateUpdate', state);
  ```
  where the `state` object corresponds to `TrackingState` and contains the `activePlaceId` property.
* **Diary rendering logic** in `mobile/app/(tabs)/diary.tsx` (lines 16-29):
  ```typescript
  const renderItem = ({ item, index }: { item: DiaryEntry; index: number }) => (
    <View style={styles.row}>
      <View style={styles.timelineCol}>
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        {index !== diaryEntries.length - 1 && (
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        )}
      </View>
      <View style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.entryLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
        <Text style={[styles.entryText, { color: colors.foreground }]}>{item.detail}</Text>
      </View>
    </View>
  );
  ```
* **Typecheck script** in `mobile/package.json` (line 10):
  ```json
  "typecheck": "tsc -p tsconfig.json --noEmit"
  ```

---

## 2. Logic Chain
1. **Custom text input & Place association**: 
   Adding `placeId` and `placeName` as optional attributes to the `DiaryEntry` interface allows both new entries (which can bind geofenced/selected place details) and legacy entries to coexist.
2. **addDiaryEntry parameters**:
   Updating `addDiaryEntry` to accept `customText?: string`, `placeId?: string`, and `placeName?: string` guarantees that if they are missing (as in legacy calls or automated logs), the system falls back to `SOURCE_DIARY_DETAIL[waterSource]` and keeps the new fields undefined. This preserves the exact functionality of existing calls without type errors.
3. **Geofenced Place Detection**:
   Since the geofencing background task broadcasts `state` (including `activePlaceId`) via `onTrackingStateUpdate`, we can capture it in `RippleContext` by adding state variables `currentPlaceId` and `currentPlaceName`, and resolving the active place details using `getPlaceById(activePlaceId)` upon receipt of the event or initialization.
4. **Calm UI Integration**:
   By adding a `Modal` overlay containing a multiline `TextInput` and a custom location selector/indicator, users can write reflections and bind places.
5. **Backward Compatibility**:
   In `renderItem`, using `{item.placeName && ...}` conditional rendering ensures that older entries, which lack the new attributes, are rendered cleanly without throwing runtime errors or disrupting the visual timeline structure.

---

## 3. Caveats
* This is a read-only investigation. No source code files outside of `.agents/` have been edited.
* Background geofencing behavior relies on the operating system granting the required background/foreground permissions.

---

## 4. Conclusion
The proposed schema and UI updates are fully backward-compatible, type-safe, and ready for implementation in Cycle 3.

---

## 5. Verification Method
1. Run typecheck via `npm run typecheck` inside the `mobile/` directory to verify there are no TS compiler failures.
2. Add mock data to AsyncStorage representing legacy entries (i.e. entries without `placeId` or `placeName`) and verify that they load and render properly on the `diary.tsx` screen.
3. Verify that the geofencing service emits `activePlaceId` when mock coordinates are provided, updating `currentPlaceId` and `currentPlaceName` in the Context.
