# Cycle 9: Final Synthesized Architecture & Implementation Plan
## Audio CDN Streaming, Offline Caching, & Concurrency Control Overhaul

**Document Version**: 9.0.0  
**Phase**: Final Verified Architecture & Implementation Plan  
**Target Module**: Audio Caching Service, Concurrency-Safe Playback Service, Stabilized SWR Hook, Geofencing Background Tasks, Compile Error Remediation  
**Author**: Lead Architect (explorer_architect / BERRY 🍎)

---

## Executive Summary

This document presents the **Cycle 9 Final Synthesized Architecture & Implementation Plan**, outlining the verified, production-grade blueprints and integration procedures for the Audio CDN Streaming and caching systems in the Anyway the Sea mobile application.

This synthesized plan addresses all critiques up to Cycle 8, incorporating:
1. **TypeScript Compile Fix**: Import corrections in `notifications.tsx`.
2. **Audio Caching Service (`audio_caching_service.ts`)**:
   - Reference-counting `loadingFiles` lock Map to eliminate concurrent eviction race conditions.
   - Cache-first checking, sequential downloads, and active resumable downloads mapping.
   - `.downloadAsync()` promise chain resolution (fixing progress callback type errors).
   - Try-catch block ensuring partial file cleanup on download failure or cancellation.
   - LRU eviction (50MB down to 30MB) that respects active locks (pinned or loading files).
   - In-memory reachability cache (10s TTL) with 1.5s network timeout and `finally` block timer clear.
   - Fast-fail CDN reachability invalidation on pre-fetch failure/timeout.
3. **Concurrency-Safe Playback Service (`audio_engine_service.ts`)**:
   - Auto-incrementing `activePlaybackRequestId` concurrency lock.
   - `loadSoundWithFallback` helper utilizing `Promise.race` with 5s timeout and `didTimeout` state checks to unload late-resolved sounds and suppress late rejection errors.
   - Explicit unloader registration callback matching active engine files.
   - Safety siren network reachability check bypass.
4. **Geofencing background sequential download abort limits (8s hard timeout)** in `geofencing_service.ts` to prevent watchdog terminations.
5. **Stabilized SWR Sync Hook (`useSpots.ts`)**: Using dependency stringification to prevent redundant disk reads on revalidation.
6. **Detailed Step-by-Step Implementation Sequence**: Executable build commands and post-integration validation checks.

---

## 1. Pre-existing Compile Error Remediation

### 1.1 Target File & Code Modification
Modify the top imports of `mobile/app/notifications.tsx` to include `useState` and `useEffect` from `'react'`.

**Target Path**: `mobile/app/notifications.tsx`  
**Target Lines**: 1–2  

**Replacement Code**:
```typescript
import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
```

---

## 2. Dependencies & Package Strategy

### 2.1 package.json Modification
Add the following entries to the `dependencies` block of `mobile/package.json` to ensure Expo SDK 54 compatibility:

```json
"dependencies": {
  "expo-av": "^16.0.8",
  "expo-dev-client": "~6.0.21",
  "expo-file-system": "~18.0.8",
  "expo-network": "~18.0.8",
  "expo-notifications": "^57.0.3",
  "expo-task-manager": "^57.0.2",
  "swr": "^2.2.5"
}
```

### 2.2 Installation Commands
Run the installation command inside the `mobile` workspace directory:

```bash
cd mobile
npx expo install expo-file-system expo-network swr
```

---

## 3. Audio Caching Service (`mobile/lib/services/audio_caching_service.ts`)

The caching service provides a **cache-first resolution** flow: it checks if the audio file exists locally before running network reachability checks. It uses **resumable downloads** to support active download cancellation, and manages disk space using an **LRU eviction policy** that respects active file locks and pins.

### 3.1 Detailed Design Decisions
* **Reference-Counting lock pool Map**: If multiple concurrent load requests ask for the same file, a Set lock might unlock the file prematurely when one request resolves, while another request is still loading it. A reference counting Map (`Map<string, number>`) tracks the lock count per file. When a file begins loading, we increment the count. When it resolves/fails, we decrement it. If the count reaches 0, we delete it from the map. The file is considered locked as long as the count > 0.
* **Catch Block Cleanup**: If a download fails or is cancelled, we must delete any partial or corrupt file that might have been written to `localUri` so that the cache is not poisoned.
* **Reachability TTL Cache**: In-memory reachability cache with 10s TTL, 1.5s network timeout, and clears the timer in a `finally` block.
* **Fast-fail Invalidations**: If pre-fetching fails/times out, cached reachability is immediately set to `false`.

