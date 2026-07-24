# Omni-Platform & Full-Stack Audit & Stress Test Plan

## Overview
Conduct a full-stack, omni-platform (iOS, Android, Web) forensic audit and programmatic stress test of the React Native / Expo codebase and backend data pipeline scripts (`scripts/pipeline/bake_places.js`, GitHub Actions CI/CD workflows). Produce an exhaustive `audit_report.md` categorizing risks into Demo Deployment Risks and Production Deployment Risks.

## Target Areas & Platform Matrix
1. **Build & Deployment Pipelines & CI/CD**: `app.json`, `eas.json`, `vercel.json`, `.github/workflows`, Metro config, Kakao Map JS key vs Native key, Web fallback vs Native modules (`expo-file-system`, `expo-network`, `expo-av`).
2. **Full-Stack End-to-End Signal Flows & Data Logic**: Backend data baking (`bake_places.js`) -> UI handlers -> custom hooks -> API services (`client.ts`, `busan_api.ts`, `kma_api.ts`, `tour_api.ts`) -> State/SWR -> Kakao Map WebView postMessage.
3. **Programmatic Stress Testing**: Node.js stress scripts testing haversine/geofence math, audio mixing engine, cache TTL/LRU, malformed JSON parsing, API error resilience, and backend data baking execution.
4. **Universal 3-Layer Emotional UX**: Screen audit across iOS/Android/Web following Visceral (error wrappers, hovers, transition lag), Behavioral (destructive modals, loading state blindness), Reflective (polite messaging, transparent progress logs).

## Milestone Decomposition & Subagent Topology
- **Milestone 1**: Cross-Platform & Deployment Pipeline Audit -> `teamwork_preview_explorer` (`teamwork_preview_explorer_omni_pipeline`)
- **Milestone 2**: Full-Stack End-to-End Signal Flow & Programmatic Stress Testing -> `teamwork_preview_worker` (`teamwork_preview_worker_omni_stress`)
- **Milestone 3**: Universal 3-Layer Emotional UX Verification -> `teamwork_preview_critic` (`teamwork_preview_critic_omni_ux`)
- **Milestone 4**: Forensic Integrity Audit & Deliverable Generation -> `teamwork_preview_auditor` (`teamwork_preview_auditor_omni_audit`)
