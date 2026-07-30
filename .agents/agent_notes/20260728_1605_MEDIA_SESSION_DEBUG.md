# Absolute Unified Record Schema

## 1. Context & State
- User provided a screenshot of the Kakao Developers console. The JavaScript key (`24af09ad3bb319a067ce7cfc5e83fc2d`) and domain (`https://startup0025-spec.github.io`) match exactly with our `.env` and `map.tsx`. This confirms Kakao Map will work on the next build!
- User reported that the Media Session notification (Squiggly progress bar on lockscreen) implemented by the `teamwork_preview` subagent is not showing up in the installed APK.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I am in Planning Mode. I need to research why the media session notification isn't showing up.
- I will check `app.json` for background audio permissions and expo plugins.
- I will check `audio_engine_service.ts` and `media_session_service.ts` to verify if the media session is correctly initialized and tied to the audio playback.

## 3. Execution Log
- Wrote log.
- Triggering `view_file` on `app.json` and checking `lib/services`.
- Yielding response to user.
