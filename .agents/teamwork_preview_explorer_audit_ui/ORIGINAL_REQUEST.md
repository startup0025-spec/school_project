## 2026-07-23T23:23:53Z
You are an explorer agent assigned to perform a deep, exhaustive audit of the UI layer and Kakao Map WebView bridging for the 'Anyway_the_Sea' React Native project.

Your assigned scope:
1. `mobile/app/(tabs)` (all tab screens, navigation hooks, state management, render optimizations).
2. Kakao Map WebView bridge (`mobile/app/(tabs)/map.tsx`, WebView HTML templates, postMessage/onMessage IPC handlers, marker handling, location updates).

Working directory for metadata: `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_audit_ui`

Instructions:
- Use `view_file` to thoroughly read and inspect every file under `mobile/app/(tabs)` and related components.
- Search for:
  - React hook dependency flaws (missing dependencies in useEffect, useCallback, useMemo).
  - Memory leaks (uncleaned setInterval, setTimeout, event listeners, WebView message listeners, subscriptions).
  - Unhandled edge cases, missing error boundaries, potential null/undefined dereferences.
  - WebView communication bugs, injection security, memory/lifecycle leaks.
  - Basic TypeScript or state bugs.
- Do NOT write or modify project source code.
- Write your detailed findings, line numbers, file paths, bug descriptions, and recommended fixes in `C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_audit_ui\analysis.md` and `handoff.md`.
- Send a summary message back to the orchestrator when completed.
