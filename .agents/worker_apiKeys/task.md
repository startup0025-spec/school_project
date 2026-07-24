# Task: Implement api_keys.ts

## Objective
Write the complete implementation for `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/core_engine/src/config/api_keys.ts`.

## Specifications
1. Implement the lightweight Base64 decoder function `decodeBase64(str: string): string` compatible with React Native's Hermes engine.
2. Implement and export `getAPIKeys()` which pulls keys from `process.env.EXPO_PUBLIC_KMA_SERVICE_KEY` and `process.env.EXPO_PUBLIC_BUSAN_SERVICE_KEY`.
3. The keys must be decoded via `decodeBase64` at runtime.
4. Fall back to `'FALLBACK_DEMO_KEY'` if the env variables are not set or are empty.
5. The implementation must exactly match the design in `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/orchestrator/handoff.md`.

## Constraints
1. **No Cheating**: All implementations must be genuine. Do not hardcode decrypted values directly as default keys.
