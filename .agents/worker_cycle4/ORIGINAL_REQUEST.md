## 2026-07-15T08:54:26Z
You are the teamwork_preview_worker. Your task is to update the Adaptive Geofencing design and write a revised, robust design document:
C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_cycle4/adaptive_design_v2.md

You must read:
1. The original design report: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_cycle2/adaptive_design.md
2. The review report: C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/reviewer_cycle3/review.md

Specifically, modify the design and TypeScript code structure to fully resolve all review findings:
- **Finding 1.1 (Restart Loop)**: Introduce discrete Speed Classes (STATIONARY, WALKING, RUNNING, FAST) and Distance Bins (INSIDE, NEAR, APPROACH, FAR, OUT_OF_BOUNDS). Base the options configKey signature solely on these discrete levels rather than exact timeInterval/distanceInterval values, preventing constant service restarts.
- **Finding 1.2 (Concurrency Race)**: Implement a sequential execution queue (using a static Promise chain) in the background TaskManager callback to prevent concurrent overlapping executions and AsyncStorage state overwrites.
- **Finding 2.1 (Closest-Place Jitter)**: Implement an active-place lock mechanism (using activePlaceId) when the user is inside a place's radius, maintaining the lock until they cross the radius + hysteresis buffer, preventing toggling between nearby places.
- **Finding 2.2 (GPS Outliers)**: Filter updates based on accuracy (discard if >50m or >100m) and calculated velocity since the last update (discard spikes representing physical movement faster than 45 m/s).
- **Finding 2.3 (Deferred Updates)**: Eliminate deferred updates during high-speed transit or near places, keeping configuration clean and reliable.
- **Finding 3.1 (Android 14 Foreground Service type)**: Document the exact `app.json` expo-location plugin configuration specifying `"foregroundServiceType": "location"`.
- **Finding 4.1 (Permission Revocation)**: Log permission status errors to AsyncStorage so the foreground app can poll and notify the user on app resume.
- **Coverage Gaps**: Detail iOS "Always Allow" flow and the configuration of the audio session (e.g. expo-av playback configuration) to allow background audio wakeup.

Write your final design document at:
C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_cycle4/adaptive_design_v2.md

When done, write your handoff report at:
C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/worker_cycle4/handoff.md
and report back. Do NOT modify any files in another agent's directory.
