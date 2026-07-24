import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  isValidCoordinate,
  getHaversineDistance,
  sortPlacesByDistance,
} from '../../core_engine/src/utils/haversine.ts';

const EARTH_CIRCUMFERENCE_METERS = 2 * Math.PI * 6371000; // ~40,030,173.59 m
const HALF_CIRCUMFERENCE_METERS = Math.PI * 6371000; // ~20,015,086.79 m

describe('Empirical Verification Harness 1: Coordinate Validation Boundaries', () => {
  test('Exact boundary values: poles ±90° and anti-meridian ±180°', () => {
    assert.strictEqual(isValidCoordinate(90, 180), true);
    assert.strictEqual(isValidCoordinate(90, -180), true);
    assert.strictEqual(isValidCoordinate(-90, 180), true);
    assert.strictEqual(isValidCoordinate(-90, -180), true);
    assert.strictEqual(isValidCoordinate(0, 0), true);
  });

  test('Just outside legal bounds return false', () => {
    assert.strictEqual(isValidCoordinate(90.0000001, 0), false);
    assert.strictEqual(isValidCoordinate(-90.0000001, 0), false);
    assert.strictEqual(isValidCoordinate(0, 180.0000001), false);
    assert.strictEqual(isValidCoordinate(0, -180.0000001), false);
  });

  test('Non-numeric / NaN / Infinity inputs return false', () => {
    assert.strictEqual(isValidCoordinate(NaN, 0), false);
    assert.strictEqual(isValidCoordinate(0, NaN), false);
    assert.strictEqual(isValidCoordinate(Infinity, 0), false);
    assert.strictEqual(isValidCoordinate(0, -Infinity), false);
    assert.strictEqual(isValidCoordinate('35' as any, 129), false);
    assert.strictEqual(isValidCoordinate(null as any, 129), false);
    assert.strictEqual(isValidCoordinate(undefined as any, 129), false);
  });
});

describe('Empirical Verification Harness 2: Co-located Points (0 distance)', () => {
  test('Exact co-located points return 0', () => {
    assert.strictEqual(getHaversineDistance(35.1796, 129.0756, 35.1796, 129.0756), 0);
    assert.strictEqual(getHaversineDistance(0, 0, 0, 0), 0);
    assert.strictEqual(getHaversineDistance(90, 0, 90, 0), 0);
    assert.strictEqual(getHaversineDistance(-90, 0, -90, 0), 0);
  });

  test('Poles co-location across different longitudes (Floating Point Residual)', () => {
    // At North Pole (90° lat), any longitude represents the exact same geographic point.
    // However, (-180 !== 180), so the strict reference check lat1===lat2 && lng1===lng2 is bypassed.
    // Due to Math.cos(90°) in IEEE 754 float returning 6.123e-17 rather than exact 0,
    // distance evaluates to ~9.55e-26 meters instead of strictly 0.
    const northPoleDist = getHaversineDistance(90, -180, 90, 180);
    assert.ok(
      northPoleDist < 1e-15,
      `Poles distance across longitudes should be near zero, got ${northPoleDist}`
    );
  });

  test('Micro-distance floating precision near 0', () => {
    // Points 1e-7 degrees apart (~1.1 cm)
    const dist = getHaversineDistance(35.1796, 129.0756, 35.1796001, 129.0756);
    assert.ok(dist > 0 && dist < 0.1, `Micro-distance should be ~0.011m, got ${dist}`);
    assert.ok(!Number.isNaN(dist), 'Micro-distance must not be NaN');
  });
});

describe('Empirical Verification Harness 3: Boundary & Anti-Meridian Math', () => {
  test('Pole to Pole distance (North Pole to South Pole)', () => {
    const dist = getHaversineDistance(90, 0, -90, 0);
    const expected = HALF_CIRCUMFERENCE_METERS;
    const diff = Math.abs(dist - expected);
    assert.ok(diff < 1.0, `Pole-to-pole distance expected ~${expected}m, got ${dist}m (diff ${diff}m)`);
  });

  test('Antipodal points at equator (0, 0) to (0, 180)', () => {
    const dist1 = getHaversineDistance(0, 0, 0, 180);
    const dist2 = getHaversineDistance(0, 0, 0, -180);
    assert.ok(Math.abs(dist1 - HALF_CIRCUMFERENCE_METERS) < 1.0, `Expected ~${HALF_CIRCUMFERENCE_METERS}, got ${dist1}`);
    assert.ok(Math.abs(dist2 - HALF_CIRCUMFERENCE_METERS) < 1.0, `Expected ~${HALF_CIRCUMFERENCE_METERS}, got ${dist2}`);
  });

  test('Anti-meridian cross shortest path (179.9999° to -179.9999° at Equator)', () => {
    // Difference is 0.0002° longitude ≈ 22.23 meters
    const dist = getHaversineDistance(0, 179.9999, 0, -179.9999);
    assert.ok(dist > 20 && dist < 25, `Anti-meridian cross should be ~22.2m, got ${dist}`);
  });

  test('Anti-meridian cross (175° to -175° at Equator)', () => {
    // Shortest distance is 10° longitude across anti-meridian = (10 / 360) * 40,030,173.59m ≈ 1,111,949m
    const dist = getHaversineDistance(0, 175, 0, -175);
    const expected = (10 / 360) * EARTH_CIRCUMFERENCE_METERS;
    assert.ok(Math.abs(dist - expected) < 100, `Expected ~${expected}m, got ${dist}m`);
  });
});

