# Original User Request

## Initial Request — 2026-07-24T12:21:31+09:00

You are the Project Orchestrator for 'Anyway_the_Sea'.

Your mission is to orchestrate a forensic, exhaustive pre-build audit and stress test of the React Native/Expo codebase to guarantee absolute stability (zero crashes) when compiled to an APK.

Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea
Orchestrator metadata directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\orchestrator

Requirements:
1. R1. Deep Codebase & Pipeline Audit: Read actual source code files in mobile/ and scripts/. Analyze API connections, state management, signal flows. Cite exact file paths and line numbers for every finding. Zero guessing/hallucination.
2. R2. Programmatic Stress Testing: Write and execute actual stress-test scripts (e.g. Node.js scripts running core logic/haversine/API parsing 10,000 times) in the project workspace to evaluate rendering lag, RAM usage, memory leaks, and algorithmic efficiency. Log raw execution output and console results.
3. R3. UI/UX & Emotional Design Review: Audit UI components against the 3-Layer Emotional UX rules (Visceral, Behavioral, Reflective) defined in AGENTS.md.
4. Acceptance Criteria:
   - Every claim/bug/optimization MUST cite exact file paths and line numbers.
   - Execute at least one programmatic stress test script and report raw console logs/times.
   - Zero dummy data or mocked results allowed.

Workflow:
- Create and maintain `.agents/orchestrator/plan.md` and `.agents/orchestrator/progress.md`.
- Spawn specialists (explorers, workers, reviewers, critics) as needed to complete the audit and stress testing.
- When all audit milestones, stress tests, and UX reviews are complete and verified, report completion.
- Proceed immediately.

## Follow-up — 2026-07-24T13:29:37Z

<USER_REQUEST>
Conduct an omni-platform (iOS, Android, Web), full-stack forensic audit and stress test of the React Native/Expo codebase. The audit must ruthlessly verify every single data pipeline, logic connection, UI flow, and error-handling mechanism for both demo and actual production deployments without skipping any connected feature.

Working directory: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea`
Integrity mode: benchmark (Absolute Strictness: No fakes, no guessing)

## Requirements

### R1. Cross-Platform & Deployment Pipeline Audit
Analyze the codebase for platform-specific bugs (iOS vs. Android vs. Web). Verify that configurations (e.g., `app.json`, `eas.json`, Vercel setups) are flawlessly aligned for both local demonstrations and production deployments.

### R2. End-to-End Logic & Data Error Testing
Trace every signal flow from UI interaction down to API fetching and state management. You must proactively identify edge cases, race conditions, and unhandled data errors (e.g., API timeouts, malformed JSON). 

### R3. Universal UI/UX Verification
Audit the entire user flow across all screens. Ensure the 3-Layer Emotional UX (Visceral, Behavioral, Reflective) rules are strictly followed on all platforms, guaranteeing zero visual lag or missing press feedback.

## Acceptance Criteria

### Verification & Honesty
- [ ] Every claim about a bug, data error, or logic disconnect must cite the exact file path and line number from the actual codebase.
- [ ] The team must execute programmatic testing that specifically targets iOS, Android, and Web pipelines to prove multi-platform stability.
- [ ] No dummy data or "mocked" assumptions allowed. If a pipeline is untested, report it as a failure.
- [ ] The final report must explicitly separate findings into "Demo Deployment Risks" and "Production Deployment Risks".
</USER_REQUEST>

## Follow-up — 2026-07-24T13:34:00Z

[HIGH PRIORITY USER ADDENDUM RECEIVED]: Expand audit scope to full-stack backend and frontend architecture!
- Ruthless audit of BACKEND components: `scripts/pipeline/bake_places.js`, server-side logic, GitHub Actions CI/CD workflows, and data baking pipelines.
- Complete signal trace from backend data baking down to frontend UI rendering across iOS, Android, and Web platforms.
- Ensure all findings, edge cases, and deployment risks (Demo vs Production) cover both backend data processes and frontend rendering.
