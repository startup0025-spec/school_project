# Absolute Unified Record Schema

## 1. Context & State
- User received feedback from their teacher via a KakaoTalk screenshot.
- Teacher's feedback: "I am near the sea, but the stream sound is playing. Also, the recommended water paths are mostly rivers. Please check the sea/waterside location recognition and sound matching logic."
- User asked me to identify the problems in the picture and check the API logic.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will state the 2 problems found in the teacher's feedback:
  1. Incorrect sound matching (Sea location -> Stream sound).
  2. Biased place recommendations (Mostly rivers, missing sea spots).
- I will investigate the API or data source providing the places to see why sea locations are missing or misclassified.

## 3. Execution Log
- (Pending) Analyze the image and state the problems.
- (Pending) Search for the place fetching logic (e.g., `getPlaces()`, `waterType`).
- (Pending) Explain the root cause and propose a plan to fix it.
