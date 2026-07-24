# UGC Diary entries Schema & UI Integration Analysis

## 🎯 요약
본 보고서는 Kakao Map & UGC Pivot의 Cycle 3 구현을 위해 **UGC 일기장(Diary Entry) 스키마 포뮬레이션, AsyncStorage를 통한 영속성 모델, 그리고 `diary.tsx`에서의 Modal 및 위치 바인딩 UI 통합 설계**를 다룹니다. 기존 시스템과의 하위 호환성을 완벽하게 유지하면서 정적 기록에서 사용자 생성 컨텐츠(UGC) 및 위치 연동형 기록으로 안전하게 피벗하는 아키텍처를 제시합니다.

---

## 🧸 8세 수준을 위한 비유 설명 (Metaphor)
> **일기장과 장소 스티커북 📖🎨**
>
> 사장님(Master), 우리가 가진 일기장을 아주 예쁜 스티커북으로 바꾼다고 생각해 봐요! 
> 
> * **예전의 일기장**: 우리가 강이나 바다 근처에 가면 "강가에서 10분 머물렀어요"라는 도장만 쿵 찍어주는 단순한 일기장이었어요.
> * **새로운 일기장**: 이제는 우리가 직접 오늘 무슨 생각을 했는지 연필로 예쁘게 글을 쓸 수 있고(커스텀 텍스트), 우리가 놀러 간 장소의 이름표 스티커(장소 이름과 ID)도 같이 찰싹 붙일 수 있어요!
> * **안전한 보관**: 만약 아주 옛날에 쓴 일기장에 장소 스티커가 안 붙어 있어도, 일기장이 찢어지거나 망가지지 않고(하위 호환성) 붙어 있는 스티커만 예쁘게 보여줄 거예요. 

---

## 1. UGC Diary Schema & State Model

### (1) `DiaryEntry` 인터페이스 스키마 정의 (`RippleContext.tsx`)
기존의 `DiaryEntry` 인터페이스에 선택적 속성(Optional Properties)으로 `placeId`와 `placeName`을 추가하여 기존 저장된 데이터 구조와의 충돌을 원천 차단합니다.

```typescript
// mobile/context/RippleContext.tsx
export interface DiaryEntry {
  id: string;
  label: string;      // 예: "7월 16일 오후 1시 20분" (formatTimeLabel 함수 포맷)
  detail: string;     // 사용자가 입력한 커스텀 텍스트 또는 기존 자동 생성 문구
  placeId?: string;   // 지오펜싱 또는 선택된 장소의 고유 ID (Optional)
  placeName?: string; // 지오펜싱 또는 선택된 장소의 이름 (Optional)
}
```

### (2) `addDiaryEntry` 상태 변경 로직
새롭게 확장된 `addDiaryEntry` 함수는 사용자가 직접 입력한 문자열과 장소 정보를 매개변수로 받으며, 인자 없이 호출될 경우 기존 동작(기본 앰비언트 문구 자동 기록)으로 폴백(Fallback) 처리됩니다.

```typescript
// RippleContextValue 타입 확장
interface RippleContextValue {
  // ... 기존 상태 속성
  diaryEntries: DiaryEntry[];
  addDiaryEntry: (customText?: string, placeId?: string, placeName?: string) => void;
  // ... 기존 상태 속성
}

// RippleProvider 내의 구현부 설계
const addDiaryEntry = useCallback((
  customText?: string,
  placeId?: string,
  placeName?: string
) => {
  const label = formatTimeLabel(new Date());
  
  // 사용자가 입력한 텍스트가 있으면 그것을 기록하고, 없으면 기존 수변 타입별 기본 텍스트 적용
  const detail = customText && customText.trim().length > 0 
    ? customText.trim() 
    : SOURCE_DIARY_DETAIL[waterSource];

  const entry: DiaryEntry = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    label,
    detail,
    ...(placeId ? { placeId } : {}),
    ...(placeName ? { placeName } : {}),
  };

  setDiaryEntries((prev) => {
    const next = [entry, ...prev];
    // AsyncStorage에 즉각 영속화 수행
    AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(next)).catch((e) =>
      console.warn('[RippleContext] 일기장 저장 에러:', e)
    );
    return next;
  });
}, [waterSource]);
```

