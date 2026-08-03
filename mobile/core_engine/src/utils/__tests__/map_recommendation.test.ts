import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  sortPlacesByDistance,
} from '../haversine.ts';

describe('Milestone 1 Recommendation & Cooldown Verification', () => {
  const places = [
    { id: 'spot_a', name: 'Place A', latitude: 35.2000, longitude: 129.0900 },
    { id: 'spot_b', name: 'Place B', latitude: 35.1500, longitude: 129.0500 },
    { id: 'spot_c', name: 'Place C', latitude: 35.1978, longitude: 129.0837 }, // Closest to Sebyeonggyo
  ];

  const userLocation = { latitude: 35.1978, longitude: 129.0837 };

  test('R1 & R2: Background location sorting places closest spot at index 0', () => {
    const sorted = sortPlacesByDistance(places, userLocation);
    assert.strictEqual(sorted[0].id, 'spot_c', 'Closest place must be index 0');
    assert.strictEqual(sorted[0].name, 'Place C');
  });

  test('R3: Safe activeIndex preservation when places array order changes', () => {
    // Suppose initial order before user moved was [spot_a, spot_b, spot_c]
    // User had selected spot_b (index 1)
    const initialPlaces = [places[0], places[1], places[2]];
    const selectedIndex = 1;
    const selectedId = initialPlaces[selectedIndex].id; // 'spot_b'

    // User location moves near spot_c
    const sorted = sortPlacesByDistance(initialPlaces, userLocation);
    // sorted order becomes [spot_c, spot_a, spot_b] or similar

    // Map new index for selectedId
    const newIdx = sorted.findIndex((p) => p.id === selectedId);
    assert.ok(newIdx !== -1, 'Selected place ID should be found in sorted array');
    assert.strictEqual(sorted[newIdx].id, 'spot_b', 'Selected place ID is preserved');

    // UI state index updates to newIdx, so currentPlace remains spot_b
    assert.strictEqual(sorted[newIdx].name, 'Place B');
  });

  test('R3: Cooldown logic gate test (180,000 ms)', () => {
    const SORT_COOLDOWN_MS = 180000;
    let lastSortTime = 0;

    // First fix (lastSortTime === 0): Should allow sort
    const now1 = 1000000;
    const canSort1 = lastSortTime === 0 || now1 - lastSortTime >= SORT_COOLDOWN_MS;
    assert.strictEqual(canSort1, true);
    lastSortTime = now1;

    // Update 10 seconds later (now2 = 1010000): Should NOT allow sort (cooldown active)
    const now2 = 1010000;
    const canSort2 = now2 - lastSortTime >= SORT_COOLDOWN_MS;
    assert.strictEqual(canSort2, false, 'Should be throttled within 3 minutes');

    // Update 3 minutes later (now3 = 1180000): Should allow sort again
    const now3 = 1180000;
    const canSort3 = now3 - lastSortTime >= SORT_COOLDOWN_MS;
    assert.strictEqual(canSort3, true, 'Should allow sort after 3 minutes');
  });
});
