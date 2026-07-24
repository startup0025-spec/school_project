# Busan River Water Level & Water Quality API Analysis Report

This report presents the exact specifications, query parameters, response JSON schemas, and wrapper function designs for the two Busan public APIs, verified by extracting contents from the official OpenAPI documentation files.

---

## 1. Summary of Findings
Both APIs are hosted on the South Korea Public Data Portal (`data.go.kr`) under the Busan Metropolitan City Government agency. 
- **Busan River Water Level API** provides real-time water level data, maximum daily levels, alarm thresholds (둔치, 주의, 경계, 위험), and station status at 5-minute intervals.
- **Busan River Water Quality (Auto Measurement) API** provides hourly measurements of temperature, turbidity, dissolved oxygen, pH, salinity, and conductivity from 12 distinct monitoring stations across 온천천, 수영강, 삼락천, and others.
- Both APIs support JSON formatting by passing `resultType=json` (case-sensitive) as an optional query parameter.

---

## 2. API 1: 부산광역시 주요 하천 수위 정보 API

### A. Endpoint Information
- **API English Name**: `BusanRvrwtLevelInfoService`
- **Base Service URL**: `http://apis.data.go.kr/6260000/BusanRvrwtLevelInfoService`
- **Exact Endpoint (Query URL)**: `http://apis.data.go.kr/6260000/BusanRvrwtLevelInfoService/getRvrwtLevelInfo`
- **Data Refresh Cycle**: 5 minutes

### B. Request Parameters (Query Parameters)
| Parameter Name | Korean Name | Size | Required | Sample Value | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `serviceKey` | 인증키 | 100 | Yes (1) | `YOUR_API_KEY` | Public data portal API credentials key. |
| `numOfRows` | 한 페이지 결과 수 | 4 | Yes (1) | `10` | Number of rows to return per page. |
| `pageNo` | 페이지 번호 | 4 | Yes (1) | `1` | Page number to fetch. |
| `resultType` | JSON방식 호출 | 4 | No (0) | `json` | **Required for JSON responses**. Returns XML by default if omitted or set to `xml`. |

### C. Response Fields Schema (JSON)
The response follows a standard data.go.kr envelope: `response` -> `body` -> `items` -> `item[]`.
| JSON Key | Type | Korean Name | Required | Sample Value | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `resultCode` | `string` | 결과코드 | Yes | `"00"` | Transaction result code (`"00"` is successful). |
| `resultMsg` | `string` | 결과메시지 | Yes | `"NORMAL_CODE"` | Transaction status message. |
| `numOfRows` | `number` | 한 페이지 결과 수 | Yes | `10` | Rows per page. |
| `pageNo` | `number` | 페이지 번호 | Yes | `1` | Current page number. |
| `totalCount` | `number` | 전체 결과 수 | Yes | `54` | Total available records. |
| `siteCode` | `string` | 지역코드번호 | No | `"1000"` | Monitoring station unique code. |
| `siteName` | `string` | 지역이름 | No | `"장전동역"` | Name of the water level monitoring station. |
| `waterLevel` | `string` | 현재 수위 | No | `"0.1"` | Current water level in meters (m). |
| `dayLevelMax` | `string` | 일일 최대 수위 | No | `"0.3"` | Today's maximum water level (m). |
| `obsrTime` | `string` | 측정 시간 | No | `"2018-11-23 19:15:35"` | Date & time of observation. |
| `alertLevel1` | `string` | Level 1 값 | No | `"0.5"` | Riverbank overflow threshold level (둔치). |
| `alertLevel1Nm`| `string` | Level 1 명칭 | No | `"둔치"` | Name of Level 1 warning. |
| `alertLevel2` | `string` | Level 2 값 | No | `"2.0"` | Watch threshold level (주의). |
| `alertLevel2Nm`| `string` | Level 2 명칭 | No | `"주의"` | Name of Level 2 warning. |
| `alertLevel3` | `string` | Level 3 값 | No | `"2.3"` | Alert threshold level (경계). |
| `alertLevel3Nm`| `string` | Level 3 명칭 | No | `"경계"` | Name of Level 3 warning. |
| `alertLevel4` | `string` | Level 4 값 | No | `"2.57"` | Danger threshold level (위험). |
| `alertLevel4Nm`| `string` | Level 4 명칭 | No | `"위험"` | Name of Level 4 warning. |
| `sttus` | `string` | 상태 값 | No | `"0"` | Status code (`"0"` = Normal, `"1"` = Warning/Danger). |
| `sttusNm` | `string` | 상태 명칭 | No | `"정상"` | Readable status name. |

