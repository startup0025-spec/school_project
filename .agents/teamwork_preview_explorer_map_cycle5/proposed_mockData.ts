import type { WaterSource } from '@/context/RippleContext';
import { Place } from '@/core_engine/src/models/place_model';

export interface NotificationItem {
  id: string;
  time: string;
  text: string;
}

/**
 * A quiet history of past one-line nudges — separate from the single live
 * message shown on the home screen, which reacts to the current simulated
 * state instead.
 */
export const NOTIFICATION_HISTORY: NotificationItem[] = [
  {
    id: 'n1',
    time: '오늘 오후 2:14',
    text: '오늘 날씨 좋은데 굳이 안 나가도 돼요. 창밖 소리나 들으세요.',
  },
  {
    id: 'n2',
    time: '오늘 오전 11:02',
    text: '지금 소리 들리죠? 근처에 하천이 있어서 제가 소리를 조금 가져와 봤어요.',
  },
  {
    id: 'n3',
    time: '어제 오후 6:47',
    text: '지금 해운대는 너무 붐벼요. 그냥 집 근처 시냇가에서 발이나 담그는 게 어때요?',
  },
  {
    id: 'n4',
    time: '어제 오후 1:30',
    text: '거긴 소리가 별로네요. 오늘은 위험하니까 다른 데로 가요.',
  },
  {
    id: 'n5',
    time: '그저께 오전 9:15',
    text: '오늘은 유독 조용하네요. 창문 좀 열어두는 것도 좋을 것 같아요.',
  },
];

export interface QuietSpot extends Place {
  /** The walking time description (e.g. '도보 12분') - retained for mock backward compatibility */
  walk: string;
}

export const QUIET_SPOTS: QuietSpot[] = [
  {
    id: 's1',
    name: '수성천 산책로',
    description: '여기 지금 사람 아무도 없대요. 혹시 근처면 그냥 한 번 가보든가요.',
    walk: '도보 12분',
    latitude: 35.2031, // 세월교 (수영강)
    longitude: 129.1198,
    waterType: 'river',
    geofenceRadius: 4000,
    district: '해운대구',
    waterStationName: '세월교'
  },
  {
    id: 's2',
    name: '온천천 하류길',
    description: '오늘은 물소리가 유독 좋대요. 잠깐 들러도 괜찮을 것 같아요.',
    walk: '도보 18분',
    latitude: 35.1978, // 세병교 (온천천)
    longitude: 129.0837,
    waterType: 'river',
    geofenceRadius: 3000,
    district: '연제구',
    waterStationName: '세병교'
  },
  {
    id: 's3',
    name: '장전천 벤치',
    description: '사람도 없고 그늘도 있어서 앉아있기 딱 좋대요.',
    walk: '도보 9분',
    latitude: 35.2318, // 부곡교 (온천천/장전천 인근)
    longitude: 129.0843,
    waterType: 'stream',
    geofenceRadius: 3000,
    district: '금정구',
    waterStationName: '부곡교'
  },
];

export const WATER_SOURCE_LABELS: Record<WaterSource, { label: string; description: string }> = {
  stream: {
    label: '시냇물',
    description: '동네 시냇가를 걷고 있어요. 졸졸 흐르는 소리가 들려요.',
  },
  river: {
    label: '강물',
    description: '강을 따라 걷고 있어요. 소리가 조금 더 넓어졌어요.',
  },
  sea: {
    label: '바다',
    description: '바닷가 근처예요. 파도 소리로 스르륵 바뀌었어요.',
  },
};

export const DEFAULT_FALLBACKS: Record<string, any> = {
  // 기상청 단기예보 조회 서비스 (단기예보) - WSD (풍속: 2.0 m/s), TMP (기온: 22도) 등 기본값
  kma_forecast: {
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
      body: {
        items: {
          item: [
            { category: 'WSD', fcstValue: '2.0' },
            { category: 'TMP', fcstValue: '22' },
          ],
        },
      },
    },
  },
  // 기상청 기상특보 조회 서비스 (특보 없음 상태)
  kma_warning: {
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' },
      body: {
        items: {
          item: [],
        },
      },
    },
  },
  // 부산광역시 주요 하천 수위 API (정상 범위 수위)
  busan_water_level: {
    WaterLevelList: {
      row: [
        { stationName: '온천천', waterLevel: '0.4' },
        { stationName: '수영강', waterLevel: '0.3' },
      ],
    },
  },
  // 부산광역시 하천 수질 자동측정망 API (정상 수온/탁도)
  busan_water_quality: {
    WaterQualityList: {
      row: [
        { stationName: '온천천', waterTemp: '20.0', turbidity: '1.2' },
        { stationName: '수영강', waterTemp: '19.5', turbidity: '1.5' },
      ],
    },
  },
};

/**
 * Returns safe default mock responses based on URL match patterns
 *
 * > DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
 */
export function getFallbackData(url: string = ''): any {
  if (url.includes('/getUltraSrtFcst') || url.includes('/getVilageFcst')) {
    return DEFAULT_FALLBACKS.kma_forecast;
  }
  if (url.includes('/getWthrWrnList')) {
    return DEFAULT_FALLBACKS.kma_warning;
  }
  if (url.includes('/getWaterLevel') || url.includes('/getRvrwtLevelInfo')) {
    return DEFAULT_FALLBACKS.busan_water_level;
  }
  if (url.includes('/getWaterQuality') || url.includes('/getRiverQualityStation')) {
    return DEFAULT_FALLBACKS.busan_water_quality;
  }
  return { data: null };
}
