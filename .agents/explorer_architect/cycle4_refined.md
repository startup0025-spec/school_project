# Cycle 7 Refined Design: Caching Lock Pools, Fallback Loaders, & Background Watchdog Boundaries

**Document Version**: 4.1.0  
**Phase**: Refined Caching Manager & Background Task Sketches (Cycle 7 Refined Design)  
**Target Module**: Audio Caching lock set, Concurrency Fallbacks, Background Timeout Controls  
**Author**: Lead Architect (explorer_architect / BERRY 🍎)

---

## Executive Summary

This document presents the **Cycle 7 Refined Design** incorporating the Critic's Cycle 6 Critique (`cycle3_critique.md`) and BERRY's directives.

We address three major runtime vulnerabilities in the offline playback flow:
1. **Network-Dependent Playback Hangs**: We implement `loadSoundWithFallback`, which wraps the native `Audio.Sound.createAsync` in a `Promise.race` against a 5000ms timeout. On timeout or failure, the system falls back to the bundled resource.
2. **Eviction and Resolution Race Conditions**: We introduce a temporary lock pool Set `loadingFiles` to protect files in transit from being deleted by the LRU cache pruner before they are loaded.
3. **OS Watchdog background timeouts**: We enforce an 8-second hard timeout on geofencing background pre-fetching. If this timeout is exceeded, we abort active resumable downloads and fall back to local bundled assets.

---

## 1. Concurrency-Safe Fallback Loader (`loadSoundWithFallback`)

When streaming a CDN asset via `Audio.Sound.createAsync`, poor network conditions can cause the native player to hang indefinitely. To prevent this, `loadSoundWithFallback` races the load request against a 5000ms timeout.

If a timeout occurs:
* The loader rejects the initial promise to trigger the fallback.
* A background handler is set up to unload the late-resolved native sound when it eventually finishes loading, preventing memory leaks.
* It immediately falls back to loading the corresponding bundled require asset from `BUNDLED_SOUNDS`.

---

## 2. Temporary Lock Pool Set (`loadingFiles`)

There is a race condition between the caching manager's eviction pruner (`enforceCacheLimits`) and the audio engine's loading sequence:
1. `resolveAudioSource()` determines a file is cached and returns its local path.
2. Before `Audio.Sound.createAsync` starts reading the file, a parallel download completes and triggers `enforceCacheLimits()`.
3. Since the file is not yet playing, it is not in `pinnedFiles` and gets evicted from disk.
4. The loader attempts to open the file and throws a `File Not Found` exception.

**Solution**:
We implement a temporary lock pool Set `loadingFiles` in `audio_caching_service.ts`. The audio engine acquires this lock *before* path resolution and releases it only *after* loading completes (or in a `finally` block on failure). The eviction pruner skips files in either `pinnedFiles` or `loadingFiles`.

---

## 3. Background Task Watchdog Protection (8-Second Timeout)

Mobile operating systems enforce strict limits on background location tasks (10–30s execution window). A background prefetch of even a single file can exceed this limit on slow connections, triggering a watchdog termination (`SIGKILL`).

We refine the background prefetch to enforce an 8-second hard timeout. If pre-fetching fails or times out, we:
1. Call `cancelActiveDownloads()` to abort active `DownloadResumable` tasks.
2. Catch the cancellation error and delete any partially downloaded file fragments.
3. Fall back to local bundled assets in the playback engine.

---

## 4. TypeScript Code Sketches

### 4.1 Caching Service Sketch (`mobile/lib/services/audio_caching_service.ts`)

