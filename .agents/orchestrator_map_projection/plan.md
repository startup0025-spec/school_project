# Audio CDN Streaming & Caching Overhaul Plan (10-Cycle Extension)

## Objectives
1. **Audio CDN Streaming Overhaul**:
   - Migrate local audio assets (`ambient_sea.mp3`, `ambient_river.mp3`, `white_noise_wind.mp3`, `emergency_siren.wav`) to a GitHub Pages CDN endpoint.
   - Implement an Audio CDN Cache Manager using `expo-file-system` and `expo-network` to handle network URI streaming, pre-fetching, local file caching, and offline fallback to bundled assets.
   - Design robust offline state transition logic to prevent crashes when connection drops.
   - Mitigate concurrency issues in `expo-av` (such as playback request race conditions).
   - Address LRU eviction lock safety to prevent deleting files actively loaded or playing.
   - Design headless background geofencing cache limits to stay within OS execution windows (10-30s).
   - Fix TS compile errors in `app/notifications.tsx` (missing imports).

## Decomposition of Work
- **Milestone 1**: 10-Cycle Discussion & Architecture Design (No Code Modification)
- **Milestone 2**: Audio CDN Streaming & Offline Cache Architecture (expo-file-system, expo-network integration)
- **Milestone 3**: UI Integration & SWR Background Sync
- **Milestone 4**: Final Handoff & Implementation Deliverable Writing

## Discussion Strategy (10 Cycles)
- **Cycle 1**: Core Architecture Draft (Completed)
- **Cycle 2**: Technical Review & Feedback (Completed)
- **Cycle 3**: Refined Audio Caching & Offline Detection (Completed)
- **Cycle 4**: Concurrency Synchronization & SWR Integration (Completed)
- **Cycle 5**: Design for LRU Pinning, Headless Pre-fetching, and TS Imports Fix (Active)
- **Cycle 6**: Critique of LRU Pinning & Headless geofence bounds
- **Cycle 7**: Refined Caching Manager and Background Task sketches
- **Cycle 8**: Verification of thread locks and OS time limits
- **Cycle 9**: Consolidated implementation draft and pre-flight checks
- **Cycle 10**: Final Verified Audio CDN Implementation Blueprint & Hallucination Check