### 3.2 Complete File Sketch

Create the caching service file at `mobile/lib/services/audio_caching_service.ts`:

```typescript
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';

const CDN_BASE_URL = 'https://haetae05.github.io/Anyway_the_Sea/sounds/';
export const CACHE_DIR = `${FileSystem.documentDirectory}sounds/`;
const METADATA_PATH = `${CACHE_DIR}sounds_metadata.json`;

const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit
const PRUNE_TARGET_BYTES = 30 * 1024 * 1024;  // Prune down to 30MB

// Track active Resumable Downloads to allow cancellation on abort
export const activeDownloads = new Map<string, FileSystem.DownloadResumable>();

// Reachability Cache (10-second TTL)
let lastReachabilityCheck = 0;
let cachedReachabilityResult = false;

// Pinned files Set to prevent LRU eviction of playing files
const pinnedFiles = new Set<string>();

// Reference Counting Map for temporary lock pool
const loadingFiles = new Map<string, number>();

// Callback hooks for active sound checking and force unloading (deadlock prevention)
let activeSoundChecker: ((filename: string) => Promise<boolean>) | null = null;
let activeSoundUnloader: ((filename: string) => Promise<void>) | null = null;

export const BUNDLED_SOUNDS: Record<string, any> = {
  'ambient_sea.mp3': require('../../assets/sounds/ambient_sea.mp3'),
  'ambient_river.mp3': require('../../assets/sounds/ambient_river.mp3'),
  'white_noise_wind.mp3': require('../../assets/sounds/white_noise_wind.mp3'),
  'emergency_siren.wav': require('../../assets/sounds/emergency_siren.wav'),
};

interface FileMetadata {
  lastUsed: number; // timestamp
  size: number;
}

interface CacheMetadata {
  [filename: string]: FileMetadata;
}

/**
 * Register callbacks from the playback service to prevent evicting loaded tracks.
 */
export function registerActiveSoundController(
  checker: (filename: string) => Promise<boolean>,
  unloader: (filename: string) => Promise<void>
) {
  activeSoundChecker = checker;
  activeSoundUnloader = unloader;
}

export function lockFileForLoading(filename: string): void {
  const current = loadingFiles.get(filename) || 0;
  loadingFiles.set(filename, current + 1);
  console.log(`[Cache Lock] Acquired lock for ${filename} (ref count: ${current + 1})`);
}

export function unlockFileForLoading(filename: string): void {
  const current = loadingFiles.get(filename) || 0;
  if (current <= 1) {
    loadingFiles.delete(filename);
    console.log(`[Cache Lock] Released lock for ${filename}`);
  } else {
    loadingFiles.set(filename, current - 1);
    console.log(`[Cache Lock] Decremented lock for ${filename} (ref count: ${current - 1})`);
  }
}

export function isFileLoading(filename: string): boolean {
  const count = loadingFiles.get(filename) || 0;
  return count > 0;
}

export function pinFile(filename: string): void {
  pinnedFiles.add(filename);
  console.log(`[Cache Manager] File pinned: ${filename}`);
}

export function unpinFile(filename: string): void {
  pinnedFiles.delete(filename);
  console.log(`[Cache Manager] File unpinned: ${filename}`);
}

/**
 * In-memory reachability override (used when prefetch fails or times out).
 */
export function setCdnReachable(reachable: boolean): void {
  cachedReachabilityResult = reachable;
  lastReachabilityCheck = Date.now();
  console.log(`[Cache Manager] Reachability cache overridden: ${reachable}`);
}

/**
 * Checks CDN reachability with an in-memory TTL cache and fast-fail interface checks.
 */
async function isCdnReachable(testUrl: string): Promise<boolean> {
  const now = Date.now();
  if (now - lastReachabilityCheck < 10000) { // 10s TTL
    return cachedReachabilityResult;
  }

  let timeoutId: NodeJS.Timeout | null = null;
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      cachedReachabilityResult = false;
      lastReachabilityCheck = now;
      return false;
    }

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout

    const response = await fetch(testUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });

    cachedReachabilityResult = response.ok;
  } catch (error) {
    cachedReachabilityResult = false;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId); // Clear timer in finally block
    }
  }

  lastReachabilityCheck = now;
  return cachedReachabilityResult;
}

async function readMetadata(): Promise<CacheMetadata> {
  try {
    const info = await FileSystem.getInfoAsync(METADATA_PATH);
    if (!info.exists) return {};
    const content = await FileSystem.readAsStringAsync(METADATA_PATH);
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeMetadata(metadata: CacheMetadata): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(METADATA_PATH, JSON.stringify(metadata));
  } catch (err) {
    console.warn('[Cache Manager] Failed to write metadata file:', err);
  }
}

async function touchFile(filename: string, size: number): Promise<void> {
  const metadata = await readMetadata();
  metadata[filename] = {
    lastUsed: Date.now(),
    size
  };
  await writeMetadata(metadata);
}

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

    console.log(`[Cache Manager] Current cache footprint: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    if (totalSize <= MAX_CACHE_SIZE_BYTES) return;

    console.warn(`[Cache Manager] Cache limit exceeded. Initiating LRU Eviction...`);
    const metadata = await readMetadata();

    for (const key of Object.keys(metadata)) {
      if (!files.includes(key)) delete metadata[key];
    }

    const sortedFiles = Object.keys(metadata).sort((a, b) => metadata[a].lastUsed - metadata[b].lastUsed);

    for (const file of sortedFiles) {
      if (totalSize <= PRUNE_TARGET_BYTES) break;

      // Skip eviction if pinned or loading
      if (pinnedFiles.has(file) || isFileLoading(file)) {
        console.log(`[Cache Manager] File ${file} is protected (pinned/loading), skipping eviction.`);
        continue;
      }

      if (activeSoundChecker && activeSoundUnloader) {
        const isActive = await activeSoundChecker(file);
        if (isActive) {
          console.log(`[Cache Manager] File ${file} is active in expo-av. Unloading before eviction...`);
          await activeSoundUnloader(file);
        }
      }

      const localUri = `${CACHE_DIR}${file}`;
      console.log(`[Cache Pruner] Evicting oldest cached file: ${file}`);
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      
      const sizePruned = fileSizes[file] || metadata[file].size || 0;
      totalSize -= sizePruned;
      delete metadata[file];
    }

    await writeMetadata(metadata);
    console.log(`[Cache Manager] Eviction completed. New footprint: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.error('[Cache Manager] Failed to enforce cache limits:', error);
  }
}

export function cancelActiveDownloads(): void {
  for (const [filename, download] of activeDownloads.entries()) {
    console.log(`[Cache Manager] Cancelling active download for: ${filename}`);
    download.cancelAsync().catch(() => {});
    activeDownloads.delete(filename);
  }
}

/**
 * Resolves the playback source. Checks local cache FIRST.
 */
export async function resolveAudioSource(filename: string): Promise<any> {
  const localUri = `${CACHE_DIR}${filename}`;
  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      console.log(`[Audio Cache] Resolved to persistent local cache: ${localUri}`);
      await touchFile(filename, fileInfo.size);
      return { uri: localUri };
    }

    // Bypass network check for emergency siren
    if (filename === 'emergency_siren.wav') {
      console.log(`[Audio Cache] Bypassing network check for emergency siren, resolving to bundled asset.`);
      return BUNDLED_SOUNDS[filename];
    }

    // Cache Miss: Perform online status check
    const cdnUrl = `${CDN_BASE_URL}${filename}`;
    const online = await isCdnReachable(cdnUrl);

    if (online) {
      console.log(`[Audio Cache] Cache miss. Streaming from CDN: ${cdnUrl}`);
      
      // Asynchronously trigger background download
      const download = FileSystem.createDownloadResumable(cdnUrl, localUri, {});
      activeDownloads.set(filename, download);
      
      // DownloadAsync promise chain handles completion and errors safely
      download.downloadAsync()
        .then(async (downloadResult) => {
          activeDownloads.delete(filename);
          if (downloadResult) {
            console.log(`[Audio Cache] Download finished: ${filename}`);
            const size = downloadResult.headers['Content-Length'] ? parseInt(downloadResult.headers['Content-Length']) : 5 * 1024 * 1024;
            await touchFile(filename, size);
            await enforceCacheLimits();
          }
        })
        .catch(async (err) => {
          activeDownloads.delete(filename);
          // Catch block deletes partial temporary files on error/cancel
          try {
            const info = await FileSystem.getInfoAsync(localUri);
            if (info.exists) {
              console.log(`[Audio Cache] Cleaning up partial/cancelled file: ${localUri}`);
              await FileSystem.deleteAsync(localUri, { idempotent: true });
            }
          } catch (cleanupErr) {
            console.warn(`[Audio Cache] Cleanup failed for ${filename}:`, cleanupErr);
          }
          if (!err.message?.includes('cancelled')) {
            console.warn(`[Audio Cache] Background cache write failed: ${filename}`, err);
          }
        });
      
      return { uri: cdnUrl };
    }
  } catch (err) {
    console.warn(`[Audio Cache] Error resolving cache/network for ${filename}:`, err);
  }

  // Final fallback to bundled asset
  console.log(`[Audio Cache] Resolved to binary-bundled fallback: ${filename}`);
  return BUNDLED_SOUNDS[filename];
}

/**
 * Prefetch files sequentially to prevent cellular network choke on startup.
 */
export async function prefetchAudioAssets(filenames: string[]): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }

    for (const filename of filenames) {
      const localUri = `${CACHE_DIR}${filename}`;
      const fileInfo = await FileSystem.getInfoAsync(localUri);

      if (!fileInfo.exists) {
        const remoteUrl = `${CDN_BASE_URL}${filename}`;
        console.log(`[Audio Cache] Downloading missing asset: ${filename}`);
        
        const download = FileSystem.createDownloadResumable(remoteUrl, localUri);
        activeDownloads.set(filename, download);
        
        try {
          const result = await download.downloadAsync();
          activeDownloads.delete(filename);

          if (result) {
            const fileSize = result.headers['Content-Length'] ? parseInt(result.headers['Content-Length']) : 5 * 1024 * 1024;
            await touchFile(filename, fileSize);
          }
        } catch (err) {
          activeDownloads.delete(filename);
          // Delete partial temporary files on error/cancel
          try {
            const info = await FileSystem.getInfoAsync(localUri);
            if (info.exists) {
              await FileSystem.deleteAsync(localUri, { idempotent: true });
            }
          } catch {}
          throw err; // propagates to the timeout check in the geofencing handler
        }
      } else {
        await touchFile(filename, fileInfo.size);
      }
    }
    
    await enforceCacheLimits();
    console.log('[Audio Cache] Sequential prefetching batch completed.');
  } catch (error) {
    console.error('[Audio Cache] Batch prefetching failed:', error);
    throw error;
  }
}
```

---

## 4. Concurrency-Safe Playback Service (`mobile/lib/services/audio_engine_service.ts`)

The playback service enforces an auto-incrementing `activePlaybackRequestId` concurrency lock. Every async operation checks if it has been superseded by a newer request before altering state or allocating audio resources. 

### 4.1 Detailed Design Decisions
* **`loadSoundWithFallback` with Promise.race**: Runs the `Audio.Sound.createAsync` promise (wrapped with `.then` and `.catch` handlers to unload late-resolved sound instances and suppress late rejection errors) inside a `Promise.race` against a 5000ms timeout promise.
* **didTimeout State checks**: If the timeout triggers, the timeout promise rejects, `didTimeout` is set to `true`, and we fall back to loading the bundled require asset. The wrapped loading promise will handle its own late resolution/rejection independently (unloading the sound or suppressing the error cleanly) without starting a duplicate background loader.
* **Reference Locking Integration**: Acquires a temporary lock on the file by reference count increment before resolution, and releases it inside a `finally` block.

### 4.2 Complete File Sketch

Overwrite `mobile/lib/services/audio_engine_service.ts` with this implementation:

```typescript
import { Audio } from 'expo-av';
import { 
  resolveAudioSource, 
  cancelActiveDownloads, 
  pinFile, 
  unpinFile, 
  lockFileForLoading,
  unlockFileForLoading,
  registerActiveSoundController,
  BUNDLED_SOUNDS
} from './audio_caching_service';

let ambientSound: Audio.Sound | null = null;
let windSound: Audio.Sound | null = null;
let sirenSound: Audio.Sound | null = null;

// Track active filenames for pinning and force-unloading
let activeAmbientFile: string | null = null;
let activeWindFile: string | null = null;
let activeSirenFile: string | null = null;

let activePlaybackRequestId = 0;

// Register callbacks with caching service to handle eviction deadlock prevention
registerActiveSoundController(
  async (filename: string) => {
    return filename === activeAmbientFile || filename === activeWindFile || filename === activeSirenFile;
  },
  async (filename: string) => {
    if (filename === activeAmbientFile && ambientSound) {
      console.warn(`[Audio Engine] Eviction force-unload for active ambient file: ${filename}`);
      const sound = ambientSound;
      ambientSound = null;
      activeAmbientFile = null;
      unpinFile(filename);
      await sound.stopAsync();
      await sound.unloadAsync();
    }
    if (filename === activeWindFile && windSound) {
      console.warn(`[Audio Engine] Eviction force-unload for active wind file: ${filename}`);
      const sound = windSound;
      windSound = null;
      activeWindFile = null;
      unpinFile(filename);
      await sound.stopAsync();
      await sound.unloadAsync();
    }
    if (filename === activeSirenFile && sirenSound) {
      console.warn(`[Audio Engine] Eviction force-unload for active siren file: ${filename}`);
      const sound = sirenSound;
      sirenSound = null;
      activeSirenFile = null;
      unpinFile(filename);
      await sound.stopAsync();
      await sound.unloadAsync();
    }
  }
);

/**
 * CDN or local cache load helper that handles network delays with a timeout.
 * 
 * 1. Acquires a temporary lock via lockFileForLoading before resolution.
 * 2. Runs Audio.Sound.createAsync inside a Promise.race against a 5000ms timeout.
 * 3. Suppresses late rejection errors and unloads late-resolved sound instances.
 * 4. Releases the lock in a finally block.
 * 5. Falls back to BUNDLED_SOUNDS on error.
 */
async function loadSoundWithFallback(
  filename: string,
  source: any,
  fallbackAsset: any,
  requestId: number,
  timeoutMs: number = 5000
): Promise<{ sound: Audio.Sound }> {
  let didTimeout = false;
  let timeoutId: NodeJS.Timeout | null = null;
  let soundInstance: Audio.Sound | null = null;

  try {
    // 1. Acquire temporary loading lock before resolving
    lockFileForLoading(filename);

    if (source && source.uri && source.uri.startsWith('http')) {
      const loadPromise = Audio.Sound.createAsync(source, { shouldPlay: false });
      
      const wrappedLoadPromise = loadPromise
        .then((result) => {
          if (didTimeout) {
            console.log(`[Audio Fallback] Late-resolved sound for ${filename} unloaded.`);
            result.sound.unloadAsync().catch(() => {});
          }
          return result;
        })
        .catch((err) => {
          if (didTimeout) {
            console.log(`[Audio Fallback] Suppressed late-running loader error:`, err.message || err);
            return undefined as any;
          }
          throw err;
        });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          didTimeout = true;
          reject(new Error(`[Audio Fallback] Load timeout after ${timeoutMs}ms for ${filename}`));
        }, timeoutMs);
      });

      const result = await Promise.race([wrappedLoadPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      soundInstance = result?.sound;
      return result;
    }

    const result = await Audio.Sound.createAsync(source, { shouldPlay: false });
    soundInstance = result.sound;
    return result;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    console.warn(
      `[Audio Fallback] Load failed or timed out for ${filename}. ` +
      `Falling back to local bundled asset. Error:`,
      error.message || error
    );

    // 3. Immediately load the corresponding bundled require asset from BUNDLED_SOUNDS
    const result = await Audio.Sound.createAsync(fallbackAsset, { shouldPlay: false });
    soundInstance = result.sound;
    return result;
  } finally {
    // 4. Release/unlock the file after loading completes (or in a finally block if loading fails)
    unlockFileForLoading(filename);

    // 5. If request ID has changed in the meantime, unload the resolved sound instance
    if (requestId !== activePlaybackRequestId && soundInstance) {
      console.log(`[Audio Fallback] Request #${requestId} superseded during fallback loading. Unloading instance...`);
      soundInstance.unloadAsync().catch(() => {});
    }
  }
}