---

## 3. API 2: 부산광역시 하천 수질 자동측정망 정보 API

### A. Endpoint Information
- **API English Name**: `RiverQualityService`
- **Base Service URL**: `http://apis.data.go.kr/6260000/RiverQualityService`
- **Exact Endpoint (Query URL)**: `http://apis.data.go.kr/6260000/RiverQualityService/getRiverQualityStation`
- **Data Refresh Cycle**: 1 hour

### B. Request Parameters (Query Parameters)
| Parameter Name | Korean Name | Size | Required | Sample Value | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `serviceKey` | 인증키 | 100 | Yes (1) | `YOUR_API_KEY` | Public data portal API credentials key. |
| `numOfRows` | 한 페이지 결과 수 | 4 | Yes (1) | `5` | Number of rows to return per page. |
| `pageNo` | 페이지 번호 | 4 | Yes (1) | `1` | Page number to fetch. |
| `locCode` | 측정소코드 | 10 | No (0) | `103` | Specific monitoring station code (see Station List below). |
| `resultType` | JSON방식 호출 | 4 | No (0) | `json` | **Required for JSON responses**. Returns XML by default if omitted or set to `xml`. |

### C. Response Fields Schema (JSON)
The response is structured under: `response` -> `body` -> `items` -> `item[]`.
*Note: The API response uses `locNamel` (with a lowercase 'l' at the end) instead of `locName` due to an official documentation/API spelling error.*

| JSON Key | Type | Korean Name | Required | Sample Value | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `resultCode` | `string` | 결과코드 | Yes | `"00"` | Transaction result code. |
| `resultMsg` | `string` | 결과메시지 | Yes | `"NORMAL_CODE"` | Transaction status message. |
| `numOfRows` | `number` | 한 페이지 결과 수 | Yes | `5` | Rows per page. |
| `pageNo` | `number` | 페이지 번호 | Yes | `1` | Current page number. |
| `totalCount` | `number` | 데이터 총 개수 | Yes | `444` | Total records count. |
| `hourTime` | `string` | 날짜시간 | No | `"2019103113"` | Observation timestamp (`YYYYMMDDHH`). |
| `locCode` | `string` | 측정소코드 | No | `"103"` | Monitoring station code. |
| `locNamel` | `string` | 측정소명 | No | `"온천천 이섭교"` | Name of the monitoring station (spelled with lowercase 'l'). |
| `temp` | `string` | 수온 | No | `"16.4"` | Water temperature in Celsius (°C). |
| `ec` | `string` | 전기전도도 | No | `"10474"` | Electrical conductivity. |
| `do1` | `string` | 용존산소 | No | `"9.2"` | Dissolved oxygen (DO) level (mg/L). |
| `ph` | `string` | 수소이온농도 | No | `"7.7"` | pH level. |
| `salt` | `string` | 염분 | No | `"6"` | Salinity level (psu). |
| `tds` | `string` | TDS | No | `"6706"` | Total dissolved solids. |
| `turbid` | `string` | 탁도 | No | `"30.3"` | Turbidity level (NTU). |
| `chlora` | `string` | 클로로필 a | No | `"101.2"` | Chlorophyll-a level. |
| `nh4` | `string` | 암모늄 | No | `"-"` | Ammonium level. |

