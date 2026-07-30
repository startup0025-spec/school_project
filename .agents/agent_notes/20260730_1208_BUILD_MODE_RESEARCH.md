# Absolute Unified Record Schema

## 1. Context & State
- User instructed me to investigate how the PROD vs DEMO build split is implemented in the codebase.
- User explicitly commanded: "Do not modify the code yet, just check how the corresponding code was written."
- Previous knowledge indicates `EXPO_PUBLIC_BUILD_MODE` is used for runtime branching (e.g., in `index.tsx`).

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]` (Step 2).
- Comply with user constraint (investigate only, no modification).
- I will run PowerShell `Select-String` to search for `EXPO_PUBLIC_BUILD_MODE` and other environment-related configurations (e.g., build scripts in `package.json`, EAS profiles in `eas.json`) across the `C:\mobile` codebase.
- I will report my findings to the user.

## 3. Execution Log
- (Pending) Search codebase for `EXPO_PUBLIC_BUILD_MODE`.
- (Pending) Check `package.json` and `eas.json` for build scripts.
- (Pending) Report findings to user.