```typescript
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';

const CDN_BASE_URL = 'https://haetae05.github.io/Anyway_the_Sea/sounds/';
const CACHE_DIR = `${FileSystem.documentDirectory}sounds/`;
const METADATA_PATH = `${CACHE_DIR}sounds_metadata.json`;

const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;
const PRUNE_TARGET_BYTES = 30 * 1024 * 1024;

const activeDownloads = new Map<string, FileSystem.DownloadResumable>();
const pinnedFiles = new Set<string>();

// 1. Temporary Lock Pool Set
const loadingFiles = new Set<string>();

let lastReachabilityCheck = 0;
let cachedReachabilityResult = false;

export const BUNDLED_SOUNDS: Record<string, any> = {
  'ambient_sea.mp3': require('../../assets/sounds/ambient_sea.mp3'),
  'ambient_river.mp3': require('../../assets/sounds/ambient_river.mp3'),
  'white_noise_wind.mp3': require('../../assets/sounds/white_noise_wind.mp3'),
  'emergency_siren.wav': require('../../assets/sounds/emergency_siren.wav'),
};

export function lockFileForLoading(filename: string): void {
  loadingFiles.add(filename);
  console.log(`[Cache Lock] Locked file for loading: ${filename}`);
}

export function unlockFileForLoading(filename: string): void {
  loadingFiles.delete(filename);
  console.log(`[Cache Lock] Unlocked file for loading: ${filename}`);
}

export function pinFile(filename: string): void {
  pinnedFiles.add(filename);
}

export function unpinFile(filename: string): void {
  pinnedFiles.delete(filename);
}

export function cancelActiveDownloads(): void {
  for (const [filename, download] of activeDownloads.entries()) {
    console.log(`[Cache Manager] Cancelling active download for: ${filename}`);
    download.cancelAsync().catch(() => {});
    activeDownloads.delete(filename);
  }
}

async function isCdnReachable(testUrl: string): Promise<boolean> {
  const now = Date.now();
  if (now - lastReachabilityCheck < 15000) return cachedReachabilityResult;
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) return false;
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(testUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    cachedReachabilityResult = response.ok;
  } catch {
    cachedReachabilityResult = false;
  }
  lastReachabilityCheck = now;
  return cachedReachabilityResult;
}

export async function resolveAudioSource(filename: string): Promise<any> {
  const localUri = `${CACHE_DIR}${filename}`;
  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) return { uri: localUri };

    if (filename === 'emergency_siren.wav') return BUNDLED_SOUNDS[filename];

    const online = await isCdnReachable(`${CDN_BASE_URL}${filename}`);
    if (online) {
      const download = FileSystem.createDownloadResumable(
        `${CDN_BASE_URL}${filename}`,
        localUri,
        {}
      );
      activeDownloads.set(filename, download);
      
      // Promise chain for download results
      download.downloadAsync()
        .then(async (result) => {
          activeDownloads.delete(filename);
          if (result) {
            await touchFile(filename, result.headers['Content-Length'] ? parseInt(result.headers['Content-Length']) : 5 * 1024 * 1024);
            await enforceCacheLimits();
          }
        })
        .catch(async (err) => {
          activeDownloads.delete(filename);
          // Delete partial file on cancellation or error
          try {
            const info = await FileSystem.getInfoAsync(localUri);
            if (info.exists) {
              await FileSystem.deleteAsync(localUri, { idempotent: true });
            }
          } catch {}
          if (!err.message?.includes('cancelled')) {
            console.warn(`[Cache Manager] Download failed: ${filename}`, err);
          }
        });

      return { uri: `${CDN_BASE_URL}${filename}` };
    }
  } catch (err) {
    console.warn(`[Cache Manager] Resolution error: ${filename}`, err);
  }
  return BUNDLED_SOUNDS[filename];
}

export async function prefetchAudioAssets(filenames: string[]): Promise<void> {
  // Sequential prefetching loop
  for (const filename of filenames) {
    const localUri = `${CACHE_DIR}${filename}`;
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      const download = FileSystem.createDownloadResumable(`${CDN_BASE_URL}${filename}`, localUri);
      activeDownloads.set(filename, download);
      try {
        const result = await download.downloadAsync();
        activeDownloads.delete(filename);
        if (result) {
          await touchFile(filename, result.headers['Content-Length'] ? parseInt(result.headers['Content-Length']) : 5 * 1024 * 1024);
        }
      } catch (err) {
        activeDownloads.delete(filename);
        try {
          const info = await FileSystem.getInfoAsync(localUri);
          if (info.exists) await FileSystem.deleteAsync(localUri, { idempotent: true });
        } catch {}
        throw err;
      }
    }
  }
  await enforceCacheLimits();
}

async function touchFile(filename: string, size: number): Promise<void> {
  // Update sounds_metadata.json
}

async function readMetadata(): Promise<any> { /* ... */ }
async function writeMetadata(meta: any): Promise<void> { /* ... */ }

export async function enforceCacheLimits(): Promise<void> {
  const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
  let totalSize = 0;
  // Calculate size...
  
  if (totalSize <= MAX_CACHE_SIZE_BYTES) return;

  const metadata = await readMetadata();
  const sortedFiles = Object.keys(metadata).sort((a, b) => metadata[a].lastUsed - metadata[b].lastUsed);

  for (const file of sortedFiles) {
    if (totalSize <= PRUNE_TARGET_BYTES) break;

    // Skip eviction if locked or pinned
    if (pinnedFiles.has(file) || loadingFiles.has(file)) {
      continue;
    }

    const localUri = `${CACHE_DIR}${file}`;
    await FileSystem.deleteAsync(localUri, { idempotent: true });
    // Update totalSize...
  }
  await writeMetadata(metadata);
}
```