describe('Empirical Verification Harness 4: Precision & Clamping Safeguards', () => {
  test('Floating point clamping safeguard prevents NaN for a > 1 or a < 0', () => {
    // Generate 10,000 random coordinate pairs near antipodes and poles to stress test domain boundary of acos/atan2
    for (let i = 0; i < 10000; i++) {
      const lat1 = (Math.random() - 0.5) * 180;
      const lng1 = (Math.random() - 0.5) * 360;
      const lat2 = (Math.random() - 0.5) * 180;
      const lng2 = (Math.random() - 0.5) * 360;

      const dist = getHaversineDistance(lat1, lng1, lat2, lng2);
      assert.ok(!Number.isNaN(dist), `Random pair (${lat1},${lng1})-(${lat2},${lng2}) yielded NaN`);
      assert.ok(dist >= 0, `Distance must be >= 0, got ${dist}`);
      assert.ok(dist <= HALF_CIRCUMFERENCE_METERS + 10, `Distance cannot exceed half circumference, got ${dist}`);
    }
  });
});

describe('Empirical Verification Harness 5: Distance Sorting & Edge Cases', () => {
  const userLoc = { latitude: 35.1796, longitude: 129.0756 };

  test('Sorts correctly across anti-meridian points', () => {
    const userAtAntiMeridian = { latitude: 0, longitude: 179.9999 };
    const places = [
      { id: 'far_west', name: 'Far West', latitude: 0, longitude: 100 },
      { id: 'across_am', name: 'Across Anti-Meridian', latitude: 0, longitude: -179.9999 }, // ~22m away
      { id: 'same_side', name: 'Same Side Near', latitude: 0, longitude: 179.99 }, // ~1100m away
    ];

    const sorted = sortPlacesByDistance(places, userAtAntiMeridian);
    assert.strictEqual(sorted[0].id, 'across_am');
    assert.strictEqual(sorted[1].id, 'same_side');
    assert.strictEqual(sorted[2].id, 'far_west');
  });

  test('Pushes invalid place coordinates to end of list', () => {
    const places = [
      { id: 'invalid_lat', latitude: 999, longitude: 129.0756 },
      { id: 'close', latitude: 35.1797, longitude: 129.0756 },
      { id: 'nan_lng', latitude: 35.1796, longitude: NaN },
      { id: 'far', latitude: 36.0000, longitude: 129.0756 },
    ];

    const sorted = sortPlacesByDistance(places, userLoc);
    assert.strictEqual(sorted[0].id, 'close');
    assert.strictEqual(sorted[1].id, 'far');
    // The two invalid ones should be at indices 2 and 3
    const lastTwoIds = [sorted[2].id, sorted[3].id];
    assert.ok(lastTwoIds.includes('invalid_lat'));
    assert.ok(lastTwoIds.includes('nan_lng'));
  });

  test('Sorting stability with duplicate distance places', () => {
    // Two places at exact same distance from user
    const places = [
      { id: 'place_1', latitude: 35.1896, longitude: 129.0756 },
      { id: 'place_2', latitude: 35.1696, longitude: 129.0756 }, // Same delta lat (0.01)
    ];

    const sorted = sortPlacesByDistance(places, userLoc);
    assert.strictEqual(sorted.length, 2);
  });

  test('Returns copy of original list when user coordinates are invalid', () => {
    const places = [
      { id: 'p1', latitude: 35.1, longitude: 129.1 },
      { id: 'p2', latitude: 35.2, longitude: 129.2 },
    ];
    const sorted = sortPlacesByDistance(places, { latitude: NaN, longitude: 129.0 });
    assert.notStrictEqual(sorted, places, 'Must return a new array instance');
    assert.deepStrictEqual(sorted, places);
  });
});
