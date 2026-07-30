# Absolute Unified Record Schema

## 1. Context & State
- User is worried that maintaining two versions (Demo vs Production) will require creating a duplicate project folder and maintaining two separate codebases.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I need to explain the concept of environment variables and EAS build profiles.
- Show them that `eas.json` allows us to inject `EXPO_PUBLIC_BUILD_MODE` at compile-time, so one codebase can generate two different APKs based on a single command flag (`--profile preview-demo` vs `--profile preview-prod`).
- Reassure them that no new folder is needed.

## 3. Execution Log
- Wrote log.
- Yielding response to user.
