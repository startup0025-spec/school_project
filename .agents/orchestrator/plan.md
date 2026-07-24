# Codebase Audit & QA Sweep Plan

## Overview
Perform an exhaustive, deep code audit and quality assurance sweep across the entire 'Anyway_the_Sea' repository. Fix all identified bugs, type errors, memory leaks, missing useEffect/setInterval cleanups, and React rendering flaws. Verify type safety with `npx tsc --noEmit` inside `mobile/`, and generate `audit_report.md`.

## Scope & Target Paths
1. `mobile/app/(tabs)`: Navigation, tab screens, React hooks, rendering optimizations.
2. Kakao Map WebView bridging: `mobile/app/(tabs)/map.tsx`, WebView HTML templates, `postMessage`/`onMessage` IPC channels.
3. `mobile/lib/services`: Audio mixing engine, geofencing, caching, offline fallback, Busan water level/quality APIs, KMA weather API.
4. `scripts/pipeline`: Data processing scripts (e.g. `bake_places.js`). Note: `bake_places.js` uses local fallback (NO OpenAI), missing OpenAI logic is expected and NOT an error.

## Decomposition Milestones
- **Milestone 1: Codebase Deep Exploration & Vulnerability Analysis**
  - Explorer 1 (`explorer_audit_ui`): Audit UI, React hooks, WebView bridge, tab navigation.
  - Explorer 2 (`explorer_audit_backend`): Audit services, DSP audio mix, API clients, pipeline scripts.
- **Milestone 2: Bug Remediation & Type Safety Enforcement**
  - Worker (`worker_audit_fix`): Implement fixes for all identified bugs, memory leaks, and type errors; run `npx tsc --noEmit`.
- **Milestone 3: Independent Review & Challenge**
  - Reviewer (`reviewer_audit`): Code review, verification of fixes, type safety re-verification.
- **Milestone 4: Forensic Integrity Audit**
  - Auditor (`auditor_audit`): Forensic integrity verification to ensure no dummy/hardcoded fixes or cheated test cases.
- **Milestone 5: Audit Report & Handoff**
  - Generate `audit_report.md` at root and report final results to parent.
