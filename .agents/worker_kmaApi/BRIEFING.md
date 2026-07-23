# BRIEFING — 2026-07-15T20:54:21+09:00

## Mission
Implement the Zero-Burden wrapper for the KMA API in mobile/core_engine/src/network/kma_api.ts.

## 🔒 My Identity
- Archetype: worker_kmaApi
- Roles: implementer, qa, specialist
- Working directory: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_kmaApi
- Original parent: 283666a0-b9bd-4678-9c51-933ed4a6b478
- Milestone: Step 4 - KMA API Implementation

## 🔒 Key Constraints
- fetchUltraShortForecast must not contain try/catch blocks or error branches.
- Delegate API calls directly to client.get with baseDate and baseTime parsed as base_date and base_time parameters.
- No network access, no dummy or facade implementations, strict integrity rules.
- Write a log using the 'Absolute Unified Record Schema' in C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/agent_notes/ before returning the final response.

## Current Parent
- Conversation ID: 283666a0-b9bd-4678-9c51-933ed4a6b478
- Updated: not yet

## Task Summary
- **What to build**: Implement the KMA API wrapper inside kma_api.ts.
- **Success criteria**: Proper delegation to client.get with baseDate and baseTime parsed as base_date and base_time. No error handling inside fetchUltraShortForecast (zero-burden). Passing unit tests.
- **Interface contracts**: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/orchestrator/handoff.md Section 2.E.
- **Code layout**: mobile/core_engine/src/network/kma_api.ts

## Key Decisions Made
- Delegated all cache and fallback logic directly to `client.ts` to implement the Zero-Burden design.
- Mapped `baseDate` and `baseTime` to `base_date` and `base_time` for KMA API compliance.

## Artifact Index
- C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_kmaApi/handoff.md — Handoff report containing changes and verification results.

## Change Tracker
- **Files modified**: mobile/core_engine/src/network/kma_api.ts
- **Build status**: Pass
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (20/20 pipeline tests, tsc compiled)
- **Lint status**: No lint setup detected
- **Tests added/modified**: None

## Loaded Skills
- None