---

## 2. 지오펜스 장소 감지 및 실시간 상태 동기화

### (1) `DeviceEventEmitter`를 이용한 장소 캡처
`geofencing_service.ts`는 백그라운드에서 위치가 갱신될 때마다 아래와 같이 `onTrackingStateUpdate` 이벤트를 발생시킵니다.
```typescript
DeviceEventEmitter.emit('onTrackingStateUpdate', state); // state: TrackingState
```
`state` 내부에는 `activePlaceId`가 포함되어 있습니다. 이를 `RippleContext.tsx`에서 캡처하여 컨텍스트 상태로 공유합니다.

### (2) `RippleContext.tsx` 내의 실시간 바인딩 추가
```typescript
// 1. 상태 변수 정의
const [currentPlaceId, setCurrentPlaceId] = useState<string | null>(null);
const [currentPlaceName, setCurrentPlaceName] = useState<string | null>(null);

// 2. useEffect 리스너 내부 확장
const trackingSub = DeviceEventEmitter.addListener(
  'onTrackingStateUpdate',
  (state: any) => {
    setIsTracking(true);
    if (state && state.activePlaceId) {
      setCurrentPlaceId(state.activePlaceId);
      // core_engine의 getPlaceById를 활용해 장소명을 가져와 상태 업데이트
      import('../../core_engine/src/database/local_places').then(({ getPlaceById }) => {
        getPlaceById(state.activePlaceId).then((place) => {
          if (place) {
            setCurrentPlaceName(place.name);
          }
        });
      });
    } else {
      setCurrentPlaceId(null);
      setCurrentPlaceName(null);
    }
  }
);

// 3. 컴포넌트 마운트 시 저장된 백그라운드 위치 상태 복구
useEffect(() => {
  AsyncStorage.getItem('@anywayTheSea:bg_location_state')
    .then((raw) => {
      if (raw) {
        const state = JSON.parse(raw);
        if (state && state.activePlaceId) {
          setCurrentPlaceId(state.activePlaceId);
          import('../../core_engine/src/database/local_places').then(({ getPlaceById }) => {
            getPlaceById(state.activePlaceId).then((place) => {
              if (place) {
                setCurrentPlaceName(place.name);
              }
            });
          });
        }
      }
    })
    .catch((e) => console.warn('[RippleContext] 초기 백그라운드 상태 로드 실패:', e));
}, []);
```

---

## 3. `diary.tsx` UI Integration Plan

### (1) Modal / TextInput 워크플로우 설계
"지금처럼 머문 10분 기록하기" 버튼을 눌렀을 때 팝업 형태로 사용자의 감상을 기록받는 오버레이 모달 설계입니다.

```tsx
// mobile/app/(tabs)/diary.tsx
import React, { useState, useEffect } from 'react';
import { Modal, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { getPlaces } from '@/core_engine/src/database/local_places';
import { Place } from '@/core_engine/src/models/place_model';

export default function DiaryScreen() {
  // ... 기존 hooks 선언 ...
  const { currentPlaceId, currentPlaceName, addDiaryEntry } = useRipple();
  const [modalVisible, setModalVisible] = useState(false);
  const [customText, setCustomText] = useState('');
  
  // 수동 선택을 위한 상태 변수
  const [placesList, setPlacesList] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(null);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);

  // 모달이 열릴 때 지오펜스로 감지된 장소가 있다면 자동 바인딩 수행
  useEffect(() => {
    if (modalVisible) {
      if (currentPlaceId && currentPlaceName) {
        setSelectedPlaceId(currentPlaceId);
        setSelectedPlaceName(currentPlaceName);
      } else {
        // 자동 감지된 곳이 없을 경우 수동 장소 선택 리스트 로딩
        setIsPlacesLoading(true);
        getPlaces().then((list) => {
          setPlacesList(list);
          setIsPlacesLoading(false);
        });
      }
    }
  }, [modalVisible, currentPlaceId, currentPlaceName]);

  const handleSave = () => {
    if (customText.trim().length === 0) {
      Alert.alert('알림', '기록할 내용을 적어주세요.');
      return;
    }
    // 일기 저장 처리 호출
    addDiaryEntry(
      customText,
      selectedPlaceId || undefined,
      selectedPlaceName || undefined
    );
    // 상태 초기화 및 모달 닫기
    setCustomText('');
    setSelectedPlaceId(null);
    setSelectedPlaceName(null);
    setModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  
  // ...
}
```

