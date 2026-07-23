## 2026-07-15T17:49:29Z
You are the teamwork_preview_explorer. Your task is to design a detailed, code-level architecture and logic flow for "Adaptive Background Location Updates (Adaptive Geofencing)" to serve as the main driver for the Anyway_the_Sea mobile application.

You must design:
1. **Dynamic Options Tuning**: How `Location.startLocationUpdatesAsync` can be dynamically stopped and restarted with varying options (`accuracy`, `timeInterval`, `distanceInterval`, `deferredUpdatesInterval`, `deferredUpdatesDistance`) based on:
   - Coarse distance $D$ to the nearest water spot (obtained via Haversine calculation against the 200 places from `local_places.ts`).
   - Velocity/speed of the user.
2. **Zone Partitioning**: Define concrete ranges (e.g. Far Zone, Approach Zone, Near Zone, Inside Zone) and the precise parameters for each zone to show how battery consumption is optimized.
3. **Adaptive Polling Logic Flow**: Provide a pseudo-code or code-level TypeScript logic flow of the background task handler showing how updates are captured, how the next zone is determined, how transitions are managed, and how duplicate restarts are prevented.
4. **Platform-Specific Considerations**: Address how this handles Android's Foreground Service notification requirement and how to minimize visual/auditory friction for the user (staying true to the "non-pressuring" UX philosophy).

Write your detailed design report at:
C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_cycle2/adaptive_design.md

When done, write your handoff report at:
C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_cycle2/handoff.md
and report back.
