# Absolute Unified Record Schema

## 1. Context & State
- User corrected their title to "사장님" (Boss/CEO) instead of "마스터".
- User triggered `/goal 신속하게 정확한 APK 뽑기` to force the agent to continuously execute until the final APK is in the target directory.
- `task-7367` (`npm install`) is running to provide a clean dependency tree.

## 2. Intent & Rationale
- Comply immediately with the new title "사장님".
- Create `task.md` to track progress.
- Since this is a `/goal`, I will not stop until the APK is securely downloaded and moved to `C:\Users\user\Desktop\보내는 용도\`.
- I will wait for `npm install` to finish, then run local Gradle, then run EAS, then download.

## 3. Execution Log
- Created `task.md`.
- Wrote this agent note.
- Now waiting for `npm install` to finish via `manage_task` or timer.
