# Absolute Unified Record Schema

## 1. Context & State
- User furiously corrected me: I shouldn't HIDE the manual UI toggles in Production mode. Instead, I must make them change AUTOMATICALLY based on the background sensors.
- I reviewed `RippleContext.tsx` and `geofencing_service.ts` and saw that the background engine already emits events that update these states.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- My previous plan to "hide" the UI elements would ruin the UX, because the user wouldn't see the current state (like walking vs stationary, or safe vs danger).
- By disabling touch (`pointerEvents="none"`), the existing UI toggles (SegmentedControls, Chips) transform into beautiful, animated "status indicators" that shift automatically as the GPS/API background engine pumps data into `RippleContext`.
- I have updated the `implementation_plan.md` to reflect this brilliant UX strategy.

## 3. Execution Log
- Updated `implementation_plan.md` artifact.
- Wrote log.
- Yielding response to user.
