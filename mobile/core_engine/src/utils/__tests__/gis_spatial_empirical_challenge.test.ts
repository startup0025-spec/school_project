import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  calculateDynamicMarkerScale,
  checkSpatialIntersection,
  booleanPointInPolygon,
  booleanIntersects,
  nearestPointOnLine,
  lineSlice,
  clipRouteSegment,
  haversineDistanceMeters,
  normalizePoint,
} from '../gis_spatial.ts';
import type { CoordinateTuple } from '../gis_spatial.ts';

describe('Empirical Challenge: calculateDynamicMarkerScale', () => {
  test('Grid Sweep: zoom level 1..14 & altitude -100m..3000m MUST strictly clamp between 0.5 and 2.5', () => {
    let testCount = 0;
    for (let z = 1; z <= 14; z += 0.5) {
      for (let alt = -100; alt <= 3000; alt += 50) {
        const scale = calculateDynamicMarkerScale(z, alt);
        testCount++;
        assert.ok(
          typeof scale === 'number' && !Number.isNaN(scale) && Number.isFinite(scale),
          `Scale must be a valid finite number for z=${z}, alt=${alt}. Got: ${scale}`
        );
        assert.ok(
          scale >= 0.5 && scale <= 2.5,
          `Scale MUST be clamped in range [0.5, 2.5]. Got ${scale} for zoom=${z}, altitude=${alt}`
        );
      }
    }
    assert.ok(testCount > 1500, `Grid sweep executed ${testCount} assertions`);
  });

  test('Boundary and Extreme Math Inputs test', () => {
    const extremeCases = [
      { z: 1, alt: -100 },
      { z: 1, alt: 3000 },
      { z: 14, alt: -100 },
      { z: 14, alt: 3000 },
      { z: 0, alt: 0 },
      { z: -10, alt: 0 },
      { z: 20, alt: 0 },
      { z: 100, alt: 10000 },
      { z: -50, alt: -5000 },
      { z: NaN, alt: 0 },
      { z: 5, alt: NaN },
      { z: Infinity, alt: 0 },
      { z: -Infinity, alt: 0 },
      { z: 5, alt: Infinity },
      { z: 5, alt: -Infinity },
      { z: undefined as unknown as number, alt: null as unknown as number },
      { z: '5' as unknown as number, alt: '100' as unknown as number },
      { z: {} as unknown as number, alt: [] as unknown as number },
    ];

    for (const c of extremeCases) {
      const scale = calculateDynamicMarkerScale(c.z, c.alt);
      assert.ok(
        typeof scale === 'number' && !Number.isNaN(scale) && Number.isFinite(scale),
        `Failed finite test for input z=${c.z}, alt=${c.alt}. Got ${scale}`
      );
      assert.ok(
        scale >= 0.5 && scale <= 2.5,
        `Scale out of bounds [0.5, 2.5] for input z=${c.z}, alt=${c.alt}. Got ${scale}`
      );
    }
  });

  test('Theoretical formula verification without clamping bounds', () => {
    // Test exact math when raw scale is inside [0.5, 2.5]
    // z=5, alt=0 -> 1.0 * (1 + 0/1000) * 1.15^0 = 1.0
    assert.strictEqual(calculateDynamicMarkerScale(5, 0), 1.0);

    // z=5, alt=500 -> 1.0 * (1 + 500/1000) * 1.15^0 = 1.5
    assert.strictEqual(calculateDynamicMarkerScale(5, 500), 1.5);

    // z=4, alt=0 -> 1.0 * (1 + 0) * 1.15^1 = 1.15
    assert.strictEqual(calculateDynamicMarkerScale(4, 0), 1.15);

    // z=3, alt=0 -> 1.15^2 = 1.3225
    const s3 = calculateDynamicMarkerScale(3, 0);
    assert.ok(Math.abs(s3 - 1.3225) < 1e-6, `Expected 1.3225, got ${s3}`);
  });
});

