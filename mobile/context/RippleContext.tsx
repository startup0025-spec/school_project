import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Movement = 'calm' | 'walking' | 'busy';
export type WaterSource = 'sea' | 'national_river' | 'lake' | 'local_river' | 'stream' | 'river';
export type SafetyLevel = 'safe' | 'warning' | 'danger';
export type OrbMode = 'calm' | 'walking' | 'busy' | 'danger';

export interface DiaryEntry {
  id: string;
  label: string;
  detail: string;
  placeId?: string;
  placeName?: string;
  customText?: string;
}

interface RippleContextValue {
  movement: Movement;
  setMovement: (movement: Movement) => void;
  waterSource: WaterSource;
  setWaterSource: (source: WaterSource) => void;
  safetyLevel: SafetyLevel;
  setSafetyLevel: (level: SafetyLevel) => void;
  currentMessage: string;
  diaryEntries: DiaryEntry[];
  addDiaryEntry: (customText?: string, placeId?: string, placeName?: string) => void;
  
  // 실시간 상태 업데이트를 위한 추가 명세
  isTracking: boolean;
  setIsTracking: (tracking: boolean) => void;
  orbMode: OrbMode;
  engineMessage: string | null;
  rawSpeedMps: number;
}

const RippleContext = createContext<RippleContextValue | undefined>(undefined);

const MOVEMENT_MESSAGES: Record<Movement, string> = {
  calm: '오늘 날씨 좋은데 굳이 안 나가도 돼요. 창밖 소리나 들으세요.',
  walking: '지금 소리 들리죠? 근처에 하천이 있어서 제가 소리를 조금 가져와 봤어요.',
  busy: '지금 해운대는 너무 붐벼요. 그냥 집 근처 시냇가에서 발이나 담그는 게 어때요?',
};

const DANGER_MESSAGE = '거긴 소리가 별로네요. 오늘은 위험하니까 다른 데로 가요.';
const WARNING_MESSAGE = '수위가 상승 중입니다. 하천 접근에 각별히 주의하세요.';



const DIARY_STORAGE_KEY = '@anywayTheSea:diary_entries';
const INITIAL_DIARY: DiaryEntry[] = [];

function formatTimeLabel(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const isAfternoon = date.getHours() >= 12;
  const hour12 = ((date.getHours() + 11) % 12) + 1;
  const minute = date.getMinutes();
  return `${month}월 ${day}일 ${isAfternoon ? '오후' : '오전'} ${hour12}시 ${minute}분`;
}

// OrbMode를 결정하는 단일 순수 맵핑 헬퍼 함수
function resolveOrbMode(
  sLevel: SafetyLevel,
  move: Movement,
  tracking: boolean
): OrbMode {
  if (!tracking) {
    // 트래킹이 비활성화된 상태에서는 기본 UI 시뮬레이션을 위해 movement를 그대로 반환
    return move;
  }
  if (sLevel === 'danger') return 'danger';
  if (sLevel === 'warning') return 'busy'; // warning 등급은 시각적 요동을 위해 busy로 브릿징
  return move;
}

