## 2026-07-15T17:40:51Z
Task: Implement the Core Engine Integration & Models phase.

Your working directory is: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_core_engine
Your identity is: teamwork_preview_worker

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Here is the exact design you need to write:

1. Files to create/update:
   - mobile/core_engine/src/models/safety_status.ts
     Define:
     ```typescript
     /**
      * 안전 등급 (Safe, Warning, Danger) 열거형 (Enum)
      */
     export enum SafetyLevel {
       Safe = 'Safe',
       Warning = 'Warning',
       Danger = 'Danger',
     }
     ```

   - mobile/core_engine/src/models/audio_params.ts
     Define:
     ```typescript
     import { WaterType } from './place_model';
     export interface AudioParams {
       waterType: WaterType;
       ambientVolume: number;
       windVolume: number;
       pitch: number;
       filterFrequency: number;
       alarmActive: boolean;
     }
     ```

   - mobile/core_engine/src/network/kma_api.ts
     Add the following interface and function:
     ```typescript
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
         'http://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList',
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
     ```

   - mobile/core_engine/src/api.ts
     Implement the following:
     1. checkGeofenceAndSafety(userLat: number, userLng: number): Promise<SafetyLevel>
        - Call getPlaces()
        - Find the closest place using Haversine distance
        - If inside geofence radius:
          - Check weather warnings (contains district/부산 and 호우경보/풍랑경보 -> Danger, 호우주의보/풍랑주의보 -> Warning)
          - Check wind speed WSD (category WSD from fetchUltraShortForecast, >= 14 -> Danger, >= 8 -> Warning)
          - Check water level waterLevel (matching place.waterStationName, >= 1.5 -> Danger, >= 0.8 -> Warning)
          - Take maximum level.
          - Clamp all math and use optional chaining for zero crash.
        - Else return Safe
     2. getSonificationParams(place: Place): Promise<AudioParams>
        - alarmActive: true if safetyLevel is Danger
        - windVolume: scale WSD/15.0 clamped between 0 and 1. Default 0.2.
        - ambientVolume: scale waterLevel/2.0 + 0.3 clamped between 0 and 1. Default 0.6 (0 if waterType is 'none').
        - filterFrequency: 20000 - turbidity*1000 clamped between 200 and 20000. Default 20000.
        - pitch: 1.0 + (waterLevel - 0.5) clamped between 0.5 and 2.0. Default 1.0.

   - mobile/core_engine/src/index.ts
     Export models, database/local_places, and api.

2. Blueprints docs to create inside C:\Users\user\Desktop\school_contest\blueprints\mobile_yame\core_engine_yame\src_yame\:
   - models_yame/blueprints_by_safety_status.ts.md
   - models_yame/blueprints_by_audio_params.ts.md
   - blueprints_by_api.ts.md
   - blueprints_by_index.ts.md
   Match the style and format of other blueprints.

3. Update C:\Users\user\Desktop\school_contest\blueprints\교육청 대회용 앱 간단 설계서.txt to include these new blueprints in the directory tree starting at line 42.

4. Run the compilation check inside mobile folder:
   run `npm run typecheck` (or `npx tsc --noEmit` inside mobile folder) to make sure there are 0 typescript errors.

Write a detailed handoff report when done.
