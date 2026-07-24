import { client } from './client';
import { getAPIKeys } from '../config/api_keys';

export interface ForecastItem {
  category: string;
  fcstValue: string;
  baseDate: string;
  baseTime: string;
  nx: number;
  ny: number;
}

export interface KMAResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body?: {
      dataType: string;
      items: {
        item: ForecastItem[];
      };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

/**
 * Fetches the KMA Ultra Short Forecast.
 * Zero error checking locally — fully transparent cache & fallback execution.
 */
export const fetchUltraShortForecast = async (
  baseDate: string,
  baseTime: string,
  nx: number,
  ny: number
): Promise<KMAResponse> => {
  const { KMA_SERVICE_KEY } = getAPIKeys();

  const response = await client.get<KMAResponse>(
    'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst',
    {
      params: {
        serviceKey: KMA_SERVICE_KEY,
        pageNo: 1,
        numOfRows: 60,
        dataType: 'JSON',
        base_date: baseDate,
        base_time: baseTime,
        nx: nx,
        ny: ny,
      },
    }
  );

  return response.data;
};

export interface WeatherWarningItem {
  title?: string;
  stnId?: string;
}

export interface KMAWarningResponse {
  response: {
    header: { resultCode: string; resultMsg: string; };
    body?: {
      dataType: string;
      items: { item: WeatherWarningItem[]; };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

export const fetchWeatherWarning = async (): Promise<KMAWarningResponse> => {
  const { KMA_SERVICE_KEY } = getAPIKeys();
  const response = await client.get<KMAWarningResponse>(
    'https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList',
    {
      params: {
        serviceKey: KMA_SERVICE_KEY,
        pageNo: 1,
        numOfRows: 20,
        dataType: 'JSON',
        stnId: '108',
      },
    }
  );
  return response.data;
};

