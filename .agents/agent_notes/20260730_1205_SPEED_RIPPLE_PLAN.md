# Absolute Unified Record Schema

## 1. Context & State
- User rejected the previous plan to simply "hide" the segmented control in PROD. They pointed out that it is intentionally disabled in PROD because the state updates automatically via GPS.
- User proposed a new UI/UX feature for PROD mode on the Home tab (`index.tsx`):
  1. Replace the 3-button segmented control with a long horizontal bar featuring a ripple animation.
  2. The new horizontal ripple bar must sync with the main upper `RippleOrb`.
  3. Crucially, the ripple animations in PROD should not snap to 3 discrete states (calm/walking/busy) but must continuously scale based on the user's *real* GPS speed. (DEMO mode should retain the 3 discrete states for testing).
- User initiated `/goal 심층 계획` to formulate a deep architectural plan mapping out which files to change.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]` (Step 2: Log).
- I will investigate `geofencing_service.ts` to see if continuous raw speed (m/s) is available and emitted.
- I will check `RippleOrb.tsx` to see how it can accept a continuous speed multiplier (instead of just discrete `mode`).
- I will check `index.tsx` and plan the creation of the new `RippleBar` component.
- I will draft a comprehensive `implementation_plan.md` detailing the file modifications for this advanced continuous-speed ripple architecture.

## 3. Execution Log
- (Pending) Read `geofencing_service.ts` for speed data.
- (Pending) Read `RippleOrb.tsx` for animation logic.
- (Pending) Draft `implementation_plan.md` and await user approval.
