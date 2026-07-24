## 2026-07-15T11:49:38Z
You are a Code Implementation Worker.
Your working directory is: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_client
Your task is to implement Step 3: Implement the Transparent Offline Interceptor in C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/core_engine/src/network/client.ts.

Please read:
- C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/core_engine/src/network/client.ts (to view current content)
- C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/orchestrator/handoff.md (specifically Section 2.D for the exact TS code structure to write)
- C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_client/task.md (for additional constraints)

Your instructions:
1. Write the complete code for client.ts. Make sure that the path to mockData is exactly `../../../constants/mockData` (without any extra extension or wrong directories).
2. Ensure that setupCache and buildStorage are used correctly to configure AsyncStorage support.
3. Configure the custom response interceptor to intercept connection failures (like connection timeout, ERR_NETWORK code, or "Network Error" messages) and return mock data resolved via getFallbackData(url).
4. MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work.
5. Once completed, verify that the syntax is correct.
6. Write your handoff.md under C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_client/ indicating the file changes, verification results, and any warnings.
7. Use the send_message tool to send a message back to the orchestrator (recipient ID: 283666a0-b9bd-4678-9c51-933ed4a6b478) with your handoff report and the proposed code.
