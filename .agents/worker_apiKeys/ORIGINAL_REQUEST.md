## 2026-07-15T20:46:06Z

You are a Code Implementation Worker.
Your working directory is: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_apiKeys
Your task is to implement Step 2: Implement the Base64 decoder and environment variables logic in C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/core_engine/src/config/api_keys.ts.

Please read:
- C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/core_engine/src/config/api_keys.ts (to view current content)
- C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/orchestrator/handoff.md (specifically Section 2.C for the exact TS code structure to write)
- C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_apiKeys/task.md (for additional constraints)

Your instructions:
1. Write the complete code for api_keys.ts. Ensure that decodeBase64 is a robust, lightweight base64 decoder function compatible with Hermes, and that getAPIKeys decrypts process.env.EXPO_PUBLIC_KMA_SERVICE_KEY and EXPO_PUBLIC_BUSAN_SERVICE_KEY, falling back to 'FALLBACK_DEMO_KEY' if not set.
2. MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode decrypted values directly as default keys or circumvent the intended task. A Forensic Auditor will independently verify your work.
3. Once completed, verify that the syntax is correct.
4. Write your handoff.md under C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_apiKeys/ indicating the file changes, verification results, and any warnings.
5. Use the send_message tool to send a message back to the orchestrator (recipient ID: 283666a0-b9bd-4678-9c51-933ed4a6b478) with your handoff report and the proposed code.