### D. Station List Code Table (`locCode`)
The following 12 monitoring stations are officially registered in the API:
- **`101`**: 온천천 부곡교 (Oncheoncheon Bugokgyo)
- **`102`**: 온천천 세병교 (Oncheoncheon Sebyeonggyo)
- **`103`**: 온천천 이섭교 (Oncheoncheon Iseobgyo)
- **`104`**: 수영강 회동교 (Suyeonggang Hoedonggyo)
- **`105`**: 수영강 세월교 (Suyeonggang Sewolgyo)
- **`106`**: 삼락천 강선교 (Samrakcheon Gangseongyo)
- **`107`**: 삼락천 음악분수 (Samrakcheon Music Fountain)
- **`108`**: 수영강 동천교 (Suyeonggang Dongcheongyo)
- **`109`**: 석대천 반석2호교 (Seokdaecheon Banseok 2nd Bridge)
- **`110`**: 춘천 삼정그린코아 (Chuncheon Samjeong Green Core)
- **`111`**: 동천 성서교 (Dongcheon Seongseogyo)
- **`112`**: 좌광천 중앙공원 (Jwawangcheon Central Park)

---

## 4. Zero-Burden Wrapper Architecture & Normalized Interfaces

To hook these APIs into our transparent cache and fallback system (`client.ts`), we define clean type definitions that normalize the raw responses. This hides spelling errors (`locNamel`, `do1`) from the UI layer and maps them to clean interfaces.

### A. TypeScript Interface Declarations
```typescript
// Proposed types to be placed in mobile/core_engine/src/network/busan_api.ts

// 1. Raw API Response Structures
export interface RawWaterLevelItem {
  siteCode: string;
  siteName: string;
  waterLevel: string;
  dayLevelMax: string;
  obsrTime: string;
  alertLevel1: string;
  alertLevel1Nm: string;
  alertLevel2: string;
  alertLevel2Nm: string;
  alertLevel3: string;
  alertLevel3Nm: string;
  alertLevel4: string;
  alertLevel4Nm: string;
  sttus: string;
  sttusNm: string;
}

export interface BusanWaterLevelResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body?: {
      items: {
        item: RawWaterLevelItem[];
      };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

export interface RawWaterQualityItem {
  hourTime: string;
  locCode: string;
  locNamel: string; // Keep spelling mapping internally
  temp: string;
  ec: string;
  do1: string;
  ph: string;
  salt: string;
  tds: string;
  turbid: string;
  chlora: string;
  nh4: string;
}

export interface BusanWaterQualityResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body?: {
      items: {
        item: RawWaterQualityItem[];
      };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

// 2. Normalized UI-Facing Interfaces (Consistent with mockData.ts)
export interface NormalizedWaterLevel {
  stationName: string;
  waterLevel: number;
}

export interface NormalizedWaterQuality {
  stationName: string;
  waterTemp: number;
  turbidity: number;
}
```

