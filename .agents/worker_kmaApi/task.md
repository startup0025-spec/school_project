# Task: Implement kma_api.ts

## Objective
Write the complete implementation for `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/core_engine/src/network/kma_api.ts`.

## Specifications
1. Import `client` from `./client`.
2. Import `getAPIKeys` from `../config/api_keys`.
3. Export interfaces: `ForecastItem` and `KMAResponse`.
4. Export the async function `fetchUltraShortForecast(baseDate: string, baseTime: string, nx: number, ny: number): Promise<KMAResponse>`.
5. Inside the function, get `KMA_SERVICE_KEY` using `getAPIKeys()`.
6. Make a GET request using `client.get<KMAResponse>()` targeting `'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst'` with appropriate params (serviceKey, pageNo: 1, numOfRows: 60, dataType: 'JSON', base_date, base_time, nx, ny).
7. Return `response.data`.
8. The implementation must exactly match the design in `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/orchestrator/handoff.md`.

## Constraints
1. **Zero-Burden**: No local try/catch blocks, no error swallowing, no offline checking branches in the wrapper.
2. **No Cheating**: All implementations must be genuine.
