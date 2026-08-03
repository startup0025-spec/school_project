import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
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
  registerLockscreenAudioHandlers,
  RIPPLE_ARTWORK_DATA_URI,
  updateMediaPlaybackState,
} from './media_session_service';

export const INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS = InterruptionModeIOS.MixWithOthers;
export const INTERRUPTION_MODE_ANDROID_DUCK_OTHERS = InterruptionModeAndroid.DuckOthers;

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
  source: unknown,
  fallbackAsset: unknown,
  requestId: number,
  timeoutMs: number = 5000
): Promise<{ sound: Audio.Sound }> {
  let didTimeout = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let soundInstance: Audio.Sound | null = null;

  try {
    // 1. Acquire temporary loading lock before resolving
    lockFileForLoading(filename);

    const sourceObj = source as { uri?: string };
    if (sourceObj && sourceObj.uri && sourceObj.uri.startsWith('http')) {
      const loadPromise = Audio.Sound.createAsync(source as { uri: string }, { shouldPlay: false });
      
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
            return undefined as unknown as { sound: Audio.Sound };
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

    const result = await Audio.Sound.createAsync(source as number, { shouldPlay: false });
    soundInstance = result.sound;
    return result;
  } catch (error: unknown) {
    if (timeoutId) clearTimeout(timeoutId);

    console.warn(
      `[Audio Fallback] Load failed or timed out for ${filename}. ` +
      `Falling back to local bundled asset. Error:`,
      (error as Error)?.message || error
    );

    // 3. Immediately load the corresponding bundled require asset from BUNDLED_SOUNDS
    const result = await Audio.Sound.createAsync(fallbackAsset as number, { shouldPlay: false });
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
      shouldDuckAndroid: true,
      interruptionModeIOS: INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS,
      interruptionModeAndroid: INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
    });
    console.log('[Audio Engine] Background session mode registered.');
    initMediaSession();
  } catch (error) {
    console.error('[Audio Engine] Failed to configure background audio session:', error);
    initMediaSession();
  }
}

export async function stopAmbientSound(): Promise<void> {
  activePlaybackRequestId++;
  try {
    updateMediaPlaybackState('paused');
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
        } catch {
          /* ignore stop error */
        }
        try {
          await sound.unloadAsync();
        } catch {
          /* ignore unload error */
        }
      })
    );
    console.log('[Audio Engine] Stopped and unloaded all active audio tracks.');
  } catch (err) {
    console.error('[Audio Engine] Sound stop and release failed:', err);
  }
}

export type WaterCategory = 'sea' | 'national_river' | 'lake' | 'local_river' | 'stream';

export interface WaterAudioProfile {
  typeStr: 'sea' | 'river';
  baseRates: number[];
  ambientVolume: number;
  windVolumeRange: [number, number];
  gustIntervalRange: [number, number];
  pitchCorrection: boolean;
}

export const WATER_AUDIO_PROFILES: Record<string, WaterAudioProfile> = {
  sea: {
    typeStr: 'sea',
    baseRates: [0.85, 0.95, 1.05],
    ambientVolume: 0.28,
    windVolumeRange: [0.07, 0.13],
    gustIntervalRange: [600, 1200],
    pitchCorrection: false,
  },
  national_river: {
    typeStr: 'river',
    baseRates: [0.90, 1.0, 1.08],
    ambientVolume: 0.13,
    windVolumeRange: [0.06, 0.11],
    gustIntervalRange: [500, 1000],
    pitchCorrection: false,
  },
  lake: {
    typeStr: 'river',
    baseRates: [0.72, 0.80, 0.88],
    ambientVolume: 0.08,
    windVolumeRange: [0.03, 0.07],
    gustIntervalRange: [800, 1600],
    pitchCorrection: false,
  },
  local_river: {
    typeStr: 'river',
    baseRates: [1.0, 1.08, 1.15],
    ambientVolume: 0.12,
    windVolumeRange: [0.05, 0.10],
    gustIntervalRange: [400, 800],
    pitchCorrection: false,
  },
  stream: {
    typeStr: 'river',
    baseRates: [1.18, 1.28, 1.38],
    ambientVolume: 0.11,
    windVolumeRange: [0.04, 0.08],
    gustIntervalRange: [300, 700],
    pitchCorrection: false,
  },
  river: {
    typeStr: 'river',
    baseRates: [1.0, 1.08, 1.15],
    ambientVolume: 0.12,
    windVolumeRange: [0.05, 0.10],
    gustIntervalRange: [400, 800],
    pitchCorrection: false,
  },
};

/**
 * Dynamic Multi-Instance Audio Mixing Engine
 * 
 * 1. Selects 3 random distinct ambient sound assets out of 5 (sea_1..5 or river_1..5).
 * 2. Overlays all 3 instances with pitch/rate frequency modulation and category-specific profile.
 * 3. Selects 1 random wind asset (wind_1..5) with real-time volume envelope fluctuation.
 * 4. Supports 5 distinct water categories: 연안 ('sea'), 국가하천 ('national_river'), 호소 ('lake'), 지방하천 ('local_river'), 세천 ('stream').
 */
