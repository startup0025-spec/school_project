import assert from 'node:assert';
import { test, describe, beforeEach } from 'node:test';
import {
  initMediaSession,
  RIPPLE_ARTWORK_DATA_URI,
  registerLockscreenAudioHandlers,
  updateMediaPlaybackState,
} from '../../../../lib/services/media_session_service.ts';

/**
 * Simulated Audio Engine tracker mimicking audio_engine_service.ts state machine.
 */
class MockAudioEngine {
  public isPlaying = false;
  public activeSoundsCount = 0;
  public lastWaterType: string = 'stream';
  public playCalls = 0;
  public stopCalls = 0;

  public async playDynamicMix(waterType?: string): Promise<void> {
    if (waterType) {
      this.lastWaterType = waterType;
    }
    this.stopAmbientSoundSync();
    this.isPlaying = true;
    this.activeSoundsCount = 4; // 3 ambient + 1 wind
    this.playCalls++;
    updateMediaPlaybackState('playing');
  }

  public async stopAmbientSound(): Promise<void> {
    this.stopAmbientSoundSync();
  }

  private stopAmbientSoundSync(): void {
    this.isPlaying = false;
    this.activeSoundsCount = 0;
    this.stopCalls++;
    updateMediaPlaybackState('paused');
  }
}