export async function configureBackgroundAudioSession(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    });
    console.log('[Audio Engine] Background session mode registered.');
  } catch (error) {
    console.error('[Audio Engine] Failed to configure background audio session:', error);
  }
}

export async function stopAmbientSound(): Promise<void> {
  try {
    const ambient = ambientSound;
    const wind = windSound;
    const siren = sirenSound;

    ambientSound = null;
    windSound = null;
    sirenSound = null;

    const ambientFile = activeAmbientFile;
    const windFile = activeWindFile;
    const sirenFile = activeSirenFile;

    activeAmbientFile = null;
    activeWindFile = null;
    activeSirenFile = null;

    if (ambientFile) unpinFile(ambientFile);
    if (windFile) unpinFile(windFile);
    if (sirenFile) unpinFile(sirenFile);

    if (ambient) {
      await ambient.stopAsync();
      await ambient.unloadAsync();
    }
    if (wind) {
      await wind.stopAsync();
      await wind.unloadAsync();
    }
    if (siren) {
      await siren.stopAsync();
      await siren.unloadAsync();
    }
    console.log('[Audio Engine] Stopped and unloaded all active audio tracks.');
  } catch (err) {
    console.error('[Audio Engine] Sound stop and release failed:', err);
  }
}

export async function playAmbientSound(waterType: string | undefined): Promise<void> {
  const currentRequestId = ++activePlaybackRequestId;
  console.log(`[Audio Engine] [Req #${currentRequestId}] Requested sound for: ${waterType || 'default'}`);

  try {
    cancelActiveDownloads();
    await stopAmbientSound();

    const soundFile = waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';
    const source = await resolveAudioSource(soundFile);
    
    if (currentRequestId !== activePlaybackRequestId) {
      console.log(`[Audio Engine] [Req #${currentRequestId}] Aborted: superseded during source resolution.`);
      return;
    }

    const fallbackAmbientAsset = BUNDLED_SOUNDS[soundFile];
    const { sound: ambient } = await loadSoundWithFallback(soundFile, source, fallbackAmbientAsset, currentRequestId);

    if (currentRequestId !== activePlaybackRequestId) {
      await ambient.unloadAsync();
      return;
    }

    ambientSound = ambient;
    activeAmbientFile = soundFile;
    pinFile(soundFile);
    
    await ambientSound.setIsLoopingAsync(true);
    await ambientSound.playAsync();
    console.log(`[Audio Engine] [Req #${currentRequestId}] Ambient track playing.`);

    // Mix wind noise
    const windSource = await resolveAudioSource('white_noise_wind.mp3');

    if (currentRequestId !== activePlaybackRequestId) {
      console.log(`[Audio Engine] [Req #${currentRequestId}] Aborted: superseded during wind source resolution.`);
      return;
    }

    const fallbackWindAsset = BUNDLED_SOUNDS['white_noise_wind.mp3'];
    const { sound: wind } = await loadSoundWithFallback('white_noise_wind.mp3', windSource, fallbackWindAsset, currentRequestId);

    if (currentRequestId !== activePlaybackRequestId) {
      await wind.unloadAsync();
      return;
    }

    windSound = wind;
    activeWindFile = 'white_noise_wind.mp3';
    pinFile('white_noise_wind.mp3');
    
    await windSound.setIsLoopingAsync(true);
    await windSound.playAsync();
    console.log(`[Audio Engine] [Req #${currentRequestId}] Wind track playing. Mixing complete.`);

  } catch (err) {
    console.error(`[Audio Engine] [Req #${currentRequestId}] Execution failed:`, err);
  }
}