export async function playDynamicMix(waterType: string | undefined, isDanger: boolean = false): Promise<void> {
  if (waterType) {
    lastWaterType = waterType;
  }
  initMediaSession();
  updateMediaPlaybackState('playing');

  let currentRequestId = 0;

  try {
    cancelActiveDownloads();
    await stopAmbientSound();
    currentRequestId = ++activePlaybackRequestId;
    console.log(`[Audio Engine] [Req #${currentRequestId}] Dynamic mix requested for waterType: ${waterType || 'default'}, isDanger: ${isDanger}`);

    // 1. Retrieve specific audio profile for the selected water category
    const categoryKey = (waterType && WATER_AUDIO_PROFILES[waterType]) ? waterType : 'stream';
    const profile = WATER_AUDIO_PROFILES[categoryKey] || WATER_AUDIO_PROFILES.stream;
    const typeStr = profile.typeStr;

    // 2. Select random distinct ambient sound assets out of 5
    const pool = [1, 2, 3, 4, 5];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const trackCount = 3;
    let selectedAmbientIndices = pool.slice(0, Math.min(trackCount, pool.length));
    const ambientFiles = selectedAmbientIndices.map((idx) => `${typeStr}_${idx}.mp3`);
    const fallbackAmbientKey = typeStr === 'sea' ? 'ambient_sea.mp3' : 'ambient_river.mp3';
    const defaultFallbackAmbient = BUNDLED_SOUNDS[fallbackAmbientKey];

    const defaultFallbackWind = BUNDLED_SOUNDS['white_noise_wind.mp3'];

    // 4. Load all ambient sounds concurrently using signature rates
    const baseRates = profile.baseRates;
    const ambientPromises = ambientFiles.map(async (file, index) => {
      const fallbackAsset = BUNDLED_SOUNDS[file] || defaultFallbackAmbient;
      const source = await resolveAudioSource(file);
      if (currentRequestId !== activePlaybackRequestId) return null;
      const { sound } = await loadSoundWithFallback(file, source, fallbackAsset, currentRequestId);
      return { sound, file, rate: baseRates[index] || profile.baseRates[0] };
    });

    const windPromises = Array.from({ length: 1 }).map(async () => {
      const randomWindIdx = Math.floor(Math.random() * 5) + 1;
      const windFile = `wind_${randomWindIdx}.mp3`;
      const fallbackAsset = BUNDLED_SOUNDS[windFile] || defaultFallbackWind;
      const source = await resolveAudioSource(windFile);
      if (currentRequestId !== activePlaybackRequestId) return null;
      const { sound } = await loadSoundWithFallback(windFile, source, fallbackAsset, currentRequestId);
      return { sound, file: windFile };
    });

    const [ambientResults, windResults] = await Promise.all([
      Promise.all(ambientPromises),
      Promise.all(windPromises),
    ]);

    // Check if request was superseded during loading
    if (currentRequestId !== activePlaybackRequestId) {
      console.log(`[Audio Engine] [Req #${currentRequestId}] Superseded during async load. Unloading instances.`);
      for (const res of ambientResults) {
        if (res?.sound) await res.sound.unloadAsync().catch(() => {});
      }
      for (const res of windResults) {
        if (res?.sound) await res.sound.unloadAsync().catch(() => {});
      }
      return;
    }

    // 5. Play ambient sounds overlaid with pitch/rate variation, volume balance, and random position offset
    for (const res of ambientResults) {
      if (!res) continue;
      const { sound, file, rate } = res;
      const offsetMs = Math.floor(Math.random() * 3000);

      await sound.setIsLoopingAsync(true);
      const ambVol = isDanger ? 1.0 : profile.ambientVolume;
      await sound.setVolumeAsync(ambVol).catch(() => {});
      await sound.setRateAsync(rate, profile.pitchCorrection).catch(() => {});
      await sound.setPositionAsync(offsetMs).catch(() => {});
      await sound.playAsync();

      pinFile(file);
      activeFiles.add(file);
      activeSounds.push(sound);
    }

    // 6. Play wind sound looping with real-time volume envelope animation
    for (const windResult of windResults) {
      if (!windResult) continue;
      const { sound: windSound, file: wFile } = windResult;
      const initialWindVol = isDanger ? 1.0 : (profile.windVolumeRange[0] + profile.windVolumeRange[1]) / 2;

      await windSound.setIsLoopingAsync(true);
      await windSound.setVolumeAsync(initialWindVol).catch(() => {});
      await windSound.setPositionAsync(Math.floor(Math.random() * 3000)).catch(() => {});
      await windSound.playAsync();

      pinFile(wFile);
      activeFiles.add(wFile);
      activeSounds.push(windSound);

      // Volume envelope interval (fluctuates volume simulating wind gusts according to category profile)
      if (currentRequestId === activePlaybackRequestId) {
        const [minVol, maxVol] = profile.windVolumeRange;
        const [minInterval, maxInterval] = profile.gustIntervalRange;

        const windInterval = setInterval(async () => {
          if (currentRequestId !== activePlaybackRequestId) {
            clearInterval(windInterval);
            const idx = activeIntervals.indexOf(windInterval);
            if (idx !== -1) {
              activeIntervals.splice(idx, 1);
            }
            return;
          }
          try {
            if (windSound) {
              const gustVol = isDanger 
                ? (0.9 + Math.random() * 0.1) 
                : (minVol + Math.random() * (maxVol - minVol));
              await windSound.setVolumeAsync(gustVol);
            }
          } catch {
            // ignore error if sound was unloaded
          }
        }, isDanger ? (100 + Math.floor(Math.random() * 150)) : (minInterval + Math.floor(Math.random() * (maxInterval - minInterval))));

        activeIntervals.push(windInterval);
      }
    }

    console.log(`[Audio Engine] [Req #${currentRequestId}] Dynamic mix active for '${categoryKey}' with ambient (${ambientFiles.length} tracks) + wind (${windResults.length} tracks).`);

  } catch (err) {
    console.error(`[Audio Engine] [Req #${currentRequestId}] Dynamic mix execution failed:`, err);
  }
}

/**
 * Backward compatibility alias for playDynamicMix
 */
export const playAmbientSound = playDynamicMix;

