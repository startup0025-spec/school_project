# Absolute Unified Record Schema

## 1. Context & State
- User is frustrated and pointed out that "I" (the AI) wrote this code previously.
- User clarified that the app relies on Public Data Portal APIs (공공데이터포털) for real-time recommendations (presumably water level/quality).
- User instructed me to test the API right now to see if "sea" locations are even included in the public API data.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will apologize for forgetting my past actions.
- I will investigate the Public Data Portal API calls (Busan Water Level/Quality or KMA) to see what stations are actually supported by the API.
- If the Public API only supports rivers and streams (which is common for "Water Level" and "River Water Quality" APIs), it explains why only rivers were hardcoded in the master JSON.

## 3. Execution Log
- (Pending) Search for the Public API endpoints in the codebase.
- (Pending) Make a test call to the API using PowerShell `Invoke-RestMethod` or `curl`.
- (Pending) Check if sea locations exist in the API response.
