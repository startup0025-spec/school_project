# Project: Omni-Platform & Full-Stack Forensic Audit & Stress Test

## Architecture
- Target repository: React Native / Expo application (`mobile/`) + Full-Stack Backend & Data Pipelines (`scripts/pipeline/bake_places.js`, server-side proxy, GitHub Actions CI/CD workflows `.github/workflows`).
- Platforms analyzed: iOS, Android, Web (`app.json`, `eas.json`, `vercel.json`, Metro bundler, Expo Web, Kakao Map Webview bridge, Native audio/filesystem vs Web audio/localstorage, CI/CD automation).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Cross-Platform & Deployment Pipeline Audit | iOS / Android / Web build configs, GitHub Actions CI/CD workflows, Vercel proxy, app.json, eas.json, Kakao Map bridge | none | PLANNED |
| 2 | Full-Stack End-to-End Logic & Data Error Stress Testing | Signal flows backend `bake_places.js` -> UI to API/State, edge cases, race conditions, malformed JSON, programmatic Node stress test scripts | M1 | PLANNED |
| 3 | Universal UI/UX & 3-Layer Emotional UX Verification | All screen flows (`(tabs)`), Visceral, Behavioral, Reflective UX on iOS/Android/Web | M1 | PLANNED |
| 4 | Forensic Integrity Audit & Deliverable Generation | Verification of test logs, clean audit verdict, creation of `audit_report.md` separating Demo vs Production Deployment Risks | M1, M2, M3 | PLANNED |

## Interface Contracts & Validation Criteria
- Every finding MUST cite exact file path and line number.
- Programmatic stress tests MUST execute actual Node scripts and output raw execution timing/RAM metrics.
- Findings MUST be explicitly grouped into "Demo Deployment Risks" and "Production Deployment Risks".
