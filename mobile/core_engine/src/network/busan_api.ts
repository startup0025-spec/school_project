import { client } from './client';
import { getAPIKeys } from '../config/api_keys';

/*
 * DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results,
 * create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor
 * will independently verify your work. Integrity violations WILL be detected and your
 * work WILL be rejected.
 */

export interface RawWaterLevelItem {
  siteName?: string;
  stationName?: string;
  waterLevel?: string | number;
}

export interface BusanWaterLevelResponse {
  // Official Open API Response structure
  getRvrwtLevelInfo?: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body?: {
      items?: {
        item?: RawWaterLevelItem[];
      };
      numOfRows?: number;
      pageNo?: number;
      totalCount?: number;
    };
  };
  // Mock fallback response structure (defined in mockData.ts)
  WaterLevelList?: {
    row?: Array<{
      stationName?: string;
      waterLevel?: string | number;
    }>;
  };
}

export interface RawWaterQualityItem {
  locNamel?: string; // spelled with a lowercase L at the end, i.e., locNamel
  temp?: string | number;
  turbid?: string | number;
  stationName?: string;
  waterTemp?: string | number;
  turbidity?: string | number;
}

export interface BusanWaterQualityResponse {
  // Official Open API Response structure
  getRiverQualityStation?: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body?: {
      items?: {
        item?: RawWaterQualityItem[];
      };
      numOfRows?: number;
      pageNo?: number;
      totalCount?: number;
    };
  };
  // Mock fallback response structure (defined in mockData.ts)
  WaterQualityList?: {
    row?: Array<{
      stationName?: string;
      waterTemp?: string | number;
      turbidity?: string | number;
    }>;
  };
}

export interface NormalizedWaterLevel {
  stationName: string;
  waterLevel: number;
}

export interface NormalizedWaterQuality {
  stationName: string;
  waterTemp: number;
  turbidity: number;
}

/**
 * Fetches river water levels in Busan.
 * Maps 'siteName' to 'stationName' and parses 'waterLevel' defensively.
 * Zero error checking locally — errors bubble up to client.ts.
 */
export const fetchRiverWaterLevel = async (): Promise<NormalizedWaterLevel[]> => {
  const { BUSAN_SERVICE_KEY } = getAPIKeys();
  const response = await client.get<BusanWaterLevelResponse>(
    'http://apis.data.go.kr/6260000/BusanRvrwtLevelInfoService/getRvrwtLevelInfo',
    {
      params: {
        serviceKey: BUSAN_SERVICE_KEY,
        pageNo: 1,
        numOfRows: 20,
        resultType: 'json',
      },
    }
  );

  const data = response.data;
  let rawItems: RawWaterLevelItem[] = [];

  if (data?.getRvrwtLevelInfo?.body?.items?.item) {
    rawItems = data.getRvrwtLevelInfo.body.items.item;
  } else if (data?.WaterLevelList?.row) {
    rawItems = data.WaterLevelList.row;
  }

  return rawItems.map((item) => {
    const stationName = item.siteName || item.stationName || '';
    const rawVal = item.waterLevel;
    let waterLevel = 0.0;

    if (rawVal !== undefined && rawVal !== null) {
      const parsed = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
      waterLevel = Number.isNaN(parsed) ? 0.0 : parsed;
    }

    return {
      stationName,
      waterLevel,
    };
  });
};

/**
 * Fetches river water quality in Busan.
 * Maps 'locNamel', 'temp', and 'turbid' to normalized output fields and parses defensively.
 * Zero error checking locally — errors bubble up to client.ts.
 */
export const fetchRiverWaterQuality = async (
  locCode?: string
): Promise<NormalizedWaterQuality[]> => {
  const { BUSAN_SERVICE_KEY } = getAPIKeys();
  const response = await client.get<BusanWaterQualityResponse>(
    'http://apis.data.go.kr/6260000/RiverQualityService/getRiverQualityStation',
    {
      params: {
        serviceKey: BUSAN_SERVICE_KEY,
        pageNo: 1,
        numOfRows: 20,
        locCode: locCode,
        resultType: 'json',
      },
    }
  );

  const data = response.data;
  let rawItems: RawWaterQualityItem[] = [];

  if (data?.getRiverQualityStation?.body?.items?.item) {
    rawItems = data.getRiverQualityStation.body.items.item;
  } else if (data?.WaterQualityList?.row) {
    rawItems = data.WaterQualityList.row;
  }

  return rawItems.map((item) => {
    const stationName = item.locNamel || item.stationName || '';

    const rawTemp = item.temp !== undefined ? item.temp : item.waterTemp;
    let waterTemp = 0.0;
    if (rawTemp !== undefined && rawTemp !== null) {
      const parsed = typeof rawTemp === 'number' ? rawTemp : parseFloat(rawTemp);
      waterTemp = Number.isNaN(parsed) ? 0.0 : parsed;
    }

    const rawTurbid = item.turbid !== undefined ? item.turbid : item.turbidity;
    let turbidity = 0.0;
    if (rawTurbid !== undefined && rawTurbid !== null) {
      const parsed = typeof rawTurbid === 'number' ? rawTurbid : parseFloat(rawTurbid);
      turbidity = Number.isNaN(parsed) ? 0.0 : parsed;
    }

    return {
      stationName,
      waterTemp,
      turbidity,
    };
  });
};
