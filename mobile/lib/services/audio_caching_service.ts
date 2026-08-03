import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import seaFallback from '../../assets/sounds/ambient_sea.mp3';
import riverFallback from '../../assets/sounds/ambient_river.mp3';
import windFallback from '../../assets/sounds/white_noise_wind.mp3';
import sirenFallback from '../../assets/sounds/emergency_siren.wav';
import sea1 from '../../assets/sounds/sea_1.mp3';
import sea2 from '../../assets/sounds/sea_2.mp3';
import sea3 from '../../assets/sounds/sea_3.mp3';
import sea4 from '../../assets/sounds/sea_4.mp3';
import sea5 from '../../assets/sounds/sea_5.mp3';
import river1 from '../../assets/sounds/river_1.mp3';
import river2 from '../../assets/sounds/river_2.mp3';
import river3 from '../../assets/sounds/river_3.mp3';
import river4 from '../../assets/sounds/river_4.mp3';
import river5 from '../../assets/sounds/river_5.mp3';
import wind1 from '../../assets/sounds/wind_1.mp3';
import wind2 from '../../assets/sounds/wind_2.mp3';
import wind3 from '../../assets/sounds/wind_3.mp3';
import wind4 from '../../assets/sounds/wind_4.mp3';
import wind5 from '../../assets/sounds/wind_5.mp3';

const CDN_BASE_URL = 'https://startup0025-spec.github.io/school_project/sounds/';
export const CACHE_DIR = `${FileSystem.documentDirectory}sounds/`;
const METADATA_PATH = `${CACHE_DIR}sounds_metadata.json`;

const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit
const PRUNE_TARGET_BYTES = 30 * 1024 * 1024;  // Prune down to 30MB

// Track active Resumable Downloads to allow cancellation on abort
export const activeDownloads = new Map<string, ReturnType<typeof FileSystem.createDownloadResumable>>();

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

export const BUNDLED_SOUNDS: Record<string, unknown> = {
  'ambient_sea.mp3': seaFallback,
  'ambient_river.mp3': riverFallback,
  'white_noise_wind.mp3': windFallback,
  'emergency_siren.wav': sirenFallback,
  'sea_1.mp3': sea1,
  'sea_2.mp3': sea2,
  'sea_3.mp3': sea3,
  'sea_4.mp3': sea4,
  'sea_5.mp3': sea5,
  'river_1.mp3': river1,
  'river_2.mp3': river2,
  'river_3.mp3': river3,
  'river_4.mp3': river4,
  'river_5.mp3': river5,
  'wind_1.mp3': wind1,
  'wind_2.mp3': wind2,
  'wind_3.mp3': wind3,
  'wind_4.mp3': wind4,
  'wind_5.mp3': wind5,
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

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
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
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
    const metadata = await readMetadata();
    metadata[filename] = {
      lastUsed: Date.now(),
      size
    };
    await writeMetadata(metadata);
  } catch (err) {
    console.warn(`[Cache Manager] touchFile failed for ${filename}:`, err);
  }
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
export async function resolveAudioSource(filename: string): Promise<unknown> {
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
      
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }

      // Asynchronously trigger background download
      const download = FileSystem.createDownloadResumable(cdnUrl, localUri, {});
      activeDownloads.set(filename, download);
      
      // DownloadAsync promise chain handles completion and errors safely
      download.downloadAsync()
        .then(async (downloadResult: FileSystem.FileSystemDownloadResult | undefined) => {
          if (downloadResult) {
            console.log(`[Audio Cache] Download finished: ${filename}`);
            const rawLength = downloadResult.headers?.['content-length'] || downloadResult.headers?.['Content-Length'];
            const size = rawLength ? parseInt(rawLength, 10) : 5 * 1024 * 1024;
            await touchFile(filename, size);
            await enforceCacheLimits();
          }
        })
        .catch(async (err: unknown) => {
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
          if (!(err as Error)?.message?.includes('cancelled')) {
            console.warn(`[Audio Cache] Background cache write failed: ${filename}`, err);
          }
        })
        .finally(() => {
          activeDownloads.delete(filename);
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
          if (result) {
            const rawLength = result.headers?.['content-length'] || result.headers?.['Content-Length'];
            const fileSize = rawLength ? parseInt(rawLength, 10) : 5 * 1024 * 1024;
            await touchFile(filename, fileSize);
          }
        } catch (err) {
          // Delete partial temporary files on error/cancel
          try {
            const info = await FileSystem.getInfoAsync(localUri);
            if (info.exists) {
              await FileSystem.deleteAsync(localUri, { idempotent: true });
            }
          } catch {
            /* ignore cleanup error */
          }
          throw err;
        } finally {
          activeDownloads.delete(filename);
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
