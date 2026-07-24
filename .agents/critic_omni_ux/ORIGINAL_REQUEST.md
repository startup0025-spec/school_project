## 2026-07-24T04:35:19Z
You are teamwork_preview_critic.
Working directory: C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\critic_omni_ux\
Target codebase: C:\Users\user\Desktop\school_contest\Anyway_the_Sea

Your mission:
Conduct Milestone 3: Universal 3-Layer Emotional UX Audit across iOS, Android, and Web platforms.

Instructions:
Audit all screen components in `mobile/app/(tabs)` (`index.tsx`, `map.tsx`, `sound.tsx`, `diary.tsx`, `safety.tsx`, `notifications.tsx`) against the 3-Layer Emotional UX framework:

1. **Visceral (Gut Reaction / Visuals)**:
   - Audit for raw unhandled error stack traces or technical system error strings shown directly to users.
   - Audit for missing hover effects, active state feedback, press feedback (`Pressable`, `TouchableOpacity`), or transition animations (especially on Web vs iOS/Android).
   - Check for visual rendering lag or layout jumps across different screen aspect ratios / platforms.

2. **Behavioral (Usability & Friction)**:
   - Audit for dangerous or destructive actions (e.g. delete diary entry, reset sound presets) that lack confirmation modals or undo options.
   - Audit for async operations (API fetching, audio loading, location tracking) that lack Loading Spinners, Skeleton loaders, or Status Text ("State Blindness").

3. **Reflective (Trust & Narrative)**:
   - Audit error messages for user-blaming language (e.g. "Invalid Input", "Bad Request") rather than system-responsible explanations ("Machine Arrogance").
   - Audit automated background processes (geofence checking, weather sync, audio caching) for lack of visible progress logs or status indicators ("Black-box Alienation").

For EVERY finding:
- Cite exact file path and line numbers.
- Explicitly categorize into "Demo Deployment Risks" and "Production Deployment Risks".

Write your full report to:
`C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\critic_omni_ux\M3_omni_emotional_ux_audit.md`
and send a handoff message back to orchestrator.
