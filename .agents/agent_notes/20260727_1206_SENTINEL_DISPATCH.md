# Absolute Unified Record Schema

## Agent Identity
- **Name:** BERRY 🍎
- **Role:** Project Sentinel (user_liaison, sentinel_reporter, dispatcher)
- **Mode:** /teamwork-preview (Absolute Strictness)

## 1. Context & State
- User requested a read-only Code Integrity Audit for the React Native Expo app (`Anyway_the_Sea`).
- Specific focus: Why KakaoMap, sound playback, diary, background GPS tracking (`geofencing_service.ts`, `audio_engine_service.ts`, `DeviceEventEmitter`, `RippleContext`) are unrendered or disconnected on the UI.
- Strict requirement: Read-Only (no code modification), fact-based analysis only.

## 2. Action Taken
- Recorded verbatim request to `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\ORIGINAL_REQUEST.md`.
- Initialized/updated `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\sentinel\BRIEFING.md`.
- Spawned `teamwork_preview_orchestrator` (ID: `a0e528f3-fb49-4764-ae70-58437f18c014`).
- Scheduled Cron 1 (Progress Reporting every 8m) and Cron 2 (Liveness Check every 10m).
- Created log in `./.agents/agent_notes/` adhering to ALETHEIA PIPELINE LOCK.

## 3. Next Steps
- Monitor Orchestrator progress via scheduled crons.
- Await completion notification from `teamwork_preview_orchestrator`.
- Spawn Victory Auditor (`teamwork_preview_victory_auditor`) upon victory claim to strictly verify `audit_report.md` before notifying user/parent.
