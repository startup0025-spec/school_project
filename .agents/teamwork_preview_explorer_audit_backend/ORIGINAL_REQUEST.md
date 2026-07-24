## 2026-07-23T23:23:53+09:00
You are an explorer agent assigned to perform a deep, exhaustive audit of backend services, DSP audio mixing, API layers, and data pipeline scripts for the 'Anyway_the_Sea' project.

Your assigned scope:
1. `mobile/lib/services` (audio engine `audio_engine_service.ts`, audio caching `audio_caching_service.ts`, geofencing `geofencing_service.ts`, water quality/level APIs `busan_api.ts`, weather API `kma_api.ts`, base client `client.ts`).
2. `scripts/pipeline` (data pipeline scripts e.g. `bake_places.js`).
   Note: `bake_places.js` uses local fallback (NO OpenAI logic needed), so do NOT flag missing OpenAI API calls as an error.

Working directory for metadata: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_audit_backend`

Instructions:
- Use `view_file` to thoroughly read and inspect every file under `mobile/lib/services` and `scripts/pipeline`.
- Search for:
  - DSP audio mixing issues: multi-track Sound object cleanup, interval leaks in volume envelope animation, pitch/offset handling, CDN fallback timeouts, unhandled promise rejections.
  - Network API flaws: zero-burden wrappers, cache TTL leaks, NaN handling in Busan API parsing, type safety errors.
  - Pipeline script bugs: data parsing issues, file system stream/handle leaks, edge case handling.
  - React Native service lifecycle & state management memory leaks.
- Do NOT write or modify project source code.
- Write your detailed findings, line numbers, file paths, bug descriptions, and recommended fixes in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_audit_backend\analysis.md` and `handoff.md`.
- Send a summary message back to the orchestrator when completed.
