# Absolute Unified Record Schema

## Agent Identity
- **Name:** BERRY 🍎
- **Role:** Project Orchestrator (orchestrator, user_liaison, human_reporter)
- **Mode:** /teamwork-preview (Absolute Strictness, Dispatched by Sentinel)

## 1. Context & State
- Received assignment from Sentinel (Parent Conv ID: `9d9d7740-2f38-46ef-8a83-a3288fff0d10`) to orchestrate a read-only Code Integrity Audit for `Anyway_the_Sea`.
- Objective: Uncover root causes of UI disconnection and rendering issues for KakaoMap, Sound Playback, Diary, and Geofencing.
- Output target: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\audit_report.md`.

## 2. Action Taken
- Initialized metadata files (`ORIGINAL_REQUEST.md`, `BRIEFING.md`, `PROJECT.md`, `progress.md`) in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\orchestrator\`.
- Created working directories for subagents: `.agents/teamwork_preview_explorer_audit_ui` and `.agents/teamwork_preview_explorer_audit_backend`.
- Prepared dispatch instructions for parallel Explorer subagents (UI/Routing Audit & Engine/API Audit).

## 3. Next Steps
- Start heartbeat cron schedule.
- Invoke `teamwork_preview_explorer` (UI/Routing Auditor) for M1.
- Invoke `teamwork_preview_explorer` (Engine/API Auditor) for M2.
- Await findings, then invoke `teamwork_preview_auditor` for M3 forensic synthesis.
- Verify deliverable `audit_report.md` and notify Sentinel via `send_message`.