/**
 * Emergency Danger Siren (Priority Bypasses Network Check)
 */
export async function playEmergencySiren(): Promise<void> {
  const currentRequestId = ++activePlaybackRequestId;
  console.log(`[Audio Engine] [Req #${currentRequestId}] PLAYING EMERGENCY SIREN!`);

  try {
    cancelActiveDownloads();
    await stopAmbientSound();

    // Bypasses network check. Resolves immediately via cache check or bundled fallback.
    const sirenSource = await resolveAudioSource('emergency_siren.wav');

    if (currentRequestId !== activePlaybackRequestId) return;

    const fallbackSirenAsset = BUNDLED_SOUNDS['emergency_siren.wav'];
    const { sound: siren } = await loadSoundWithFallback('emergency_siren.wav', sirenSource, fallbackSirenAsset, currentRequestId);

    if (currentRequestId !== activePlaybackRequestId) {
      await siren.unloadAsync();
      return;
    }

    sirenSound = siren;
    activeSirenFile = 'emergency_siren.wav';
    pinFile('emergency_siren.wav');
    
    await sirenSound.setIsLoopingAsync(true);
    await sirenSound.setVolumeAsync(1.0);
    await sirenSound.playAsync();
  } catch (err) {
    console.error(`[Audio Engine] [Req #${currentRequestId}] Siren failed:`, err);
  }
}
```

---

## 5. Headless Background Cache Pre-fetching Limits

Mobile operating systems enforce strict limits on background location tasks (10–30s execution window). A background prefetch of even a single file can exceed this limit on slow connections, triggering a watchdog termination (`SIGKILL`).

We refine the background prefetch to enforce an **8-second hard timeout**. If pre-fetching fails or times out, we:
1. Call `cancelActiveDownloads()` to abort active `DownloadResumable` tasks.
2. Catch the cancellation error and delete any partially downloaded file fragments.
3. Fall back to local bundled assets in the playback engine.

### 5.1 Geofencing Service Integration

Modify the transition handler inside `mobile/lib/services/geofencing_service.ts`:

```typescript
// mobile/lib/services/geofencing_service.ts (Excerpt)

