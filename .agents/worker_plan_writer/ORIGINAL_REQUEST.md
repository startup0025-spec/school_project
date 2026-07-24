## 2026-07-15T08:57:53Z

You are the teamwork_preview_worker. Your task is to compile the final verified implementation plan for anyway_the_sea geofencing service.

Please read:
1. The validated design: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_cycle4/adaptive_design_v2.md
2. The final audit report: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/reviewer_cycle5/final_verdict.md
3. The blueprints directory: C:/Users/user/Desktop/school_contest/blueprints

Specifically, generate a detailed markdown report and write it directly to the workspace root at:
C:/Users/user/Desktop/school_contest/Anyway_the_Sea/implementation_plan.md

The report must contain:
1. **Executive Summary & Architectural Decisions**: Detailed comparative analysis between Native Geofencing (startGeofencingAsync) vs Continuous Updates (startLocationUpdatesAsync) for 100-200 places, explaining why the dynamic, adaptive polling background location updates model was selected.
2. **Quantized Proximity & Speed State-Space**: Clear tables mapping the 5 Distance Bins (INSIDE, NEAR, APPROACH, FAR, OUT_OF_BOUNDS) and 4 Speed Classes (STATIONARY, WALKING, RUNNING, FAST) to exact expo-location parameters (accuracy, timeInterval, distanceInterval) and battery optimization levels.
3. **Adversarial Security & Reliability Guardrails**:
   - Sequential Promise taskQueue queue configuration to resolve AsyncStorage race conditions.
   - Place locking via activePlaceId to resolve overlapping boundary jitter.
   - GPS outlier check via accuracy limits and velocity caps (45m/s).
4. **Complete TypeScript Code Specification**: Full typescript code layout for C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/lib/services/geofencing_service.ts.
5. **Platform Compliance Configurations**: Android 14 foregroundServiceType declaration in app.json, iOS infoPlist background modes, and Always-Allow calm educational flows.
6. **Permission Revocation & Audio session background wakeup**: AsyncStorage permission revocation logging, AppState active listener react hook, and Audio.setAudioModeAsync configuration.

Ensure the final file C:/Users/user/Desktop/school_contest/Anyway_the_Sea/implementation_plan.md is clean and professionally formatted. Write a handoff report at C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_plan_writer/handoff.md and report back.
