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
import {
  initMediaSession,
  updateMediaPlaybackState,
  registerLockscreenAudioHandlers,
  RIPPLE_ARTWORK_DATA_URI,
} from './media_session_service';

export { initMediaSession, RIPPLE_ARTWORK_DATA_URI };

let activeSounds: Audio.Sound[] = [];
const activeFiles = new Set<string>();
let activeIntervals: ReturnType<typeof setInterval>[] = [];

let activePlaybackRequestId = 0;
let lastWaterType: string | undefined = 'stream';

registerLockscreenAudioHandlers(
  async () => {
    await playDynamicMix(lastWaterType);
  },
  async () => {
    await stopAmbientSound();
  }
);

// Register callbacks with caching service to handle eviction deadlock prevention
registerActiveSoundController(
  async (filename: string) => {
    return activeFiles.has(filename);
  },
  async (filename: string) => {
    console.warn(`[Audio Engine] Eviction force-unload for active file: ${filename}`);
    await stopAmbientSound();
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
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let soundInstance: Audio.Sound | null = null;

  try {
    // 1. Acquire temporary loading lock before resolving
    lockFileForLoading(filename);

    if (source && source.uri && source.uri.startsWith('http')) {
      const loadPromise = Audio.Sound.createAsync(source, { shouldPlay: false });
      
      const wrappedLoadPromise = loadPromise
        .then((result: Awaited<ReturnType<typeof Audio.Sound.createAsync>>) => {
          if (didTimeout) {
            console.log(`[Audio Fallback] Late-resolved sound for ${filename} unloaded.`);
            result?.sound?.unloadAsync().catch(() => {});
          }
          return result;
        })
        .catch((err: unknown) => {
          if (didTimeout) {
            console.log(`[Audio Fallback] Suppressed late-running loader error:`, (err as Error)?.message || err);
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
    initMediaSession();
  } catch (error) {
    console.error('[Audio Engine] Failed to configure background audio session:', error);
    initMediaSession();
  }
}

export async function stopAmbientSound(): Promise<void> {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).navigator?.mediaSession) {
      (globalThis as any).navigator.mediaSession.playbackState = 'paused';
    }
    // 1. Clear volume envelope & playback intervals
    for (const interval of activeIntervals) {
      clearInterval(interval);
    }
    activeIntervals = [];

    // 2. Unpin active files
    for (const file of activeFiles) {
      unpinFile(file);
    }
    activeFiles.clear();

    // 3. Stop and unload 100% of active sound instances
    const soundsToUnload = [...activeSounds];
    activeSounds = [];

    await Promise.all(
      soundsToUnload.map(async (sound) => {
        try {
          await sound.stopAsync();
        } catch {}
        try {
          await sound.unloadAsync();
        } catch {}
      })
    );
    console.log('[Audio Engine] Stopped and unloaded all active audio tracks.');
  } catch (err) {
    console.error('[Audio Engine] Sound stop and release failed:', err);
  }
}

/**
 * Dynamic Multi-Instance Audio Mixing Engine
 * 
 * 1. Selects 3 random distinct ambient sound assets (sea_1..5 or river_1..5).
 * 2. Overlays all 3 instances with pitch/rate variation (0.95, 1.0, 1.05) and random position offset.
 * 3. Selects 1 random wind asset (wind_1..5) with real-time volume envelope fluctuation.
 */
export async function playDynamicMix(waterType: string | undefined): Promise<void> {
  if (waterType) {
    lastWaterType = waterType;
  }
  initMediaSession();
  if (typeof globalThis !== 'undefined' && (globalThis as any).navigator?.mediaSession) {
    (globalThis as any).navigator.mediaSession.playbackState = 'playing';
  }
  const currentRequestId = ++activePlaybackRequestId;
  console.log(`[Audio Engine] [Req #${currentRequestId}] Dynamic mix requested for waterType: ${waterType || 'default'}`);

  try {
    cancelActiveDownloads();
    await stopAmbientSound();

    // 1. Select 3 random distinct ambient sound assets out of 5
    const typeStr = waterType === 'sea' ? 'sea' : 'river';
    const pool = [1, 2, 3, 4, 5];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selectedAmbientIndices = pool.slice(0, 3);
    const ambientFiles = selectedAmbientIndices.map((idx) => `${typeStr}_${idx}.mp3`);
    const fallbackAmbientKey = typeStr === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';
    const defaultFallbackAmbient = BUNDLED_SOUNDS[fallbackAmbientKey];

    // 2. Select 1 random wind asset out of 5
    const randomWindIdx = Math.floor(Math.random() * 5) + 1;
    const windFile = `wind_${randomWindIdx}.mp3`;
    const defaultFallbackWind = BUNDLED_SOUNDS['white_noise_wind.mp3'];

    // 3. Load all 3 ambient sounds concurrently
    const baseRates = [0.95, 1.0, 1.05];
    const ambientPromises = ambientFiles.map(async (file, index) => {
      const fallbackAsset = BUNDLED_SOUNDS[file] || defaultFallbackAmbient;
      const source = await resolveAudioSource(file);
      if (currentRequestId !== activePlaybackRequestId) return null;
      const { sound } = await loadSoundWithFallback(file, source, fallbackAsset, currentRequestId);
      return { sound, file, rate: baseRates[index] || (0.92 + Math.random() * 0.16) };
    });

    const windPromise = (async () => {
      const fallbackAsset = BUNDLED_SOUNDS[windFile] || defaultFallbackWind;
      const source = await resolveAudioSource(windFile);
      if (currentRequestId !== activePlaybackRequestId) return null;
      const { sound } = await loadSoundWithFallback(windFile, source, fallbackAsset, currentRequestId);
      return { sound, file: windFile };
    })();

    const [ambientResults, windResult] = await Promise.all([
      Promise.all(ambientPromises),
      windPromise,
    ]);

    // Check if request was superseded during loading
    if (currentRequestId !== activePlaybackRequestId) {
      console.log(`[Audio Engine] [Req #${currentRequestId}] Superseded during async load. Unloading instances.`);
      for (const res of ambientResults) {
        if (res?.sound) await res.sound.unloadAsync().catch(() => {});
      }
      if (windResult?.sound) await windResult.sound.unloadAsync().catch(() => {});
      return;
    }

    // 4. Play ambient sounds overlaid with pitch/rate variation and random position offset
    for (const res of ambientResults) {
      if (!res) continue;
      const { sound, file, rate } = res;
      const offsetMs = Math.floor(Math.random() * 3000);

      await sound.setIsLoopingAsync(true);
      await sound.setRateAsync(rate, false).catch(() => {});
      await sound.setPositionAsync(offsetMs).catch(() => {});
      await sound.playAsync();

      pinFile(file);
      activeFiles.add(file);
      activeSounds.push(sound);
    }

    // 5. Play wind sound looping with real-time volume envelope animation
    if (windResult) {
      const { sound: windSound, file: wFile } = windResult;

      await windSound.setIsLoopingAsync(true);
      await windSound.setVolumeAsync(0.5);
      await windSound.playAsync();

      pinFile(wFile);
      activeFiles.add(wFile);
      activeSounds.push(windSound);

      // Volume envelope interval (fluctuates volume every 500-1000ms simulating wind gusts)
      if (currentRequestId === activePlaybackRequestId) {
        const windInterval = setInterval(async () => {
          if (currentRequestId !== activePlaybackRequestId) {
            clearInterval(windInterval);
            return;
          }
          try {
            if (windSound) {
              const gustVol = 0.3 + Math.random() * 0.5;
              await windSound.setVolumeAsync(gustVol);
            }
          } catch {
            // ignore error if sound was unloaded
          }
        }, 500 + Math.floor(Math.random() * 500));
        activeIntervals.push(windInterval);
      }
    }

    console.log(`[Audio Engine] [Req #${currentRequestId}] Organic dynamic mix active with ambient (${ambientFiles.join(', ')}) + wind (${windFile}).`);

  } catch (err) {
    console.error(`[Audio Engine] [Req #${currentRequestId}] Dynamic mix execution failed:`, err);
  }
}

/**
 * Backward compatibility alias for playDynamicMix
 */
export const playAmbientSound = playDynamicMix;

