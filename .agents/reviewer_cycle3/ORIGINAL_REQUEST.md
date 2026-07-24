## 2026-07-15T17:51:27Z

<USER_REQUEST>
You are the teamwork_preview_reviewer. Your task is to perform a strict architectural review of the Adaptive Background Location Updates design document located at:
C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/explorer_cycle2/adaptive_design.md

Analyze the design document and provide critical feedback on:
1. **Mathematical Accuracy & Reliability**:
   - Verify the $T_{\text{eta}}$ and speed-scaled active polling interval formulas. Are there any edge cases (e.g. user moving at extremely high speed in a car, or user at absolute rest)?
   - Are the hysteresis buffers ($\beta$) sufficient to prevent toggle storms (repetitive location tracking restarts)?
2. **Concurrencies & State Management**:
   - Assess the use of `AsyncStorage` for state management in background tasks. What happens if multiple tasks execute concurrently or `AsyncStorage.getItem` / `setItem` has high latency?
   - What happens if `Location.startLocationUpdatesAsync` is called while another restart is already in progress? Are there race conditions?
3. **Robustness & Outliers**:
   - How does the system handle GPS multipath spikes (sudden jump of coordinate by 10km)? Will this trigger a sudden zone jump and battery drain?
   - What if permissions are revoked while the background task is running?
4. **Android/iOS Compliance**:
   - Verify that the Android Foreground Service configuration and iOS Background modes comply with Expo location guidelines and don't cause app rejection.

Write your detailed review report at:
C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/reviewer_cycle3/review.md

When done, write your handoff report at:
C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/reviewer_cycle3/handoff.md
and report back.
</USER_REQUEST>