describe('Empirical Challenge: normalizePoint', () => {
  test('handles tuple input [lng, lat]', () => {
    const res = normalizePoint([129.075, 35.180]);
    assert.deepStrictEqual(res, [129.075, 35.180]);
  });

  test('handles object input { latitude, longitude }', () => {
    const res = normalizePoint({ latitude: 35.180, longitude: 129.075 });
    assert.deepStrictEqual(res, [129.075, 35.180]);
  });

  test('handles invalid or malformed inputs without throwing', () => {
    assert.deepStrictEqual(normalizePoint(null as unknown as CoordinateTuple), [0, 0]);
    assert.deepStrictEqual(normalizePoint(undefined as unknown as CoordinateTuple), [0, 0]);
    assert.deepStrictEqual(normalizePoint({} as unknown as CoordinateTuple), [0, 0]);
    assert.deepStrictEqual(normalizePoint({ latitude: '35' } as unknown as CoordinateTuple), [0, 0]);
  });
});

describe('Empirical Challenge: haversineDistanceMeters', () => {
  test('distance to self is 0', () => {
    const pt: CoordinateTuple = [129.075, 35.180];
    assert.strictEqual(haversineDistanceMeters(pt, pt), 0);
  });

  test('calculates accurate distance between Busan City Hall and Haeundae Beach', () => {
    // Busan City Hall: [129.075, 35.180]
    // Haeundae Beach: [129.158, 35.158]
    const cityHall: CoordinateTuple = [129.075, 35.180];
    const haeundae: CoordinateTuple = [129.158, 35.158];
    const dist = haversineDistanceMeters(cityHall, haeundae);
    // Expected distance ~ 7.9km to 8.5km
    assert.ok(dist > 7500 && dist < 8500, `Expected ~8000m, got ${dist}m`);
  });
});

describe('Empirical Challenge: Spatial Polygon & Intersection Algorithms', () => {
  const squarePoly: Array<CoordinateTuple> = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];

  test('booleanPointInPolygon inside, outside, vertex, edge', () => {
    assert.strictEqual(booleanPointInPolygon([5, 5], squarePoly), true);
    assert.strictEqual(booleanPointInPolygon([15, 5], squarePoly), false);
    assert.strictEqual(booleanPointInPolygon([-1, -1], squarePoly), false);
  });

  test('booleanPointInPolygon rejects degenerate polygon ring with < 3 points', () => {
    assert.strictEqual(booleanPointInPolygon([5, 5], [[0, 0], [10, 10]]), false);
  });

  test('booleanIntersects with point tolerance on line segment', () => {
    const line: Array<CoordinateTuple> = [[0, 0], [10, 0]];
    // Point at [5, 0.0001] -> latitude diff ~ 11 meters
    const nearPt: CoordinateTuple = [5, 0.0001];
    assert.strictEqual(booleanIntersects(nearPt, line, 50), true);

    const farPt: CoordinateTuple = [5, 1.0]; // ~111km away
    assert.strictEqual(booleanIntersects(farPt, line, 50), false);
  });

  test('checkSpatialIntersection delegates correctly', () => {
    assert.strictEqual(checkSpatialIntersection([5, 5], squarePoly), true);
  });
});

describe('Empirical Challenge: nearestPointOnLine & Route Clipping', () => {
  const line: Array<CoordinateTuple> = [
    [0, 0],
    [10, 0],
    [10, 10],
  ];

  test('nearestPointOnLine handles empty line gracefully', () => {
    const res = nearestPointOnLine([5, 5], []);
    assert.strictEqual(res.distanceMeters, Infinity);
    assert.strictEqual(res.segmentIndex, 0);
  });

  test('nearestPointOnLine projects point correctly onto segment', () => {
    const res = nearestPointOnLine([5, 2], line);
    assert.strictEqual(res.segmentIndex, 0);
    assert.deepStrictEqual(res.point, [5, 0]);
  });

  test('lineSlice handles reverse order inputs gracefully', () => {
    const startPt: CoordinateTuple = [10, 5]; // segmentIndex 1
    const endPt: CoordinateTuple = [5, 0];    // segmentIndex 0

    const sliced = lineSlice(startPt, endPt, line);
    assert.ok(sliced.length >= 2, `Expected sliced path length >= 2, got ${sliced.length}`);
  });

  test('clipRouteSegment executes end-to-end route slicing', () => {
    const userPt = { latitude: 0, longitude: 1 };
    const targetPt = { latitude: 8, longitude: 10 };

    const clipped = clipRouteSegment(userPt, targetPt, line);
    assert.ok(clipped.length >= 2);
  });
});
