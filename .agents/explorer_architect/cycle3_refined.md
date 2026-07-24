# Cycle 3 Refined Design: Audio Cache Eviction, Deadlock Prevention & Headless Background Pre-fetching

**Document Version**: 3.0.0  
**Phase**: Refined Architecture & Implementation Design (Cycle 3 Refined Design)  
**Target Module**: Cache Eviction Policy, Playback Safety, Headless Geofencing & TS Compilation Remediation  
**Author**: Lead Architect (explorer_architect / BERRY 🍎)

---

## Executive Summary

This document presents the **Cycle 3 Refined Design** addressing the deep technical challenges of background execution limits, cache eviction deadlock prevention, and immediate type compilation errors. 

We extend the Cycle 2 caching architecture by introducing:
1. **TypeScript Compilation Remediation**: Providing the exact import fix for the React hook errors in `mobile/app/notifications.tsx`.
2. **LRU Cache Pinning & Active Playback Deadlock Prevention**: A robust active-channel pinning mechanism and an explicit unloader registration callback ensuring that `expo-av` audio channels are completely stopped and unloaded before files are deleted from the disk cache.
3. **Headless Background Pre-fetching Limits**: An analysis of OS-specific background limitations (10–30s limit) and a geofencing architecture that restricts background network consumption to only immediate assets, deferring bulk pre-fetching to foreground idle states.

---

## 1. Compile Error Remediation in `notifications.tsx`

### 1.1 Root Cause Analysis
In `mobile/app/notifications.tsx`, the screen uses the standard React hooks `useState` and `useEffect` on lines 18 and 20:
```typescript
const [notifications, setNotifications] = useState<AppNotification[]>([]);
useEffect(() => { ... }, []);
```
However, line 1 only imports the default `React` export:
```typescript
import React from 'react';
```
This omission results in a TypeScript compiler error: `Cannot find name 'useState'` and `Cannot find name 'useEffect'`.

### 1.2 Import Replacement Code
To remediate this compile error, the imports block at the top of `mobile/app/notifications.tsx` must be corrected.

**Target File**: `mobile/app/notifications.tsx`  
**Before**:
```typescript
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
```

**After (Proposed Remediation)**:
```typescript
import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
```

---

## 2. LRU Eviction & Active Playback Deadlock Prevention

Deleting a cache file that is currently locked, read, or decoded by native audio components (`expo-av` player threads) causes playback crashes, severe state corruption, or memory leaks. To prevent these deadlocks and thread issues, we implement two layers of safety: **Active File Pinning** and the **Active Playback Registry Callback**.

### 2.1 Caching Service: Pinned Files and Eviction Safety
We introduce a `pinnedFiles` set and a registerable callback in `mobile/lib/services/audio_caching_service.ts`. Pinned files are completely skipped from cache size calculations and eviction loops.

```typescript
// mobile/lib/services/audio_caching_service.ts (Excerpt)

// Set of files currently locked by playing channels
const pinnedFiles = new Set<string>();

// Active player check and force-unload callbacks
let activeSoundChecker: ((filename: string) => Promise<boolean>) | null = null;
let activeSoundUnloader: ((filename: string) => Promise<void>) | null = null;

export function registerActiveSoundController(
  checker: (filename: string) => Promise<boolean>,
  unloader: (filename: string) => Promise<void>
) {
  activeSoundChecker = checker;
  activeSoundUnloader = unloader;
}

export function pinFile(filename: string): void {
  pinnedFiles.add(filename);
  console.log(`[Cache Manager] File pinned: ${filename}`);
}

export function unpinFile(filename: string): void {
  pinnedFiles.delete(filename);
  console.log(`[Cache Manager] File unpinned: ${filename}`);
}
```

