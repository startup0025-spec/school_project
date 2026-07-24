## 2026-07-24T04:35:19Z
<USER_REQUEST>
You are teamwork_preview_worker.
Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\worker_omni_stress\
Target codebase: C:\Users\user\Desktop\school_contest\Anyway_the_Sea

Your mission:
Conduct Milestone 2: Full-Stack End-to-End Logic Signal Flow Audit & Programmatic Stress Testing.

Mandatory Integrity Warning:
DO NOT CHEAT. All implementations and test scripts must be genuine. DO NOT hardcode test results or create dummy/facade implementations.

Instructions:
1. Trace signal flow from UI components (`mobile/app/(tabs)`) down to API fetching (`client.ts`, `busan_api.ts`, `kma_api.ts`, `tour_api.ts`), state management, and backend data baking (`scripts/pipeline/bake_places.js`).
2. Write and execute actual Node.js programmatic stress testing scripts (e.g. `scripts/stress_test_runner.js` or `mobile/stress_test.js`) that run core logic 10,000+ times and evaluate:
   - Backend data baking & haversine/geofence math (`haversine.ts`, `bake_places.js`) execution speed, RAM footprint, and edge cases (e.g. NaN, negative coordinates, zero distance).
   - Audio engine & caching (`audio_engine_service.ts`, `audio_caching_service.ts`) concurrency locks, LRU eviction, and stale playback handling.
   - API error resilience: execute tests passing malformed JSON, simulated 500/404 errors, API timeouts, and missing fields (`obsrTime`, `locNamel`).
3. Run `npx tsc --noEmit` inside `mobile/` using run_command to verify 100% type safety and zero TypeScript errors. Include raw output.
4. Record raw execution console outputs, RAM usage, and timing statistics in your report.
5. Cite exact file paths and line numbers for every finding.
6. Categorize findings explicitly into "Demo Deployment Risks" and "Production Deployment Risks".

Write your full report to:
`C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\worker_omni_stress\M2_omni_stress_test_report.md`
and send a handoff message back to orchestrator.
</USER_REQUEST>
