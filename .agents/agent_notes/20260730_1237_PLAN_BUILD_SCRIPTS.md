# Absolute Unified Record Schema

## 1. Context & State
- User wants me to explicitly write down in the plan that DEMO will strictly use the 3-stage logic, and PROD will use the continuous speed logic.
- User specifically mentioned "things that need to be changed when building the APK", implying I should explicitly document the APK rebuild process (or environment variable injection during build) in the plan.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will update `implementation_plan.md` to add a dedicated section for "APK Build & Environment Separation", clearly spelling out how DEMO and PROD will be baked with different behaviors using the existing build mode variables.

## 3. Execution Log
- (Pending) Update `implementation_plan.md` to satisfy the user's demand for explicit documentation of the build/split behavior.
