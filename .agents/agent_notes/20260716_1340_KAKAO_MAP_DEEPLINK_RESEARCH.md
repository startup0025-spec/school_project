---
RECORD_ID: "20260716_1340_KAKAO_MAP_DEEPLINK_RESEARCH"
RECORD_TYPE: "[LOG]"
TARGET: "Research Kakao Map URI schemes, fallback formats, and package visibility configurations"
---
[1_WHAT] (State & Context):
> (LOG: Kakao Map URI scheme specifications for route finding, Web URL fallback format verification, and package visibility config inside app.json for Android/iOS were researched and verified.)

[2_HOW] (Action & Details):
> (LOG:
> 1. Verified that `kakaomap://route` with `ep=lat,lng` and `epName=name` triggers the directions screen, and `by=FOOT` sets it to walking mode.
> 2. Proved that `https://map.kakao.com/link/to/Name,lat,lng` is the official web fallback format, requiring comma separation for empty names.
> 3. Structured the `app.json` integration changes for package visibility on both iOS (`LSApplicationQueriesSchemes`) and Android (`queries` inside the manifest).
> 4. Saved the findings in `.agents/teamwork_preview_explorer_map_ugc_cycle4/analysis.md` and `handoff.md`.
> )

[3_WHY] (Reasoning & Dependency):
> (LOG: External route finding offloads complex navigation calculation to Kakao Map app or web fallback, which keeps our application lightweight. Whitelisting the scheme in app.json prevents Linking.canOpenURL from failing on Android 11+ and iOS 15+.)

[4_NEXT] (Status & Follow-up):
> (LOG: Handoff and analysis saved in the cycle 4 working directory. Report sent to the orchestrator for implementer action.)
