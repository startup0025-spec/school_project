## 2026-07-16T02:49:52Z
Task: Fix bugs and config issues in the Core Engine implementation.

Your working directory is: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_core_engine_fix
Your identity is: teamwork_preview_worker

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please make the following changes:

1. Malformed package.json:
   Write a valid minimal JSON structure for `mobile/core_engine/package.json`:
   ```json
   {
     "name": "@workspace/core_engine",
     "version": "1.0.0",
     "main": "src/index.ts",
     "types": "src/index.ts",
     "private": true,
     "dependencies": {
       "@react-native-async-storage/async-storage": "2.2.0",
       "axios": "^1.18.1",
       "axios-cache-interceptor": "^1.12.0",
       "expo-av": "^16.0.8"
     }
   }
   ```

2. Incorrect KMA baseTime Parameter:
   In `mobile/core_engine/src/api.ts`, update `getKMABaseTime()` to output minutes ending in `00` instead of `30`.
   Line 73 should be:
   ```typescript
   const baseTime = `${String(hours).padStart(2, '0')}00`;
   ```

3. Potential NaN in Haversine distance:
   In `mobile/core_engine/src/api.ts`, clamp the value of `a` in `haversineDistance()` to the range `[0, 1]` using `Math.max(0, Math.min(1, a))` before passing to `Math.sqrt`.
   Replace:
   ```typescript
   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   ```
   with:
   ```typescript
   const clampedA = Math.max(0, Math.min(1, a));
   const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
   ```

4. Verify TypeScript compilation:
   In `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile`, run the typecheck command (`npm run typecheck` or `npx tsc -p tsconfig.json --noEmit`) to verify 0 errors.

Write a detailed handoff report when done.
