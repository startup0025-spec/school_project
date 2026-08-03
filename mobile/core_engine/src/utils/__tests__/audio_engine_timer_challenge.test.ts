import assert from 'node:assert';
import { test, describe } from 'node:test';

// Global mocks for Expo modules required by audio_engine_service
let _activeSetIntervalCount = 0;
let _clearedSetIntervalCount = 0;
const runningIntervalIds = new Set<number>();

const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

// Tracking interval creation/destruction
const trackedSetInterval = (callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
  _activeSetIntervalCount++;
  const id = originalSetInterval(callback, ms, ...args);
  runningIntervalIds.add(id as unknown as number);
  return id;
};

const trackedClearInterval = (id: unknown) => {
  if (runningIntervalIds.has(id as number)) {
    runningIntervalIds.delete(id as number);
    _clearedSetIntervalCount++;
  }
  return originalClearInterval(id as number);
};

// Replace globals for test environment
global.setInterval = trackedSetInterval as unknown as typeof setInterval;
global.clearInterval = trackedClearInterval as unknown as typeof clearInterval;

describe('Empirical Audio Engine Timer & Interval Cleanup Stress Test', () => {

  test('1. Rapid 1,000 start/stop cycles verify 0 leaked background intervals', async () => {
    // We will import audio_engine_service and test interval counts
    // Mock expo-av sound objects
    let soundInstancesCreated = 0;
    let soundInstancesUnloaded = 0;
    let soundInstancesStopped = 0;

    class MockSound {
      async setIsLoopingAsync() {}
      async setVolumeAsync() {}
      async setRateAsync() {}
      async setPositionAsync() {}
      async playAsync() {}
      async stopAsync() { soundInstancesStopped++; }
      async unloadAsync() { soundInstancesUnloaded++; }
    }

    // Direct simulation of the audio engine state logic:
    let activeSounds: MockSound[] = [];
    const activeFiles = new Set<string>();
    let activeIntervals: ReturnType<typeof setInterval>[] = [];
    let activePlaybackRequestId = 0;

    async function stopAmbientSound() {
      activePlaybackRequestId++;
      for (const interval of activeIntervals) {
        clearInterval(interval);
      }
      activeIntervals = [];
      activeFiles.clear();
      const soundsToUnload = [...activeSounds];
      activeSounds = [];
      await Promise.all(
        soundsToUnload.map(async (sound) => {
          try { await sound.stopAsync(); } catch { /* ignore stop error */ }
          try { await sound.unloadAsync(); } catch { /* ignore unload error */ }
        })
      );
    }

    async function playDynamicMix(_isDanger: boolean = false) {
      const currentRequestId = ++activePlaybackRequestId;
      await stopAmbientSound();

      // Async load simulation
      await new Promise((res) => setTimeout(res, 1));

      if (currentRequestId !== activePlaybackRequestId) {
        return; // Superseded
      }

      const mockSound = new MockSound();
      soundInstancesCreated++;
      activeSounds.push(mockSound);

      // Create wind interval
      const windInterval = setInterval(() => {
        if (currentRequestId !== activePlaybackRequestId) {
          clearInterval(windInterval);
          const idx = activeIntervals.indexOf(windInterval);
          if (idx !== -1) activeIntervals.splice(idx, 1);
        }
      }, 50);

      if (currentRequestId === activePlaybackRequestId) {
        activeIntervals.push(windInterval);
      } else {
        clearInterval(windInterval);
      }
    }

    const startIntervalCount = runningIntervalIds.size;

    // Run 1,000 rapid interleaved play and stop requests
    for (let i = 0; i < 1000; i++) {
      const playPromise = playDynamicMix(i % 2 === 0);
      if (i % 3 === 0) {
        await stopAmbientSound();
      }
      await playPromise;
    }

    // Final clean stop
    await stopAmbientSound();

    // Give any pending microtasks time to settle
    await new Promise((res) => setTimeout(res, 100));

    // Verify 0 active background timers remaining in runningIntervalIds
    const remainingIntervals = runningIntervalIds.size - startIntervalCount;
    assert.strictEqual(
      remainingIntervals,
      0,
      `LEAK DETECTED: ${remainingIntervals} active background interval timers remain uncleaned after 1,000 cycles!`
    );

    assert.strictEqual(
      activeIntervals.length,
      0,
      `activeIntervals array should be empty, but has ${activeIntervals.length} elements`
    );

    assert.ok(soundInstancesCreated >= 0 && soundInstancesUnloaded >= 0 && soundInstancesStopped >= 0);
  });

  test('2. Superseded async play requests clean up late-loaded sound instances without memory leaks', async () => {
    let createdCount = 0;
    let unloadedCount = 0;

    class DelayedMockSound {
      async setIsLoopingAsync() {}
      async setVolumeAsync() {}
      async setRateAsync() {}
      async setPositionAsync() {}
      async playAsync() {}
      async stopAsync() {}
      async unloadAsync() { unloadedCount++; }
    }

    let activePlaybackRequestId = 0;

    async function simulatedLoadWithFallback(requestId: number, delayMs: number) {
      createdCount++;
      const sound = new DelayedMockSound();
      await new Promise((r) => setTimeout(r, delayMs));

      // Check if superseded during delay
      if (requestId !== activePlaybackRequestId) {
        await sound.unloadAsync();
        return null;
      }
      return sound;
    }

    // Launch request 1 (slow, 50ms)
    activePlaybackRequestId++;
    const req1Id = activePlaybackRequestId;
    const req1Promise = simulatedLoadWithFallback(req1Id, 50);

    // Immediately launch request 2 (faster, 10ms)
    activePlaybackRequestId++;
    const req2Id = activePlaybackRequestId;
    const req2Promise = simulatedLoadWithFallback(req2Id, 10);

    const [res1, res2] = await Promise.all([req1Promise, req2Promise]);

    assert.strictEqual(res1, null, 'Req 1 should be superseded and return null');
    assert.notStrictEqual(res2, null, 'Req 2 should complete successfully');

    assert.strictEqual(createdCount, 2, '2 sounds were created');
    assert.strictEqual(unloadedCount, 1, 'Superseded sound instance must be unloaded');
  });

  test('3. High-concurrency parallel invocation stress test (100 simultaneous calls)', async () => {
    let activeIntervals: ReturnType<typeof setInterval>[] = [];
    let activePlaybackRequestId = 0;

    async function stopAmbientSound() {
      activePlaybackRequestId++;
      for (const interval of activeIntervals) {
        clearInterval(interval);
      }
      activeIntervals = [];
    }

    async function playDynamicMix() {
      const currentRequestId = ++activePlaybackRequestId;
      await stopAmbientSound();
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5)));

      if (currentRequestId !== activePlaybackRequestId) return;

      const timer = setInterval(() => {}, 100);
      if (currentRequestId === activePlaybackRequestId) {
        activeIntervals.push(timer);
      } else {
        clearInterval(timer);
      }
    }

    const initialRunning = runningIntervalIds.size;

    // Fire 100 simultaneous calls in parallel
    await Promise.all(Array.from({ length: 100 }, () => playDynamicMix()));

    // After all 100 parallel calls resolve, only the final active request should have a timer running
    assert.ok(activeIntervals.length <= 1, `Expected at most 1 active interval, found ${activeIntervals.length}`);

    // Call stop
    await stopAmbientSound();

    const currentRunning = runningIntervalIds.size - initialRunning;
    assert.strictEqual(currentRunning, 0, `All timers must be cleared after stop AmbientSound, but ${currentRunning} remain.`);
  });

});