export function RippleProvider({ children }: { children: React.ReactNode }) {
  const [movement, setMovement] = useState<Movement>('calm');
  const [waterSource, setWaterSource] = useState<WaterSource>('stream');
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>('safe');
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(INITIAL_DIARY);
  
  // 실시간 상태 관리 변수 추가
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [engineMessage, setEngineMessage] = useState<string | null>(null);
  const [rawSpeedMps, setRawSpeedMps] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // 일기장 스토리지 초기 로드
  useEffect(() => {
    AsyncStorage.getItem(DIARY_STORAGE_KEY)
      .then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              setDiaryEntries(parsed);
            }
          } catch (e) {
            console.warn('[RippleContext] 일기 데이터 파싱 실패:', e);
          }
        }
        setIsLoaded(true);
      })
      .catch((e) => {
        console.warn('[RippleContext] 일기장 로드 에러:', e);
        setIsLoaded(true);
      });
  }, []);

  // 3대 백그라운드 이벤트 리스너 통합 등록
  useEffect(() => {
    // 1. 위험/경고 상태 감지
    const dangerSub = DeviceEventEmitter.addListener(
      'onSafetyDanger',
      (data: { level: 'DANGER' | 'WARNING'; message: string }) => {
        if (data.level === 'DANGER') {
          setSafetyLevel('danger');
        } else if (data.level === 'WARNING') {
          setSafetyLevel('warning');
        }
        if (data.message) {
          setEngineMessage(data.message);
        }
      }
    );

    // 2. 안전/정상 상태 복구 감지
    const safeSub = DeviceEventEmitter.addListener(
      'onSafetySafe',
      (data?: { message?: string }) => {
        setSafetyLevel('safe');
        if (data?.message) {
          setEngineMessage(data.message);
        } else {
          setEngineMessage(null);
        }
      }
    );

    // 3. 지오펜싱 트래킹 동작 상태 변경 감지
    const trackingSub = DeviceEventEmitter.addListener(
      'onTrackingStateUpdate',
      (data: { isTracking?: boolean; state?: Record<string, unknown>; waterType?: WaterSource; rawSpeedMps?: number }) => {
        setIsTracking(data?.isTracking ?? false);
        if (data?.rawSpeedMps !== undefined) {
          setRawSpeedMps(data.rawSpeedMps);
        }
        if (data?.state?.currentSpeedClass) {
          const speed = data.state.currentSpeedClass;
          if (speed === 'STATIONARY') setMovement('calm');
          else if (speed === 'WALKING') setMovement('walking');
          else setMovement('busy');
        }
        if (data?.waterType) {
          setWaterSource(data.waterType);
        }
      }
    );

    return () => {
      dangerSub.remove();
      safeSub.remove();
      trackingSub.remove();
    };
  }, []);

  // 단일 통합 orbMode 계산
  const orbMode = useMemo<OrbMode>(() => {
    return resolveOrbMode(safetyLevel, movement, isTracking);
  }, [safetyLevel, movement, isTracking]);

  const currentMessage = useMemo(() => {
    if (engineMessage) return engineMessage;
    if (safetyLevel === 'danger') return DANGER_MESSAGE;
    if (safetyLevel === 'warning') return WARNING_MESSAGE;
    return MOVEMENT_MESSAGES[movement];
  }, [movement, safetyLevel, engineMessage]);

  // UI 수동 제어 시 엔진 실시간 메시지 초기화
  const handleSetSafetyLevel = useCallback((level: SafetyLevel) => {
    setSafetyLevel(level);
    setEngineMessage(null);
  }, []);

  const addDiaryEntry = useCallback((customText?: string, placeId?: string, placeName?: string) => {
    const label = formatTimeLabel(new Date());
    const entry: DiaryEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      label,
      detail: customText || '',
      placeId,
      placeName,
      customText,
    };
    setDiaryEntries((prev) => [entry, ...prev]);
  }, [waterSource]);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(diaryEntries)).catch((e) =>
      console.warn('[RippleContext] 일기장 저장 에러:', e)
    );
  }, [diaryEntries, isLoaded]);

  const value = useMemo<RippleContextValue>(
    () => ({
      movement,
      setMovement,
      waterSource,
      setWaterSource,
      safetyLevel,
      setSafetyLevel: handleSetSafetyLevel,
      currentMessage,
      diaryEntries,
      addDiaryEntry,
      
      // 실시간 데이터 바인딩 노출
      isTracking,
      setIsTracking,
      orbMode,
      engineMessage,
      rawSpeedMps,
    }),
    [
      movement,
      waterSource,
      safetyLevel,
      handleSetSafetyLevel,
      currentMessage,
      diaryEntries,
      addDiaryEntry,
      isTracking,
      orbMode,
      engineMessage,
      rawSpeedMps,
    ]
  );

  return <RippleContext.Provider value={value}>{children}</RippleContext.Provider>;
}

export function useRipple(): RippleContextValue {
  const ctx = useContext(RippleContext);
  if (!ctx) {
    throw new Error('useRipple must be used within a RippleProvider');
  }
  return ctx;
}
