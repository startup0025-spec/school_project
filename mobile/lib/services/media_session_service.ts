import TrackPlayer, { AppKilledPlaybackBehavior, Capability, State, Event, Track } from 'react-native-track-player';
import { DeviceEventEmitter } from 'react-native';

export const RIPPLE_ARTWORK_DATA_URI =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0b132b"/>
      <stop offset="50%" stop-color="#0b132b"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
    <linearGradient id="ripple1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#007AFF"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <linearGradient id="ripple2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect x="0" y="0" width="512" height="256" fill="#0b132b"/>
  <path d="M 0 320 Q 128 280, 256 320 T 512 320 L 512 512 L 0 512 Z" fill="url(#ripple1)" opacity="0.8"/>
  <path d="M 0 370 Q 128 410, 256 370 T 512 370 L 512 512 L 0 512 Z" fill="url(#ripple2)" opacity="0.85"/>
  <path d="M 0 430 Q 128 390, 256 430 T 512 430 L 512 512 L 0 512 Z" fill="#10b981" opacity="0.7"/>
</svg>
`.trim());

let onLockscreenPlayHandler: (() => Promise<void> | void) | null = null;
let onLockscreenPauseHandler: (() => Promise<void> | void) | null = null;
let isSetup = false;

export function registerLockscreenAudioHandlers(
  onPlay: () => Promise<void> | void,
  onPause: () => Promise<void> | void
): void {
  onLockscreenPlayHandler = onPlay;
  onLockscreenPauseHandler = onPause;
}

DeviceEventEmitter.addListener('onMediaSessionPlay', async () => {
  if (onLockscreenPlayHandler) {
    await onLockscreenPlayHandler();
  }
});

DeviceEventEmitter.addListener('onMediaSessionPause', async () => {
  if (onLockscreenPauseHandler) {
    await onLockscreenPauseHandler();
  }
});

export async function initMediaSession(): Promise<void> {
  if (isSetup) return;
  try {
    await TrackPlayer.setupPlayer();
    
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
      ],
    });

    const dummyTrack: Track = {
      id: 'ambient-mix',
      url: require('@/assets/audio/ambient_river.mp3'),
      title: '잔물결 - 물소리',
      artist: 'Anyway the Sea',
      artwork: RIPPLE_ARTWORK_DATA_URI,
      duration: 3600, // Make it look like a 1-hour ambient track
    };

    await TrackPlayer.add([dummyTrack]);
    await TrackPlayer.setVolume(0); // We only use TrackPlayer for the lockscreen UI, not the audio output
    await TrackPlayer.setRepeatMode(1); // TrackRepeatMode.Track

    isSetup = true;
    console.log('[TrackPlayer] Setup complete.');
  } catch (err) {
    console.warn('[TrackPlayer] Failed to initialize MediaSession:', err);
  }
}

export async function updateMediaPlaybackState(state: 'playing' | 'paused' | 'none'): Promise<void> {
  if (!isSetup) return;
  try {
    if (state === 'playing') {
      await TrackPlayer.play();
    } else {
      await TrackPlayer.pause();
    }
  } catch (err) {
    console.warn('[TrackPlayer] Failed to update playbackState:', err);
  }
}
