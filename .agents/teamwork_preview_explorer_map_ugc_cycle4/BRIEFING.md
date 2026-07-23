# BRIEFING — 2026-07-16T13:05:55+09:00

## Mission
Research and verify Kakao Map URI schemes, web fallbacks, and package visibility configurations for Android/iOS integration.

## 🔒 My Identity
- Archetype: Lead Explorer
- Roles: Lead Explorer for Cycle 4 of Kakao Map & UGC Pivot
- Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_ugc_cycle4
- Original parent: de22b05d-d512-46be-a589-13729edc0f36
- Milestone: Kakao Map & UGC Pivot Cycle 4

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Operating in CODE_ONLY network mode
- No direct code edits outside of my working directory

## Current Parent
- Conversation ID: de22b05d-d512-46be-a589-13729edc0f36
- Updated: not yet

## Investigation State
- **Explored paths**: `mobile/app/(tabs)/map.tsx`, `mobile/app.json`, `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\agent_notes\`
- **Key findings**: Kakao Map deep linking parameters (`kakaomap://route` with `by=FOOT`), web URL fallback specifications (`https://map.kakao.com/link/to/Name,lat,lng`), and `app.json` package visibility configuration layout.
- **Unexplored areas**: Direct integration into the Place Card component UI action handler.

## Key Decisions Made
- Recommend the official `kakaomap://route` scheme with `by=FOOT` for native deep linking, and `https://map.kakao.com/link/to/Name,lat,lng` for web fallback.
- Formulate the precise JSON changes for iOS (`LSApplicationQueriesSchemes`) and Android (`queries` element in Manifest via Expo Config Plugin).

## Artifact Index
- C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_ugc_cycle4\analysis.md — Technical analysis report.
- C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_ugc_cycle4\handoff.md — Handoff report.
