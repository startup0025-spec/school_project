## 2026-07-15T16:36:37Z
You are the Core Engine Developer. Your task is to:
1. Implement the file `mobile/core_engine/src/network/busan_api.ts`.
   - Use the `client` exported from `./client` (which wraps axios with caching).
   - Use `getAPIKeys` from `../config/api_keys` to get the `BUSAN_SERVICE_KEY`.
   - Implement two async functions:
     - `fetchRiverWaterLevel()`:
       - Endpoint: `http://apis.data.go.kr/6260000/BusanRvrwtLevelInfoService/getRvrwtLevelInfo`
       - Parameters:
         - `serviceKey`: `BUSAN_SERVICE_KEY`
         - `pageNo`: `1`
         - `numOfRows`: `20`
         - `resultType`: `'json'` (Mandatory query param)
       - Returns `Promise<NormalizedWaterLevel[]>` where `NormalizedWaterLevel` contains `stationName: string` and `waterLevel: number`.
       - Map `siteName` from response to `stationName`.
       - Defend against `NaN` values: parse `waterLevel` using `parseFloat`, check if it's `NaN` (via `Number.isNaN`), and fallback to `0.0`.
     - `fetchRiverWaterQuality(locCode?: string)`:
       - Endpoint: `http://apis.data.go.kr/6260000/RiverQualityService/getRiverQualityStation`
       - Parameters:
         - `serviceKey`: `BUSAN_SERVICE_KEY`
         - `pageNo`: `1`
         - `numOfRows`: `20`
         - `locCode`: optional parameter passed to the query.
         - `resultType`: `'json'` (Mandatory query param)
       - Returns `Promise<NormalizedWaterQuality[]>` where `NormalizedWaterQuality` contains `stationName: string`, `waterTemp: number`, and `turbidity: number`.
       - Map the response fields:
         - `locNamel` (spelled with a lowercase L at the end, i.e., `locNamel`) to `stationName`.
         - `temp` to `waterTemp`.
         - `turbid` to `turbidity`.
       - Defend against `NaN` values: parse `temp` and `turbid` using `parseFloat`, checking for `NaN` (via `Number.isNaN`) and falling back to `0.0`.
   - Zero error checking (try-catch) in `busan_api.ts` — allow errors to bubble up to `client.ts` as per the Zero-Burden design.
   - Define and export all necessary TypeScript interfaces for the API responses (`RawWaterLevelItem`, `BusanWaterLevelResponse`, `RawWaterQualityItem`, `BusanWaterQualityResponse`, `NormalizedWaterLevel`, `NormalizedWaterQuality`) so it is fully typed.
   - Add the verbatim warning block:
     > DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

2. Create the blueprint document at `C:\Users\user\Desktop\school_contest\blueprints\mobile_yame\core_engine_yame\src_yame\network_yame\blueprints_by_busan_api.ts.md`.
   - Describe the architectural roles of `busan_api.ts`.
   - Document the endpoints, query parameters, types, response schemas, and fields.
   - Explain the NaN-defensive parsing logic and the rationale behind it.
   - Explain how zero-burden error bubble-up integrates with the transparent cache offline fallback in `client.ts`.

3. Update `C:\Users\user\Desktop\school_contest\blueprints\교육청 대회용 앱 간단 설계서.txt` directory tree.
   - Insert `blueprints_by_busan_api.ts.md` under `network_yame/` in the tree. Keep it formatted exactly like the existing lines.

4. Run typescript check in `mobile/` directory:
   - Run `npx tsc --noEmit` under `c:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile` to ensure there are no compilation/type errors in the project.
   - Provide the execution command and output in your handoff report.

Write your handoff report to `c:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\worker_busan_api\handoff.md` and then notify the orchestrator (Berry 🍎) using send_message.
