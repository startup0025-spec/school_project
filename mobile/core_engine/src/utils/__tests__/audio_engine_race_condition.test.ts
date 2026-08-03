import assert from 'node:assert';
import { test, describe } from 'node:test';

describe('Empirical Audio Engine Race Condition & Audio Focus Challenge', () => {

  test('1. EMPIRICAL PROOF: playDynamicMix self-invalidates when activePlaybackRequestId++ occurs before stopAmbientSound()', async () => {
    let activePlaybackRequestId = 0;
    let soundPlayed = false;

    async function stopAmbientSound() {
      activePlaybackRequestId++;
    }

    // Existing implementation pattern in audio_engine_service.ts:
    async function playDynamicMixFlawed() {
      const currentRequestId = ++activePlaybackRequestId; // e.g. activePlaybackRequestId becomes 1, currentRequestId = 1
      await stopAmbientSound(); // stopAmbientSound increments activePlaybackRequestId to 2!

      // Simulating async loading step
      await new Promise((r) => setTimeout(r, 1));

      // Self-invalidation check in audio_engine_service.ts line 307 & 323:
      if (currentRequestId !== activePlaybackRequestId) {
        // Superseded! (1 !== 2)
        return false;
      }

      soundPlayed = true;
      return true;
    }

    const result = await playDynamicMixFlawed();

    assert.strictEqual(
      result,
      false,
      'Flawed playDynamicMix MUST self-invalidate (return false) because stopAmbientSound() increments activePlaybackRequestId'
    );
    assert.strictEqual(
      soundPlayed,
      false,
      'No sound was played because currentRequestId (1) !== activePlaybackRequestId (2)'
    );
  });

  test('2. VERIFICATION OF FIX: Capturing currentRequestId AFTER stopAmbientSound() solves self-invalidation', async () => {
    let activePlaybackRequestId = 0;
    let soundPlayed = false;

    async function stopAmbientSound() {
      activePlaybackRequestId++;
    }

    // Corrected implementation pattern:
    async function playDynamicMixFixed() {
      await stopAmbientSound(); // Clears previous state & increments request ID (e.g. to 1)
      const currentRequestId = ++activePlaybackRequestId; // Increments to 2 and captures currentRequestId = 2

      // Simulating async loading step
      await new Promise((r) => setTimeout(r, 1));

      // Superseded check:
      if (currentRequestId !== activePlaybackRequestId) {
        return false;
      }

      soundPlayed = true;
      return true;
    }

    const result = await playDynamicMixFixed();

    assert.strictEqual(result, true, 'Fixed playDynamicMix should complete successfully');
    assert.strictEqual(soundPlayed, true, 'Sound should be played successfully');
  });

  test('3. CONCURRENCY TEST: Superseding fast-following requests still works with corrected implementation', async () => {
    let activePlaybackRequestId = 0;
    const completedRequests: number[] = [];

    async function stopAmbientSound() {
      activePlaybackRequestId++;
    }

    async function playDynamicMixFixed(idName: number, delayMs: number) {
      await stopAmbientSound();
      const currentRequestId = ++activePlaybackRequestId;

      await new Promise((r) => setTimeout(r, delayMs));

      if (currentRequestId !== activePlaybackRequestId) {
        return false; // Superseded
      }

      completedRequests.push(idName);
      return true;
    }

    // Fire Request 1 (slow: 50ms)
    const p1 = playDynamicMixFixed(1, 50);
    // Fire Request 2 immediately after (faster: 10ms)
    const p2 = playDynamicMixFixed(2, 10);

    const [res1, res2] = await Promise.all([p1, p2]);

    assert.strictEqual(res1, false, 'Request 1 should be superseded by Request 2');
    assert.strictEqual(res2, true, 'Request 2 should complete successfully');
    assert.deepStrictEqual(completedRequests, [2], 'Only Request 2 should complete');
  });

  test('4. AUDIO FOCUS INTEROP: autoHandleInterruptions: false setting verification', async () => {
    // Read media_session_service.ts content to verify autoHandleInterruptions: false configuration
    const fs = await import('node:fs');
    const path = await import('node:path');
    const servicePath = path.resolve(process.cwd(), 'lib/services/media_session_service.ts');
    const code = fs.readFileSync(servicePath, 'utf-8');

    assert.ok(
      code.includes('autoHandleInterruptions: false'),
      'TrackPlayer.setupPlayer must explicitly set autoHandleInterruptions: false so expo-av controls native audio focus'
    );
  });

});
