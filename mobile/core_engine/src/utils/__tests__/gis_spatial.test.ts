import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  calculateDynamicMarkerScale,
  checkSpatialIntersection,
  booleanPointInPolygon,
  nearestPointOnLine,
  clipRouteSegment,
  haversineDistanceMeters,
  normalizePoint,
} from '../gis_spatial.ts';

describe('calculateDynamicMarkerScale', () => {
  test('returns 1.0 for default zoom 5 and altitude 0', () => {
    const scale = calculateDynamicMarkerScale(5, 0);
    assert.strictEqual(scale, 1.0);
  });

  test('calculates correct scale for higher altitude', () => {
    // S = 1.0 * (1 + 500/1000) * 1.15^(5 - 5) = 1.5
    const scale = calculateDynamicMarkerScale(5, 500);
    assert.strictEqual(scale, 1.5);
  });

  test('calculates correct scale for lower zoom (zoomed out)', () => {
    // S = 1.0 * (1 + 0/1000) * 1.15^(5 - 3) = 1.15^2 = 1.3225
    const scale = calculateDynamicMarkerScale(3, 0);
    assert.ok(Math.abs(scale - 1.3225) < 0.0001, `Expected ~1.3225, got ${scale}`);
  });

  test('clamps scale to S_min = 0.5 for high zoom level', () => {
    // S = 1.0 * 1.0 * 1.15^(-5) ~ 0.497 -> clamped to 0.5
    const scale = calculateDynamicMarkerScale(10, 0);
    assert.strictEqual(scale, 0.5);
  });

  test('clamps scale to S_max = 2.5 for high altitude and low zoom level', () => {
    // Raw scale >> 2.5 -> clamped to 2.5
    const scale = calculateDynamicMarkerScale(1, 5000);
    assert.strictEqual(scale, 2.5);
  });

  test('handles invalid, NaN, or non-finite arguments safely', () => {
    assert.strictEqual(calculateDynamicMarkerScale(NaN as unknown as number, 0), 1.0);
    assert.strictEqual(calculateDynamicMarkerScale(5, NaN as unknown as number), 1.0);
    assert.strictEqual(calculateDynamicMarkerScale(undefined as unknown as number, null as unknown as number), 1.0);
  });
});

describe('checkSpatialIntersection & booleanPointInPolygon', () => {
  // Polygon around Busan City Hall: [lng, lat]
  const busanPolygon: Array<[number, number]> = [
    [129.070, 35.175],
    [129.080, 35.175],
    [129.080, 35.185],
    [129.070, 35.185],
    [129.070, 35.175], // Closed ring
  ];

  test('returns true for point inside polygon', () => {
    const insidePoint = { latitude: 35.180, longitude: 129.075 };
    assert.strictEqual(booleanPointInPolygon(insidePoint, busanPolygon), true);
    assert.strictEqual(checkSpatialIntersection(insidePoint, busanPolygon), true);
  });

  test('returns false for point outside polygon', () => {
    const outsidePoint = { latitude: 35.200, longitude: 129.090 };
    assert.strictEqual(booleanPointInPolygon(outsidePoint, busanPolygon), false);
    assert.strictEqual(checkSpatialIntersection(outsidePoint, busanPolygon, 10), false);
  });

  test('returns true when point is within tolerance threshold of polyline segment', () => {
    const polyline: Array<[number, number]> = [
      [129.080, 35.195],
      [129.090, 35.205],
    ];
    // Point very near segment
    const nearPoint = [129.085, 35.200] as [number, number];
    assert.strictEqual(checkSpatialIntersection(nearPoint, polyline, 500), true);
  });
});

describe('clipRouteSegment & lineSlice', () => {
  const routeLine: Array<[number, number]> = [
    [129.080, 35.195], // Point 0
    [129.085, 35.200], // Point 1
    [129.090, 35.205], // Point 2
    [129.095, 35.210], // Point 3
  ];

  test('nearestPointOnLine finds closest segment projection', () => {
    const pt = [129.082, 35.197] as [number, number];
    const result = nearestPointOnLine(pt, routeLine);
    assert.strictEqual(result.segmentIndex, 0);
    assert.ok(result.distanceMeters >= 0);
  });

  test('clipRouteSegment slices polyline between user and spot', () => {
    const userPt = [129.081, 35.196] as [number, number];
    const spotPt = [129.094, 35.209] as [number, number];

    const clipped = clipRouteSegment(userPt, spotPt, routeLine);
    assert.ok(clipped.length >= 2, `Expected at least 2 points in clipped route, got ${clipped.length}`);
    
    // First point should be near user position projection, last near spot projection
    const firstDist = haversineDistanceMeters(clipped[0], normalizePoint(userPt));
    const lastDist = haversineDistanceMeters(clipped[clipped.length - 1], normalizePoint(spotPt));

    assert.ok(firstDist < 200, `First point should be close to user, got ${firstDist}m`);
    assert.ok(lastDist < 200, `Last point should be close to spot, got ${lastDist}m`);
  });
});