We update the eviction loop in `enforceCacheLimits` to:
1. Skip pinned files.
2. Intercept unpinned but active files in `expo-av` (e.g., if a file is loaded but paused, or if there's a race condition), force-unload them, and wait for their release before executing `FileSystem.deleteAsync`.

```typescript
export async function enforceCacheLimits(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) return;

    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    let totalSize = 0;
    const fileSizes: Record<string, number> = {};

    for (const file of files) {
      if (file === 'sounds_metadata.json') continue;
      const fileInfo = await FileSystem.getInfoAsync(`${CACHE_DIR}${file}`);
      if (fileInfo.exists) {
        totalSize += fileInfo.size;
        fileSizes[file] = fileInfo.size;
      }
    }

    if (totalSize <= MAX_CACHE_SIZE_BYTES) return;

    console.warn(`[Cache Manager] Limit exceeded (${(totalSize / 1024 / 1024).toFixed(2)}MB). Initiating eviction...`);
    const metadata = await readMetadata();

    // Sort by last used (oldest first)
    const sortedFiles = Object.keys(metadata).sort((a, b) => metadata[a].lastUsed - metadata[b].lastUsed);

    for (const file of sortedFiles) {
      if (totalSize <= PRUNE_TARGET_BYTES) break;

      // Rule 1: Skip if file is actively pinned in cache manager
      if (pinnedFiles.has(file)) {
        console.log(`[Cache Manager] Skipping pinned file: ${file}`);
        continue;
      }

      // Rule 2: Deadlock prevention. Force unload from native player before deletion.
      if (activeSoundChecker && activeSoundUnloader) {
        const isActiveInAv = await activeSoundChecker(file);
        if (isActiveInAv) {
          console.warn(`[Cache Manager] File ${file} is active in expo-av. Triggering force-unload before deletion.`);
          await activeSoundUnloader(file);
        }
      }

      const localUri = `${CACHE_DIR}${file}`;
      await FileSystem.deleteAsync(localUri, { idempotent: true });

      const sizePruned = fileSizes[file] || metadata[file].size || 0;
      totalSize -= sizePruned;
      delete metadata[file];
      console.log(`[Cache Manager] Evicted file: ${file} (${(sizePruned / 1024 / 1024).toFixed(2)}MB)`);
    }

    await writeMetadata(metadata);
  } catch (error) {
    console.error('[Cache Manager] Eviction failed:', error);
  }
}
```

### 2.2 Playback Service: Tracking and Force Unloading
We configure `mobile/lib/services/audio_engine_service.ts` to register its checking and unloading operations, and manage the pin/unpin lifecycle.

```typescript
// mobile/lib/services/audio_engine_service.ts (Excerpt)

// Track active filenames
let activeAmbientFile: string | null = null;
let activeWindFile: string | null = null;
let activeSirenFile: string | null = null;

// Register callbacks with caching service to handle eviction deadlock prevention
registerActiveSoundController(
  async (filename: string) => {
    return filename === activeAmbientFile || filename === activeWindFile || filename === activeSirenFile;
  },
  async (filename: string) => {
    // If the cache manager must evict a file, ensure it is fully stopped and unloaded first
    if (filename === activeAmbientFile && ambientSound) {
      const sound = ambientSound;
      ambientSound = null;
      activeAmbientFile = null;
      unpinFile(filename);
      await sound.stopAsync();
      await sound.unloadAsync();
    }
    if (filename === activeWindFile && windSound) {
      const sound = windSound;
      windSound = null;
      activeWindFile = null;
      unpinFile(filename);
      await sound.stopAsync();
      await sound.unloadAsync();
    }
    if (filename === activeSirenFile && sirenSound) {
      const sound = sirenSound;
      sirenSound = null;
      activeSirenFile = null;
      unpinFile(filename);
      await sound.stopAsync();
      await sound.unloadAsync();
    }
    console.log(`[Audio Engine] Force-unloaded active file: ${filename} due to cache pressure.`);
  }
);
```

During playback initialization:
- When a track loads successfully, `pinFile(filename)` is called and the active filename state is updated.
- When `stopAmbientSound()` is called, we immediately call `unpinFile(filename)` and clear active file states.

---

## 3. Headless Background Cache Pre-fetching Limits

### 3.1 OS-Specific Background Execution Constraints
Mobile operating systems strictly monitor battery consumption and network overhead of background applications:
* **iOS (Background Fetch / Task Completion / Geofencing)**: Offers a background execution window of **10 to 30 seconds**. If a background task consumes high CPU or holds open multiple network connection sockets beyond this limit, the system watchdog sends a `SIGKILL` termination, causing the app to crash.
* **Android (Headless JS / WorkManager / Geofencing)**: Grants limited background CPU slices. Large network downloads triggered in background threads are throttled or terminated if the background service duration exceeds OS limits.
* **Problem**: Attempting to prefetch all 4 major audio assets (often totaling 20–30MB) concurrently in a geofence transition handler will result in watchdog timeout crashes and user-perceived app instability.

### 3.2 Selective Background Pre-fetching Design
Instead of performing bulk pre-fetching during background events, we divide cache warming into two strategies:
1. **Targeted Immediate Download (Background)**: When entering a geofenced area, download ONLY the immediate 1–2 assets needed for the spot (the specific ambient file + wind noise if not already cached).
2. **Bulk Deferred Download (Foreground)**: Defer the complete pre-fetching of all remaining spots to the foreground. This runs when the app is active and SWR revalidation occurs.

### 3.3 Geofencing Service Integration
We modify the transition handler in `mobile/lib/services/geofencing_service.ts` to prefetch *only* the immediate files:

```typescript
// mobile/lib/services/geofencing_service.ts (Excerpt)

import { prefetchAudioAssets } from './audio_caching_service';

async function processLocationUpdate(locations: Location.LocationObject[]): Promise<void> {
  // ... location parsing and filtering logic ...

  if (nextBin === 'INSIDE') {
    state.activePlaceId = targetPlace.id;
    await triggerWelcomeNotification(targetPlace);

    // 1. Identify only the specific ambient track and wind track required for this geofence
    const ambientFile = targetPlace.waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';
    const immediateRequired = [ambientFile, 'white_noise_wind.mp3'];

    console.log(`[BG Geofencing] Entering spot. Warming ONLY immediate assets: ${immediateRequired.join(', ')}`);
    
    // 2. Perform sequential background download for immediate assets only (maximum 1-2 files)
    try {
      await prefetchAudioAssets(immediateRequired);
    } catch (err) {
      console.warn('[BG Geofencing] Selective background prefetching failed:', err);
    }

    // 3. Initiate playback
    await playAmbientSound(targetPlace.waterType);
  } else if (state.currentBin === 'INSIDE') {
    await stopAmbientSound();
  }
}
```

Since `prefetchAudioAssets` is sequential, downloading at most 1–2 missing files (typically 3–5MB each) completes in 2–5 seconds on average, well within the 10–30s OS watchdog limits. All other files (e.g. `ambient_river.mp3` if the user is at sea, or the emergency siren) are not pre-fetched in the background, conserving battery and avoiding background watchdog terminations.