import { 
  prefetchAudioAssets, 
  cancelActiveDownloads, 
  setCdnReachable 
} from './audio_caching_service';

async function processLocationUpdate(locations: Location.LocationObject[]): Promise<void> {
  // ... coordinates validation & filtering logic ...

  if (nextBin === 'INSIDE') {
    state.activePlaceId = targetPlace.id;
    await triggerWelcomeNotification(targetPlace);

    const ambientFile = targetPlace.waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';
    const immediateRequired = [ambientFile, 'white_noise_wind.mp3'];

    console.log(`[BG Geofencing] Transition INSIDE. Warming immediate assets: ${immediateRequired.join(', ')}`);
    
    try {
      // 1. Enforce a hard 8-second timeout limit for background pre-fetching
      const prefetchPromise = prefetchAudioAssets(immediateRequired);
      
      // Attach a catch block to handle/suppress late cancellation errors when downloads are aborted
      prefetchPromise.catch((err) => {
        console.warn('[BG Geofencing] Late/background prefetch promise rejection caught/suppressed:', err.message || err);
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PREFETCH_TIMEOUT')), 8000);
      });

      await Promise.race([prefetchPromise, timeoutPromise]);
    } catch (err: any) {
      if (err.message === 'PREFETCH_TIMEOUT') {
        console.warn('[BG Geofencing] Background prefetching timed out at 8s limit. Aborting downloads.');
        // 2. Abort active downloads using the resumable downloads map
        cancelActiveDownloads();
        // 3. Immediately set cached reachability to false to trigger offline playback fallback
        setCdnReachable(false);
      } else {
        console.warn('[BG Geofencing] Background prefetching failed:', err.message || err);
      }
    }

    // 4. Initiate playback (loadSoundWithFallback handles the local bundled fallback)
    await playAmbientSound(targetPlace.waterType);
  } else if (state.currentBin === 'INSIDE') {
    await stopAmbientSound();
  }
}
```

---

## 6. Stabilized SWR Sync Hook (`mobile/hooks/useSpots.ts`)

The SWR hook fetches spot locations. To avoid redundant disk reads (`FileSystem.getInfoAsync`) on every SWR revalidation render loop, we extract the required audio files, sort them, and compile them into a stable comma-separated dependency string. This stabilizes the React dependency array.

Create the custom hook at `mobile/hooks/useSpots.ts`:

```typescript
import useSWR from 'swr';
import { useEffect, useMemo } from 'react';
import { getPlaces } from '../core_engine/src/database/local_places';
import { prefetchAudioAssets } from '../lib/services/audio_caching_service';

