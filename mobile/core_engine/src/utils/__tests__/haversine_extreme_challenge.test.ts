import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  getHaversineDistance,
  sortPlacesByDistance,
} from '../haversine.ts';

describe('Empirical Haversine Edge-Case Challenge', () => {

  test('1. Identical coordinates return 0 (never NaN)', () => {
    const coordsList = [
      [35.1796, 129.0756],
      [0, 0],
      [-90, -180],
      [90, 180],
      [-35.1234567, 42.9876543],
    ];

    for (const [lat, lng] of coordsList) {
      const dist = getHaversineDistance(lat, lng, lat, lng);
      assert.strictEqual(typeof dist, 'number');
      assert.strictEqual(Number.isNaN(dist), false, `Distance for (${lat}, ${lng}) was NaN`);
      assert.strictEqual(dist, 0, `Distance for identical coords (${lat}, ${lng}) should be 0, got ${dist}`);
    }
  });

  test('2. Extreme inputs producing a > 1.0 (antipodal points & floating rounding) return valid numbers (never NaN)', () => {
    // Exact antipodal points (opposite sides of the globe) where a = 1.0
    const antipodalPairs = [
      { p1: [0, 0], p2: [0, 180] },
      { p1: [90, 0], p2: [-90, 0] },
      { p1: [45, 0], p2: [-45, 180] },
      { p1: [-35.1796, 129.0756], p2: [35.1796, -50.9244] },
    ];

    for (const { p1, p2 } of antipodalPairs) {
      const dist = getHaversineDistance(p1[0], p1[1], p2[0], p2[1]);
      assert.strictEqual(typeof dist, 'number');
      assert.strictEqual(Number.isNaN(dist), false, `Antipodal distance for ${p1} -> ${p2} was NaN`);
      assert.strictEqual(Number.isFinite(dist), true, `Distance must be finite`);
      // Half of Earth's circumference ~20,015,087 meters
      assert.ok(
        Math.abs(dist - 20015087) < 50000,
        `Expected ~20,015,087m for antipodal distance, got ${dist}`
      );
    }
  });

  test('3. Extreme inputs producing a < 0 (micro-variations & negative zero) return 0 (never NaN)', () => {
    // Epsilon offsets near 0
    const nearZeroPairs = [
      { p1: [0, 0], p2: [1e-16, 1e-16] },
      { p1: [89.999999999, 179.999999999], p2: [89.999999999, 179.999999999] },
      { p1: [-0, -0], p2: [0, 0] },
    ];

    for (const { p1, p2 } of nearZeroPairs) {
      const dist = getHaversineDistance(p1[0], p1[1], p2[0], p2[1]);
      assert.strictEqual(typeof dist, 'number');
      assert.strictEqual(Number.isNaN(dist), false, `Near-zero distance was NaN`);
      assert.ok(dist >= 0, `Distance must be non-negative, got ${dist}`);
    }
  });

  test('4. Antimeridian coordinates (crossing 180 / -180 longitude) yield valid distance (never NaN)', () => {
    // Points separated by 0.0002 degrees longitude across the antimeridian
    // (179.9999° to -179.9999° at equator)
    const lat = 0;
    const lng1 = 179.9999;
    const lng2 = -179.9999;

    const dist = getHaversineDistance(lat, lng1, lat, lng2);
    assert.strictEqual(typeof dist, 'number');
    assert.strictEqual(Number.isNaN(dist), false, `Antimeridian distance was NaN`);
    assert.strictEqual(Number.isFinite(dist), true);
    
    // 0.0002 degrees at equator is ~22.24 meters
    assert.ok(
      Math.abs(dist - 22.24) < 1.0,
      `Expected ~22.24 meters across antimeridian, got ${dist}`
    );
  });

  test('5. Antimeridian crossing at 0.2 degrees (179.9 to -179.9) yields correct short distance (~22,239m)', () => {
    const dist = getHaversineDistance(0, 179.9, 0, -179.9);
    assert.strictEqual(Number.isNaN(dist), false, `Distance across antimeridian was NaN`);
    assert.ok(
      Math.abs(dist - 22238.98) < 10,
      `Expected ~22,238.98m across antimeridian, got ${dist}`
    );
  });

  test('6. Geofence radius boundary checks & clamping safeguard under 100,000 random generated coordinates', () => {
    let nanCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < 100000; i++) {
      // Random coordinates between -90 and 90 lat, -180 and 180 lng
      const lat1 = (Math.random() - 0.5) * 180;
      const lng1 = (Math.random() - 0.5) * 360;
      const lat2 = (Math.random() - 0.5) * 180;
      const lng2 = (Math.random() - 0.5) * 360;

      const dist = getHaversineDistance(lat1, lng1, lat2, lng2);
      if (Number.isNaN(dist)) {
        nanCount++;
      }
      if (!Number.isFinite(dist) || dist < 0) {
        invalidCount++;
      }
    }

    assert.strictEqual(nanCount, 0, `Found ${nanCount} NaNs in 100,000 random coordinate pairs`);
    assert.strictEqual(invalidCount, 0, `Found ${invalidCount} invalid values in 100,000 random coordinate pairs`);
  });

  test('7. Out-of-bound inputs return NaN safely according to spec without throwing', () => {
    assert.ok(Number.isNaN(getHaversineDistance(91, 0, 0, 0)));
    assert.ok(Number.isNaN(getHaversineDistance(-91, 0, 0, 0)));
    assert.ok(Number.isNaN(getHaversineDistance(0, 181, 0, 0)));
    assert.ok(Number.isNaN(getHaversineDistance(0, -181, 0, 0)));
    assert.ok(Number.isNaN(getHaversineDistance(NaN, 0, 0, 0)));
    assert.ok(Number.isNaN(getHaversineDistance(Infinity, 0, 0, 0)));
  });

  test('8. sortPlacesByDistance handles NaN distance values gracefully', () => {
    const places = [
      { id: '1', latitude: 35.1, longitude: 129.1 },
      { id: '2', latitude: 35.2, longitude: 129.2 },
    ];
    // Passing invalid user coords
    const result = sortPlacesByDistance(places, { latitude: NaN, longitude: 129.1 });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, '1');
    assert.strictEqual(result[1].id, '2');
  });

});
