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

export const QUIET_SPOTS: QuietSpot[] = [];

export const WATER_SOURCE_LABELS: Record<WaterSource, { label: string; description: string }> = {
  sea: {
    label: '연안',
    description: '바닷가 근처예요. 파도 소리가 깊고 넓게 스르륵 밀려와요.',
  },
  national_river: {
    label: '국가하천',
    description: '웅장하고 커다란 강물을 따라 걷고 있어요. 묵직하고 넓은 물소리가 들려요.',
  },
  lake: {
    label: '호소',
    description: '고요하고 평화로운 호수 가에 서 있어요. 잔잔한 물결 소리가 들려요.',
  },
  local_river: {
    label: '지방하천',
    description: '도심 속 하천 산책로를 걷고 있어요. 물길이 활기차게 흘러가요.',
  },
  stream: {
    label: '세천',
    description: '작은 세천을 지나고 있어요. 졸졸 맑게 흐르는 도랑물 소리가 정겨워요.',
  },
  river: {
    label: '강물',
    description: '강을 따라 걷고 있어요. 소리가 조금 더 넓어졌어요.',
  },
};

export const DEFAULT_FALLBACKS: Record<string, unknown> = {
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
  busan_water_level: {
    WaterLevelList: {
      row: [
        { stationName: '온천천', waterLevel: '0.4' },
        { stationName: '수영강', waterLevel: '0.3' },
      ],
    },
  },
  busan_water_quality: {
    WaterQualityList: {
      row: [
        { stationName: '온천천', waterTemp: '20.0', turbidity: '1.2' },
        { stationName: '수영강', waterTemp: '19.5', turbidity: '1.5' },
      ],
    },
  },
};

export function getFallbackData(url: string = ''): unknown {
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