describe('Adversarial Challenge: R3 Native Media Session & Audio Engine Sync', () => {
  let mockEngine: MockAudioEngine;

  beforeEach(() => {
    // Reset global navigator mediaSession state
    if (typeof globalThis !== 'undefined') {
      delete (globalThis as any).navigator?.mediaSession;
    }
    mockEngine = new MockAudioEngine();
  });

  describe('1. MediaSession Action Handlers & Audio Engine Synchronization', () => {
    test('Lockscreen Pause action halts audio engine and updates playbackState to paused', async () => {
      registerLockscreenAudioHandlers(
        async () => {
          await mockEngine.playDynamicMix();
        },
        async () => {
          await mockEngine.stopAmbientSound();
        }
      );

      initMediaSession();
      const nav = (globalThis as any).navigator;
      assert.ok(nav?.mediaSession?._triggerAction, 'MediaSession action trigger must exist');

      // Start engine playback
      await mockEngine.playDynamicMix('sea');
      assert.strictEqual(mockEngine.isPlaying, true);
      assert.strictEqual(mockEngine.activeSoundsCount, 4);
      assert.strictEqual(nav.mediaSession.playbackState, 'playing');

      // Trigger lockscreen Pause action
      await nav.mediaSession._triggerAction('pause');

      assert.strictEqual(mockEngine.isPlaying, false, 'Audio engine must be stopped after lockscreen pause');
      assert.strictEqual(mockEngine.activeSoundsCount, 0, 'Active sound instances must be 0 after pause');
      assert.strictEqual(nav.mediaSession.playbackState, 'paused', 'Playback state must be set to paused');
    });

    test('Lockscreen Play action resumes audio engine and updates playbackState to playing', async () => {
      registerLockscreenAudioHandlers(
        async () => {
          await mockEngine.playDynamicMix();
        },
        async () => {
          await mockEngine.stopAmbientSound();
        }
      );

      initMediaSession();
      const nav = (globalThis as any).navigator;

      // Ensure engine is initially stopped
      await mockEngine.stopAmbientSound();
      assert.strictEqual(mockEngine.isPlaying, false);
      assert.strictEqual(nav.mediaSession.playbackState, 'paused');

      // Trigger lockscreen Play action
      await nav.mediaSession._triggerAction('play');

      assert.strictEqual(mockEngine.isPlaying, true, 'Audio engine must resume playing after lockscreen play');
      assert.strictEqual(mockEngine.activeSoundsCount, 4, 'Active sound instances must be 4 after play');
      assert.strictEqual(nav.mediaSession.playbackState, 'playing', 'Playback state must be set to playing');
    });

    test('Adversarial Stress Test: Rapid toggling sequence (play -> pause -> play -> pause -> play -> pause) without crash or race condition', async () => {
      registerLockscreenAudioHandlers(
        async () => {
          await mockEngine.playDynamicMix();
        },
        async () => {
          await mockEngine.stopAmbientSound();
        }
      );

      initMediaSession();
      const nav = (globalThis as any).navigator;

      const actions = ['play', 'pause', 'play', 'pause', 'play', 'pause', 'play', 'pause', 'play', 'pause'];
      for (const act of actions) {
        await nav.mediaSession._triggerAction(act);
      }

      assert.strictEqual(mockEngine.playCalls, 5, 'Play handler called exactly 5 times');
      assert.strictEqual(mockEngine.stopCalls, 10, 'Stop calls = 5 explicit pause + 5 pre-play resets');
      assert.strictEqual(mockEngine.isPlaying, false, 'Final audio engine state must be stopped');
      assert.strictEqual(mockEngine.activeSoundsCount, 0, 'Final active sounds count must be 0');
      assert.strictEqual(nav.mediaSession.playbackState, 'paused', 'Final playback state must be paused');
    });

    test('Adversarial Stress Test: Concurrent action handler invocations handle execution without crashing', async () => {
      registerLockscreenAudioHandlers(
        async () => {
          await mockEngine.playDynamicMix();
        },
        async () => {
          await mockEngine.stopAmbientSound();
        }
      );

      initMediaSession();
      const nav = (globalThis as any).navigator;

      // Trigger concurrent play and pause actions
      await Promise.all([
        nav.mediaSession._triggerAction('play'),
        nav.mediaSession._triggerAction('pause'),
        nav.mediaSession._triggerAction('play'),
      ]);

      assert.ok(typeof mockEngine.isPlaying === 'boolean');
      assert.ok(['playing', 'paused'].includes(nav.mediaSession.playbackState));
    });

    test('Null/Unregistered handler fallback safe execution', async () => {
      initMediaSession();
      const nav = (globalThis as any).navigator;

      // Explicitly pass null handlers
      registerLockscreenAudioHandlers(null as any, null as any);

      // Should complete gracefully without crashing
      await nav.mediaSession._triggerAction('play');
      await nav.mediaSession._triggerAction('pause');
      assert.ok(true, 'Null handlers triggered without throwing exceptions');
    });
  });

  describe('2. Album Art Data URI Structure Verification', () => {
    test('Data URI prefix and mime-type check', () => {
      assert.ok(
        RIPPLE_ARTWORK_DATA_URI.startsWith('data:image/svg+xml;charset=utf-8,'),
        'Data URI must start with data:image/svg+xml;charset=utf-8,'
      );
    });

    test('Decoded SVG attributes: 512x512 canvas dimension', () => {
      const decoded = decodeURIComponent(RIPPLE_ARTWORK_DATA_URI);
      assert.ok(decoded.includes('width="512"'), 'SVG width must be 512');
      assert.ok(decoded.includes('height="512"'), 'SVG height must be 512');
      assert.ok(decoded.includes('viewBox="0 0 512 512"'), 'SVG viewBox must be 0 0 512 512');
    });

    test('Top half structure: empty/dark background rect at y=0, height=256', () => {
      const decoded = decodeURIComponent(RIPPLE_ARTWORK_DATA_URI);

      // Top half rect check: x="0" y="0" width="512" height="256" fill="#0b132b"
      const topHalfRectMatch = decoded.match(/<rect\s+x="0"\s+y="0"\s+width="512"\s+height="256"\s+fill="([^"]+)"\/>/);
      assert.ok(topHalfRectMatch, 'Top half rect element (x="0" y="0" width="512" height="256") must exist');

      const fillVal = topHalfRectMatch[1];
      assert.strictEqual(fillVal, '#0b132b', 'Top half rect fill must be dark (#0b132b)');

      // Verify no ripple paths start in top half (y < 256)
      const pathMatches = [...decoded.matchAll(/<path\s+d="M\s+\d+\s+(\d+)/g)];
      for (const match of pathMatches) {
        const startY = parseInt(match[1], 10);
        assert.ok(
          startY >= 256,
          `Ripple path start Y coordinate (${startY}) must be in the bottom half (>= 256)`
        );
      }
    });

    test('Bottom half structure: blue and emerald ripples present', () => {
      const decoded = decodeURIComponent(RIPPLE_ARTWORK_DATA_URI);

      // Check linear gradient definitions for blue (#007AFF, #3b82f6, #06b6d4) and emerald (#10b981, #064e3b)
      assert.ok(decoded.includes('#007AFF'), 'Gradient ripple1 must include blue (#007AFF)');
      assert.ok(decoded.includes('#10b981'), 'Gradient ripple1 must include emerald (#10b981)');
      assert.ok(decoded.includes('#3b82f6'), 'Gradient ripple2 must include blue (#3b82f6)');
      assert.ok(decoded.includes('#064e3b'), 'Gradient bg must include dark emerald (#064e3b)');

      // Check wave paths in bottom half
      assert.ok(decoded.includes('fill="url(#ripple1)"'), 'Path with ripple1 gradient fill must exist');
      assert.ok(decoded.includes('fill="url(#ripple2)"'), 'Path with ripple2 gradient fill must exist');
      assert.ok(decoded.includes('fill="#10b981"'), 'Path with solid emerald fill must exist');
    });

    test('MediaSession Metadata reflects artwork data URI correctly', () => {
      initMediaSession();
      const nav = (globalThis as any).navigator;
      const metadata = nav.mediaSession.metadata;

      assert.ok(metadata, 'Metadata must be defined');
      assert.strictEqual(metadata.title, '잔물결 - 물소리');
      assert.strictEqual(metadata.artist, 'Anyway the Sea');
      assert.strictEqual(metadata.album, 'Ambient Water Wave');
      assert.ok(Array.isArray(metadata.artwork), 'Artwork must be an array');
      assert.strictEqual(metadata.artwork.length, 1);
      assert.strictEqual(metadata.artwork[0].src, RIPPLE_ARTWORK_DATA_URI);
      assert.strictEqual(metadata.artwork[0].sizes, '512x512');
      assert.strictEqual(metadata.artwork[0].type, 'image/svg+xml');
    });
  });
});
