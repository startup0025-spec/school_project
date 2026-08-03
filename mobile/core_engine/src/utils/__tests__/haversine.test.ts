import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  isValidCoordinate,
  getHaversineDistance,
  sortPlacesByDistance,
} from '../haversine.ts';

describe('isValidCoordinate', () => {
  test('valid coordinates return true', () => {
    assert.strictEqual(isValidCoordinate(35.1796, 129.0756), true); // Busan
    assert.strictEqual(isValidCoordinate(0, 0), true);
    assert.strictEqual(isValidCoordinate(-90, -180), true);
    assert.strictEqual(isValidCoordinate(90, 180), true);
  });

  test('invalid latitude returns false', () => {
    assert.strictEqual(isValidCoordinate(91, 129.0756), false);
    assert.strictEqual(isValidCoordinate(-90.1, 129.0756), false);
    assert.strictEqual(isValidCoordinate(NaN, 129.0756), false);
    assert.strictEqual(isValidCoordinate(Infinity, 129.0756), false);
    assert.strictEqual(isValidCoordinate(null as unknown as number, 129.0756), false);
    assert.strictEqual(isValidCoordinate(undefined as unknown as number, 129.0756), false);
  });

  test('invalid longitude returns false', () => {
    assert.strictEqual(isValidCoordinate(35.1796, 181), false);
    assert.strictEqual(isValidCoordinate(35.1796, -180.1), false);
    assert.strictEqual(isValidCoordinate(35.1796, NaN), false);
    assert.strictEqual(isValidCoordinate(35.1796, Infinity), false);
    assert.strictEqual(isValidCoordinate(35.1796, null as unknown as number), false);
    assert.strictEqual(isValidCoordinate(35.1796, undefined as unknown as number), false);
  });
});

describe('getHaversineDistance', () => {
  test('identical points return 0', () => {
    const dist = getHaversineDistance(35.1796, 129.0756, 35.1796, 129.0756);
    assert.strictEqual(dist, 0);
  });

  test('known distance between two points in Busan', () => {
    // Sebyeonggyo (35.1978, 129.0837) to Oncheoncheon Park (35.2045, 129.0882)
    // Distance is approximately 840 - 860 meters
    const dist = getHaversineDistance(35.1978, 129.0837, 35.2045, 129.0882);
    assert.ok(dist > 800 && dist < 950, `Expected ~850m, got ${dist}`);
  });

  test('returns NaN for invalid coordinates', () => {
    assert.ok(Number.isNaN(getHaversineDistance(999, 129, 35.1, 129.1)));
    assert.ok(Number.isNaN(getHaversineDistance(35.1, 129.1, NaN, 129.1)));
  });

  test('floating point precision clamping safeguard', () => {
    // Tests near extreme values without domain errors in atan2/sqrt
    const dist = getHaversineDistance(89.9999, 179.9999, 89.9999, 179.9999);
    assert.strictEqual(dist, 0);
  });
});

describe('sortPlacesByDistance', () => {
  const userLoc = { latitude: 35.1978, longitude: 129.0837 }; // Sebyeonggyo

  const places = [
    { id: 'far', name: 'Far Spot', latitude: 35.3000, longitude: 129.2000 },
    { id: 'closest', name: 'Closest Spot', latitude: 35.1980, longitude: 129.0840 },
    { id: 'mid', name: 'Mid Spot', latitude: 35.2100, longitude: 129.0900 },
  ];

  test('sorts places so closest is at index 0', () => {
    const sorted = sortPlacesByDistance(places, userLoc);
    assert.strictEqual(sorted[0].id, 'closest');
    assert.strictEqual(sorted[1].id, 'mid');
    assert.strictEqual(sorted[2].id, 'far');
  });

  test('preserves order if user coordinates are invalid', () => {
    const sorted = sortPlacesByDistance(places, { latitude: NaN, longitude: 129.0837 });
    assert.strictEqual(sorted[0].id, 'far');
    assert.strictEqual(sorted[1].id, 'closest');
    assert.strictEqual(sorted[2].id, 'mid');
  });

  test('handles empty array', () => {
    const sorted = sortPlacesByDistance([], userLoc);
    assert.deepStrictEqual(sorted, []);
  });

  test('handles null or undefined elements in array', () => {
    const placesWithNulls = [
      null,
      { id: 'far', name: 'Far Spot', latitude: 35.3000, longitude: 129.2000 },
      undefined,
      { id: 'closest', name: 'Closest Spot', latitude: 35.1980, longitude: 129.0840 },
    ];
    const sorted = sortPlacesByDistance(placesWithNulls, userLoc);
    assert.strictEqual(sorted.length, 2);
    assert.strictEqual(sorted[0].id, 'closest');
    assert.strictEqual(sorted[1].id, 'far');
  });
});