### B. Function Signatures & Mapping Logic
Both functions execute direct calls to `client.get` and rely on our interceptor for offline recovery and caching.
```typescript
import { client } from './client';
import { getAPIKeys } from '../config/api_keys';

/**
 * Fetches river water levels and normalizes the output.
 * Zero-Burden: Let network/cache errors bubble up to client.ts interceptors.
 */
export const fetchRiverWaterLevel = async (): Promise<NormalizedWaterLevel[]> => {
  const { BUSAN_SERVICE_KEY } = getAPIKeys();

  const response = await client.get<BusanWaterLevelResponse>(
    'http://apis.data.go.kr/6260000/BusanRvrwtLevelInfoService/getRvrwtLevelInfo',
    {
      params: {
        serviceKey: BUSAN_SERVICE_KEY,
        pageNo: 1,
        numOfRows: 20, // Enough to fetch all station records
        resultType: 'json',
      },
    }
  );

  const items = response.data?.response?.body?.items?.item || [];
  return items.map((item) => ({
    stationName: item.siteName,
    waterLevel: parseFloat(item.waterLevel) || 0.0,
  }));
};

/**
 * Fetches river water quality details (temperature, turbidity) and normalizes them.
 * Zero-Burden: Zero error checking locally.
 */
export const fetchRiverWaterQuality = async (locCode?: string): Promise<NormalizedWaterQuality[]> => {
  const { BUSAN_SERVICE_KEY } = getAPIKeys();

  const response = await client.get<BusanWaterQualityResponse>(
    'http://apis.data.go.kr/6260000/RiverQualityService/getRiverQualityStation',
    {
      params: {
        serviceKey: BUSAN_SERVICE_KEY,
        pageNo: 1,
        numOfRows: 20,
        locCode, // Optional filtering by station code
        resultType: 'json',
      },
    }
  );

  const items = response.data?.response?.body?.items?.item || [];
  return items.map((item) => ({
    stationName: item.locNamel, // Clean up spelling anomaly
    waterTemp: parseFloat(item.temp) || 0.0,
    turbidity: parseFloat(item.turbid) || 0.0,
  }));
};
```

---

## 5. Raw Sample JSON Responses

### A. Raw JSON Sample: Water Level API (`resultType=json`)
```json
{
  "response": {
    "header": {
      "resultMsg": "NORMAL_CODE",
      "resultCode": "00"
    },
    "body": {
      "items": {
        "item": [
          {
            "alertLevel4Nm": "위험",
            "sttusNm": "정상",
            "alertLevel1Nm": "둔치",
            "alertLevel2Nm": "주의",
            "sttus": "0",
            "alertLevel3Nm": "경계",
            "siteCode": "1000",
            "alertLevel4": "2.57",
            "alertLevel2": "2",
            "waterLevel": "0.1",
            "alertLevel3": "2.3",
            "dayLevelMax": "0.3",
            "alertLevel1": "0.5",
            "obsrTime": "2018-11-23 19:15:35",
            "siteName": "장전동역"
          },
          {
            "alertLevel4Nm": "위험",
            "sttusNm": "정상",
            "alertLevel1Nm": "둔치",
            "alertLevel2Nm": "주의",
            "sttus": "0",
            "alertLevel3Nm": "경계",
            "siteCode": "1001",
            "alertLevel4": "3.12",
            "alertLevel2": "2.25",
            "waterLevel": "0.16",
            "alertLevel3": "2.71",
            "dayLevelMax": "0.25",
            "alertLevel1": "0.22",
            "obsrTime": "2018-11-23 19:15:35",
            "siteName": "대천교"
          }
        ]
      },
      "numOfRows": 2,
      "pageNo": 1,
      "totalCount": 54
    }
  }
}
```

### B. Raw JSON Sample: Water Quality API (`resultType=json`)
```json
{
  "response": {
    "header": {
      "resultMsg": "NORMAL_CODE",
      "resultCode": "00"
    },
    "body": {
      "items": {
        "item": [
          {
            "do1": "9.2",
            "turbid": "30.3",
            "nh4": "-",
            "temp": "16.4",
            "chlora": "101.2",
            "locCode": "103",
            "ph": "7.7",
            "locNamel": "온천천 이섭교",
            "hourTime": "2019103113",
            "tds": "6706",
            "ec": "10474",
            "salt": "6"
          },
          {
            "do1": "9.5",
            "turbid": "154.4",
            "nh4": "-",
            "temp": "18",
            "chlora": "-",
            "locCode": "104",
            "ph": "6.8",
            "locNamel": "수영강 회동교",
            "hourTime": "2019103113",
            "tds": "77",
            "ec": "120",
            "salt": "0"
          }
        ]
      },
      "numOfRows": 2,
      "pageNo": 1,
      "totalCount": 444
    }
  }
}
```