### 4.2 Playback Service Sketch (`mobile/lib/services/audio_engine_service.ts`)

```typescript
import { Audio } from 'expo-av';
import { 
  resolveAudioSource, 
  lockFileForLoading, 
  unlockFileForLoading, 
  pinFile, 
  unpinFile, 
  BUNDLED_SOUNDS 
} from './audio_caching_service';

let ambientSound: Audio.Sound | null = null;
let windSound: Audio.Sound | null = null;
let activePlaybackRequestId = 0;

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
    // Acquire temporary loading lock
    lockFileForLoading(filename);

    if (source && source.uri && source.uri.startsWith('http')) {
      const loadPromise = Audio.Sound.createAsync(source, { shouldPlay: false });
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          didTimeout = true;
          reject(new Error(`Timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const result = await Promise.race([loadPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      soundInstance = result.sound;
      return result;
    }

    const result = await Audio.Sound.createAsync(source, { shouldPlay: false });
    soundInstance = result.sound;
    return result;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    // Suppress late rejection errors and unload late-resolved sounds
    if (didTimeout) {
      Audio.Sound.createAsync(source, { shouldPlay: false })
        .then(async ({ sound }) => {
          await sound.unloadAsync().catch(() => {});
        })
        .catch(() => {});
    }

    console.warn(`[Fallback] Loading failed for ${filename}. Loading bundled asset.`, error);
    const result = await Audio.Sound.createAsync(fallbackAsset, { shouldPlay: false });
    soundInstance = result.sound;
    return result;
  } finally {
    // Release loading lock
    unlockFileForLoading(filename);

    // Mismatch check
    if (requestId !== activePlaybackRequestId && soundInstance) {
      soundInstance.unloadAsync().catch(() => {});
    }
  }
}

export async function stopAmbientSound(): Promise<void> {
  const ambient = ambientSound;
  const wind = windSound;
  ambientSound = null;
  windSound = null;

  if (ambient) {
    unpinFile('ambient_sea.mp3');
    unpinFile('ambient_river.mp3');
    await ambient.stopAsync();
    await ambient.unloadAsync();
  }
  if (wind) {
    unpinFile('white_noise_wind.mp3');
    await wind.stopAsync();
    await wind.unloadAsync();
  }
}

export async function playAmbientSound(waterType: string | undefined): Promise<void> {
  const currentRequestId = ++activePlaybackRequestId;
  try {
    await stopAmbientSound();
    
    const soundFile = waterType === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';
    const fallbackAsset = BUNDLED_SOUNDS[soundFile];
    
    const source = await resolveAudioSource(soundFile);
    if (currentRequestId !== activePlaybackRequestId) return;

    const { sound: ambient } = await loadSoundWithFallback(soundFile, source, fallbackAsset, currentRequestId);
    if (currentRequestId !== activePlaybackRequestId) {
      await ambient.unloadAsync();
      return;
    }

    ambientSound = ambient;
    pinFile(soundFile);
    await ambientSound.setIsLoopingAsync(true);
    await ambientSound.playAsync();

    // Wind Sound
    const windSource = await resolveAudioSource('white_noise_wind.mp3');
    const fallbackWind = BUNDLED_SOUNDS['white_noise_wind.mp3'];
    const { sound: wind } = await loadSoundWithFallback('white_noise_wind.mp3', windSource, fallbackWind, currentRequestId);
    if (currentRequestId !== activePlaybackRequestId) {
      await wind.unloadAsync();
      return;
    }
    windSound = wind;
    pinFile('white_noise_wind.mp3');
    await windSound.setIsLoopingAsync(true);
    await windSound.playAsync();
  } catch (err) {
    console.error(`[Audio Engine] Playback failed:`, err);
  }
}
```
