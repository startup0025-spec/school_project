# Absolute Unified Record Schema

## 1. Context & State
- User noticed I didn't update the APKs in `C:\Users\user\Desktop\보내는 용도`.
- They reminded me to build both Demo and Production APKs again with the new data pipeline fixes.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will create a batch script to automate the rebuilding of both APKs back-to-back, modifying the `.env` file between builds using a standard script rather than bash redirects.
- I will run the script and notify the user when the build starts.

## 3. Execution Log
- Wrote log.
- Triggering `write_to_file` for `build_apks.bat`.
