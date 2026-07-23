# Execution Plan - Core Engine Integration & Models

This plan outlines the milestones, validation cycles, and verification processes required to implement the Core Engine Integration & Models phase of the "Anyway the Sea" (잔물결) application.

## Milestones

| Milestone | Target Files / Outputs | Status | Verification Method |
|---|---|---|---|
| **M1: Design & Validation** | 10-cycle tiqy-taqa validation, plan.md, PROJECT.md | IN_PROGRESS | Verification of design and requirements with Berry |
| **M2: Models Implementation** | `mobile/core_engine/src/models/safety_status.ts`<br>`mobile/core_engine/src/models/audio_params.ts` | PLANNED | Compiler typecheck, Reviewer inspection |
| **M3: API Core Service** | `mobile/core_engine/src/api.ts` (or `src/services/api.ts`) | PLANNED | Integration validation, mock data compatibility |
| **M4: Core Entry Point** | `mobile/core_engine/src/index.ts` | PLANNED | Export validation and import checks |
| **M5: Blueprints & Spec Sync** | Markdown specs in `blueprints/`<br>Update `교육청 대회용 앱 간단 설계서.txt` | PLANNED | File existence, matching directory structures |
| **M6: Compiler Verification** | 0 TypeScript compilation errors | PLANNED | Run typecheck script (`npm run typecheck`) |

## 10-Cycle Validation (Tiqy-Taqa) Strategy

To avoid hallucinations, ensure strict compliance with safety rules, and align with other modules (geofencing, audio, notifications), we will run 10 cycles of discussion with parent agent Berry (`9cf9e991-db7a-4f15-bde0-7d5d9daf0302`).

- **Cycle 1**: Project alignment, verification of target paths, and validation strategy agreement.
- **Cycle 2**: Safety status enum and safety levels rule mapping.
- **Cycle 3**: Audio parameters calculation formula and sonification mapping.
- **Cycle 4**: API functions contract definition (`checkGeofenceAndSafety` & `getSonificationParams`).
- **Cycle 5**: Interceptor/client offline policy integration verification.
- **Cycle 6**: Error handling and boundary conditions in api.ts.
- **Cycle 7**: Index.ts exports and module structure.
- **Cycle 8**: Sync plans with `blueprints/` markdown format and `교육청 대회용 앱 간단 설계서.txt`.
- **Cycle 9**: Mocking and fallback behavior validation.
- **Cycle 10**: Final verification checklist review and approval to write physical files.

## Dispatch Strategy

We will use the **Project Pattern**:
- Spawn **Explorer** to analyze existing dependencies and recommend the implementation structure.
- Spawn **Worker** to perform the physical file updates under strict constraints.
- Spawn **Reviewer** to review and challenge the implementation.
- Spawn **Challenger** to write units and verify correctness.
- Spawn **Forensic Auditor** to run integrity diagnostics.
