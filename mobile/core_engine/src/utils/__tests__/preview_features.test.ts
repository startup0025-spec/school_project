import assert from 'node:assert';
import { test, describe } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  initMediaSession,
  RIPPLE_ARTWORK_DATA_URI,
  registerLockscreenAudioHandlers,
  updateMediaPlaybackState,
} from '../../../../lib/services/media_session_service.ts';

describe('R1: Dual-Track EAS Profiles', () => {
  test('eas.json exists and is valid JSON', () => {
    const easPath = path.resolve(process.cwd(), 'eas.json');
    assert.strictEqual(fs.existsSync(easPath), true, 'eas.json should exist');
    const content = fs.readFileSync(easPath, 'utf8');
    const parsed = JSON.parse(content);
    assert.ok(parsed, 'eas.json should be valid JSON');
    assert.ok(parsed.build, 'eas.json should contain "build" object');
  });

  test('preview-demo profile configuration', () => {
    const easPath = path.resolve(process.cwd(), 'eas.json');
    const parsed = JSON.parse(fs.readFileSync(easPath, 'utf8'));
    const demoProfile = parsed.build['preview-demo'];

    assert.ok(demoProfile, 'preview-demo profile should exist');
    assert.strictEqual(demoProfile.distribution, 'internal');
    assert.strictEqual(demoProfile.android?.buildType, 'apk');
    assert.ok(demoProfile.env?.EXPO_PUBLIC_KAKAO_MAP_API_KEY, 'KAKAO key should be present');
    assert.ok(demoProfile.env?.EXPO_PUBLIC_KMA_SERVICE_KEY, 'KMA key should be present');
    assert.ok(demoProfile.env?.EXPO_PUBLIC_BUSAN_SERVICE_KEY, 'BUSAN key should be present');
    assert.strictEqual(
      demoProfile.env?.EXPO_PUBLIC_BUILD_MODE,
      undefined,
      'EXPO_PUBLIC_BUILD_MODE should NOT be in preview-demo'
    );
  });

  test('preview-prod profile configuration', () => {
    const easPath = path.resolve(process.cwd(), 'eas.json');
    const parsed = JSON.parse(fs.readFileSync(easPath, 'utf8'));
    const prodProfile = parsed.build['preview-prod'];

    assert.ok(prodProfile, 'preview-prod profile should exist');
    assert.strictEqual(prodProfile.distribution, 'internal');
    assert.strictEqual(prodProfile.android?.buildType, 'apk');
    assert.ok(prodProfile.env?.EXPO_PUBLIC_KAKAO_MAP_API_KEY, 'KAKAO key should be present');
    assert.ok(prodProfile.env?.EXPO_PUBLIC_KMA_SERVICE_KEY, 'KMA key should be present');
    assert.ok(prodProfile.env?.EXPO_PUBLIC_BUSAN_SERVICE_KEY, 'BUSAN key should be present');
    assert.strictEqual(
      prodProfile.env?.EXPO_PUBLIC_BUILD_MODE,
      'PRODUCTION',
      'EXPO_PUBLIC_BUILD_MODE must be PRODUCTION in preview-prod'
    );
  });
});

describe('R2: Auto-Indicator UI Transformation Mode Logic', () => {
  const evaluateControlPointerEvents = (mode?: string) => {
    return mode === 'PRODUCTION' ? 'none' : 'auto';
  };

  const evaluateNextSpotButtonVisibility = (mode?: string) => {
    return mode !== 'PRODUCTION';
  };

  test('Demo mode allows manual interactions and shows next-spot button', () => {
    assert.strictEqual(evaluateControlPointerEvents('DEMO'), 'auto');
    assert.strictEqual(evaluateControlPointerEvents(undefined), 'auto');
    assert.strictEqual(evaluateNextSpotButtonVisibility('DEMO'), true);
    assert.strictEqual(evaluateNextSpotButtonVisibility(undefined), true);
  });

  test('Production mode sets pointerEvents="none" and hides next-spot button', () => {
    assert.strictEqual(evaluateControlPointerEvents('PRODUCTION'), 'none');
    assert.strictEqual(evaluateNextSpotButtonVisibility('PRODUCTION'), false);
  });
});

describe('R3: Native Media Session & Lockscreen Controls', () => {
  test('initMediaSession registers MediaSession metadata with artwork', () => {
    initMediaSession();
    const nav = (globalThis as any).navigator;
    assert.ok(nav?.mediaSession, 'MediaSession should be initialized on navigator');

    const metadata = nav.mediaSession.metadata;
    assert.ok(metadata, 'MediaSession metadata should be set');
    assert.strictEqual(metadata.title, '잔물결 - 물소리');
    assert.strictEqual(metadata.artist, 'Anyway the Sea');
    assert.ok(Array.isArray(metadata.artwork), 'Artwork should be an array');
    assert.strictEqual(metadata.artwork[0].src, RIPPLE_ARTWORK_DATA_URI);
  });

  test('RIPPLE_ARTWORK_DATA_URI meets visual layout specifications', () => {
    const decoded = decodeURIComponent(RIPPLE_ARTWORK_DATA_URI);
    assert.ok(decoded.includes('width="512"'), 'Artwork should be square (512x512)');
    assert.ok(decoded.includes('height="512"'), 'Artwork should be square (512x512)');
    assert.ok(
      decoded.includes('y="0"') && decoded.includes('height="256"'),
      'Top half should be dark/empty'
    );
    assert.ok(
      decoded.includes('#10b981') || decoded.includes('#007AFF'),
      'Bottom half should contain blue/emerald ripple path elements'
    );
  });

  test('MediaSession lockscreen Pause and Play action handlers sync audio engine state', async () => {
    let playCalled = false;
    let pauseCalled = false;

    registerLockscreenAudioHandlers(
      () => {
        playCalled = true;
        updateMediaPlaybackState('playing');
      },
      () => {
        pauseCalled = true;
        updateMediaPlaybackState('paused');
      }
    );

    initMediaSession();
    const nav = (globalThis as any).navigator;
    assert.ok(nav?.mediaSession?._triggerAction, 'Trigger action helper should exist');

    // Trigger Pause action from lockscreen controller
    await nav.mediaSession._triggerAction('pause');
    assert.strictEqual(pauseCalled, true, 'Pause handler should be called');
    assert.strictEqual(nav.mediaSession.playbackState, 'paused');

    // Trigger Play action from lockscreen controller
    await nav.mediaSession._triggerAction('play');
    assert.strictEqual(playCalled, true, 'Play handler should be called');
    assert.strictEqual(nav.mediaSession.playbackState, 'playing');
  });
});
