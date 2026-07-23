## 2026-07-15T16:43:48Z

You are the Core Engine Developer. Your task is to:
1. Modify `mobile/constants/mockData.ts`.
   - Update `getFallbackData` to support matching `/getRvrwtLevelInfo` and `/getRiverQualityStation` in addition to the existing matches, so that offline cache fallback can map correct responses for both the mock endpoints and the real OpenAPI endpoints.
   - For example:
     - `url.includes('/getWaterLevel') || url.includes('/getRvrwtLevelInfo')` -> return `DEFAULT_FALLBACKS.busan_water_level`
     - `url.includes('/getWaterQuality') || url.includes('/getRiverQualityStation')` -> return `DEFAULT_FALLBACKS.busan_water_quality`
   - Include the verbatim warning block:
     > DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

2. Run typescript compile check under `mobile/`:
   - Run `node node_modules\typescript\bin\tsc --noEmit` under `c:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile`.
   - Check that it compiles cleanly with exit code 0.

Write your handoff report to `c:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\worker_mock_update\handoff.md` and notify the orchestrator (Berry 🍎) with a summary.