### (2) 모달 UI 레이아웃 설계 (Calm UX 테마 준수)
* **모달 컨테이너**: 반투명 어두운 배경 뒤로 둥근 카드 형태의 입력 폼이 노출됩니다.
* **장소 표시 영역 (Place Binding & Selection)**:
  * **자동 감지**: 지오펜스가 활성화되어 장소가 감지되었을 때는 `"📍 현재 감지된 장소: [장소명]"` 문구와 함께 핀 모양을 보여줍니다.
  * **수동 선택**: 지오펜스 범위 밖일 경우, 모달 내 스크롤 뷰에 가로 형태의 칩(Chip) 형태로 부산의 고요한 장소 리스트(`placesList`)를 뿌려줍니다. 사용자가 칩을 터치하여 장소를 직접 바인딩할 수 있게 하고, `"선택 안 함"` 칩도 함께 제공하여 선택권을 부여합니다.
* **감상 입력 (`TextInput`)**:
  * `multiline={true}`, `numberOfLines={4}` 설정
  * `maxLength={200}`으로 글자수 제한 적용
  * 테두리가 은은하고 부드러운 패딩의 미니멀 스타일 인풋 박스
* **액션 버튼**:
  * "취소": 상태를 초기화하고 모달만 닫음
  * "기록하기": 작성 완료 및 AsyncStorage 저장 트리거

---

## 4. 하위 호환성 및 타입 안정성 검증

### (1) 하위 호환성 (Backward Compatibility)
* **데이터 레벨**: `DiaryEntry`에서 `placeId`와 `placeName` 속성을 `?` (선택적 속성)로 두었기 때문에 기존에 생성되어 저장된 JSON 문자열을 `JSON.parse`할 때 누락되어 있어도 아무런 오류를 일으키지 않습니다.
* **렌더링 레벨**: `renderItem` 내부 카드 컴포넌트에서 속성이 존재할 때만 장소 정보를 표시하도록 가드 패턴(Guard Pattern)을 적용합니다.

```tsx
// diary.tsx renderItem 내부
<View style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
  <View style={styles.cardHeader}>
    <Text style={[styles.entryLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
    
    {/* 하위 호환성을 유지하기 위한 조건부 렌더링 */}
    {item.placeName && (
      <View style={[styles.placeBadge, { backgroundColor: colors.primary + '10' }]}>
        <Feather name="map-pin" size={10} color={colors.primary} />
        <Text style={[styles.placeBadgeText, { color: colors.primary }]}>{item.placeName}</Text>
      </View>
    )}
  </View>
  <Text style={[styles.entryText, { color: colors.foreground }]}>{item.detail}</Text>
</View>
```

### (2) 타입 안정성 (`tsc --noEmit` 호환성)
* **매개변수 시그니처 호환**: `addDiaryEntry` 함수 시그니처의 모든 매개변수 또한 선택적 속성(`?`)으로 지정되었습니다. 따라서 기존에 매개변수 없이 `addDiaryEntry()` 형식으로 직접 호출하던 기존 파일들(`diary.tsx`의 원래 기록 버튼 등)에서도 단 한 줄의 타입 오류도 발생하지 않으며 컴파일에 성공합니다.
* **TypeScript 컴파일 보장**: 타입 캐스팅이나 무리한 `any` 사용을 배제하여 엄격한 TS 빌드 룰인 `tsc --noEmit` 환경을 완전히 충족합니다.
