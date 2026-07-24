# BRIEFING — 2026-07-15T17:49:29+09:00

## Mission
Design a detailed, code-level architecture and logic flow for "Adaptive Background Location Updates (Adaptive Geofencing)" for the Anyway_the_Sea mobile application.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: Teamwork explorer. Read-only investigation: analyze problems, synthesize findings, produce structured reports.
- Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\explorer_cycle2
- Original parent: 4a3e8b4c-517a-4fea-9f8f-1f1e28a4aec0
- Milestone: explorer_cycle2_adaptive_design

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Operating in CODE_ONLY network mode: MUST NOT access external websites or services.
- MUST NOT use run_command to execute curl, wget, lynx, or any HTTP client targeting external URLs.
- MAY use code_search to look up source code.
- MUST NOT use any other search or documentation tools.

## Current Parent
- Conversation ID: 4a3e8b4c-517a-4fea-9f8f-1f1e28a4aec0
- Updated: 2026-07-15T17:50:50+09:00

## Investigation State
- **Explored paths**:
  - `Anyway_the_Sea/mobile/core_engine/src/database/local_places.ts` (Places database)
  - `Anyway_the_Sea/mobile/lib/services/geofencing_service.ts` (Geofencing target service)
  - `Anyway_the_Sea/mobile/lib/services/audio_engine_service.ts` (Audio engine target service)
  - `Anyway_the_Sea/mobile/lib/services/notification_service.ts` (Notification target service)
  - `C:\Users\user\Desktop\school_contest\blueprints\교육청 대회용 앱 간단 설계서.txt` (App specifications)
  - `C:\Users\user\Desktop\school_contest\blueprints\앱 UI, UX 설명서.txt` (UX principles)
- **Key findings**:
  - Complete mathematical model for speed-adjusted time intervals based on ETA to prevent zone skipping.
  - 4-zone partitioning with precise parameters (`Lowest` to `Highest` accuracy, base intervals, and deferred batching).
  - Concrete hysteresis buffers ($\beta = 30\text{m}$, $150\text{m}$, $1000\text{m}$) mapped to prevent battery drain from GPS noise at boundaries.
  - Headless JS state persistence designed using `AsyncStorage` for background task robustness.
  - Platform-specific optimizations for Android Foreground Service styling and iOS indicator silencing.
- **Unexplored areas**:
  - No caveats or unexplored areas. The adaptive geofencing design is complete and fully documented.

## Key Decisions Made
- Formulated the $T_{\text{eta}}$ mathematical model for velocity-based polling adjustments.
- Rejected pure sliding-window native geofencing in favor of an adaptive background polling approach because it provides better velocity-awareness, lower latency, and does not run into OS-level region registration bottlenecks.
- Selected `AsyncStorage` for the background task state storage to survive OS lifecycle terminations of the headless JS engine.

## Artifact Index
- C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_cycle2/adaptive_design.md — Detailed design report for Adaptive Background Location Updates
- C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_cycle2/handoff.md — Handoff report for explorer_cycle2