/**
 * Custom hook to manage SWR fetching of spots and orchestrate background audio cache warming.
 */
export function useSpots() {
  const { data: spots, error, mutate } = useSWR('/api/spots', getPlaces, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const audioFilesString = useMemo(() => {
    if (!spots || spots.length === 0) return '';
    
    const audioFiles = new Set<string>();
    spots.forEach((spot) => {
      audioFiles.add(spot.waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3');
    });
    
    audioFiles.add('white_noise_wind.mp3');
    audioFiles.add('emergency_siren.wav');
    
    return Array.from(audioFiles).sort().join(',');
  }, [spots]);

  useEffect(() => {
    if (!audioFilesString) return;

    const filesArray = audioFilesString.split(',');
    console.log(`[Audio Warmup] Starting background cache warming for: ${filesArray.join(', ')}`);

    prefetchAudioAssets(filesArray).catch((err) => {
      console.warn('[Audio Warmup] Background cache warming failed:', err);
    });
  }, [audioFilesString]); // Triggers ONLY when the set of required audio assets actually changes

  return {
    spots,
    isLoading: !spots && !error,
    isError: error,
    mutate,
  };
}
```

---

## 7. Step-by-Step Implementation Sequence

Execute the integration in the following order:

```bash
# Step 1: Install new native dependencies via Expo package CLI (Run from mobile directory)
cd mobile
npx expo install expo-file-system expo-network swr

# Step 2: Implement the Caching Service
# Write the code to mobile/lib/services/audio_caching_service.ts

# Step 3: Implement the Concurrency-Safe Playback Service
# Overwrite mobile/lib/services/audio_engine_service.ts

# Step 4: Integrate background geofencing logic changes
# Edit mobile/lib/services/geofencing_service.ts

# Step 5: Implement the Stabilized SWR Hook
# Write the code to mobile/hooks/useSpots.ts

# Step 6: Fix compiler imports in notifications.tsx
# Edit mobile/app/notifications.tsx

# Step 7: Clear cache and verify type safety and compiles
npx expo start -c --dry-run
npm run typecheck
```

---

## 8. Testing & Verification Checklist

| Test Phase | Test Objective | Verification Method | Pass Criteria |
|---|---|---|---|
| **Dependency Build** | Autolink package compatibility | Run `npm run typecheck` and verify build output. | No bundler errors or unresolved module references. |
| **Bypass Logic** | Siren network reachability bypass | Unplug Wifi/Cellular network (offline). Trigger emergency siren. | `emergency_siren.wav` plays instantly via bundled fallback with no HEAD fetch timeout delay. |
| **Concurrency Lock** | Fast-switching playback protection | Tap spots A and B in rapid succession (under 200ms gap). | Request 1 logs abort message. Mismatched channels are unloaded. Only Spot B plays. No concurrent audio overlap. |
| **Download Aborts** | Save data on superseded requests | Rapidly switch spots during cache miss and monitor maps. | Mismatched active resumable downloads call `.cancelAsync()` and log aborts. |
| **Eviction Limits** | Cache boundary management | Mock audio files to exceed 50MB in total. | Oldest unused files are deleted. Active pinned files remain intact on disk. |
| **Eviction Race Protection** | Eviction locking validation | Trigger cache limits eviction during resolve step before createAsync completes. | Eviction pruner skips the loading files because they are locked in `loadingFiles` reference map. |
| **Deadlock Safety** | Active file eviction prevention | Trigger eviction while `ambient_sea.mp3` is playing. | Eviction manager skips `ambient_sea.mp3` since it's in the pinned set. Unloaded assets are deleted safely. |
| **Headless Limits** | OS watchdog compatibility | Trigger geofence event in background. Throttle network to 10KB/s. | Background task downloads only spot asset + wind. Task aborts downloads at 8s limit, sets reachability to false, and plays bundled fallback safely. |
| **Hook Stability** | Prevent rendering loops | Monitor hook effect counts on SWR refresh. | Pre-fetching executes exactly once on initial load; subsequent revalidation loops do not call `prefetchAudioAssets`. |
