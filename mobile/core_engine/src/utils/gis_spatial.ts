/**
 * GIS Spatial Utility Module providing Turf.js compliant spatial operations:
 * 1. checkSpatialIntersection: Point-in-polygon & polyline spatial intersection checking.
 * 2. clipRouteSegment: Nearest point line projection & line slicing.
 * 3. calculateDynamicMarkerScale: Altitude & zoom-level dependent dynamic marker scaling.
 */

export type CoordinateTuple = [number, number]; // [longitude, latitude]
export type CoordinateObject = { latitude: number; longitude: number };
export type PointInput = CoordinateTuple | CoordinateObject;

/**
 * Normalizes input point coordinates to a standard [longitude, latitude] tuple.
 */
export function normalizePoint(point: PointInput): CoordinateTuple {
  if (Array.isArray(point)) {
    return [point[0], point[1]];
  }
  if (
    point &&
    typeof point === 'object' &&
    typeof point.latitude === 'number' &&
    typeof point.longitude === 'number'
  ) {
    return [point.longitude, point.latitude];
  }
  return [0, 0];
}

/**
 * Calculates Haversine distance in meters between two [longitude, latitude] points.
 */
export function haversineDistanceMeters(pt1: CoordinateTuple, pt2: CoordinateTuple): number {
  const R = 6371000; // Earth radius in meters
  const [lon1, lat1] = pt1;
  const [lon2, lat2] = pt2;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const clampedA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return R * c;
}

/**
 * Point-in-polygon check using Ray-Casting algorithm (turf.booleanPointInPolygon equivalent).
 */
export function booleanPointInPolygon(
  point: PointInput,
  polygonRing: Array<PointInput>
): boolean {
  const [x, y] = normalizePoint(point);
  const ring = polygonRing.map(normalizePoint);
  if (ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks if a point or line segment intersects a target polyline/polygon (turf.booleanIntersects equivalent).
 * Uses a proximity tolerance threshold in meters (default 50m for point-to-line proximity).
 */
export function booleanIntersects(
  geometryA: PointInput | Array<PointInput>,
  geometryB: Array<PointInput>,
  toleranceMeters: number = 50
): boolean {
  if (!geometryA || !geometryB || geometryB.length === 0) return false;

  // Single point vs Polyline/Polygon ring check
  if (!Array.isArray(geometryA) || typeof (geometryA as unknown as { latitude?: number }).latitude === 'number' || (geometryA.length === 2 && typeof geometryA[0] === 'number')) {
    const pt = normalizePoint(geometryA as PointInput);
    
    // Check if point is inside polygon if ring is closed (>2 vertices)
    if (geometryB.length >= 3 && booleanPointInPolygon(pt, geometryB)) {
      return true;
    }

    // Check distance from point to any segment in polyline
    const line = geometryB.map(normalizePoint);
    for (let i = 0; i < line.length - 1; i++) {
      const dist = distanceToSegmentMeters(pt, line[i], line[i + 1]);
      if (dist <= toleranceMeters) return true;
    }
    return false;
  }

  // Polyline vs Polyline check
  const lineA = (geometryA as Array<PointInput>).map(normalizePoint);
  const lineB = geometryB.map(normalizePoint);

  for (let i = 0; i < lineA.length - 1; i++) {
    for (let j = 0; j < lineB.length - 1; j++) {
      if (segmentsIntersect(lineA[i], lineA[i + 1], lineB[j], lineB[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Helper to calculate shortest distance in meters from point P to line segment AB.
 */
function distanceToSegmentMeters(
  p: CoordinateTuple,
  a: CoordinateTuple,
  b: CoordinateTuple
): number {
  const l2 = Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2);
  if (l2 === 0) return haversineDistanceMeters(p, a);

  let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  const projection: CoordinateTuple = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return haversineDistanceMeters(p, projection);
}

/**
 * Helper to check line segment intersection (2D cross-product method).
 */
function segmentsIntersect(
  p1: CoordinateTuple,
  p2: CoordinateTuple,
  p3: CoordinateTuple,
  p4: CoordinateTuple
): boolean {
  const ccw = (a: CoordinateTuple, b: CoordinateTuple, c: CoordinateTuple) => {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  };
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Combined spatial intersection checker function adhering to task specification.
 * Evaluates point-in-polygon or polyline intersection.
 */
export function checkSpatialIntersection(
  point: PointInput,
  boundaryOrPolyline: Array<PointInput>,
  toleranceMeters: number = 50
): boolean {
  return booleanIntersects(point, boundaryOrPolyline, toleranceMeters);
}

/**
 * Finds the nearest point on a line polyline (turf.nearestPointOnLine equivalent).
 * Returns the projected point coordinate, distance in meters, and segment index.
 */
export function nearestPointOnLine(
  point: PointInput,
  line: Array<PointInput>
): { point: CoordinateTuple; distanceMeters: number; segmentIndex: number } {
  const pt = normalizePoint(point);
  const lineCoords = line.map(normalizePoint);

  if (lineCoords.length === 0) {
    return { point: pt, distanceMeters: Infinity, segmentIndex: 0 };
  }
  if (lineCoords.length === 1) {
    return {
      point: lineCoords[0],
      distanceMeters: haversineDistanceMeters(pt, lineCoords[0]),
      segmentIndex: 0,
    };
  }

  let minDistance = Infinity;
  let nearestCoord: CoordinateTuple = lineCoords[0];
  let nearestSegmentIndex = 0;

  for (let i = 0; i < lineCoords.length - 1; i++) {
    const a = lineCoords[i];
    const b = lineCoords[i + 1];
    const l2 = Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2);

    let t = 0;
    if (l2 > 0) {
      t = ((pt[0] - a[0]) * (b[0] - a[0]) + (pt[1] - a[1]) * (b[1] - a[1])) / l2;
      t = Math.max(0, Math.min(1, t));
    }

    const proj: CoordinateTuple = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    const dist = haversineDistanceMeters(pt, proj);

    if (dist < minDistance) {
      minDistance = dist;
      nearestCoord = proj;
      nearestSegmentIndex = i;
    }
  }

  return { point: nearestCoord, distanceMeters: minDistance, segmentIndex: nearestSegmentIndex };
}

/**
 * Slices a polyline between startPoint and endPoint (turf.lineSlice equivalent).
 * Uses nearestPointOnLine to find nearest locations on polyline if start/end points are not exact vertices.
 */
export function lineSlice(
  startPoint: PointInput,
  endPoint: PointInput,
  line: Array<PointInput>
): CoordinateTuple[] {
  const lineCoords = line.map(normalizePoint);
  if (lineCoords.length < 2) return lineCoords;

  const startProj = nearestPointOnLine(startPoint, lineCoords);
  const endProj = nearestPointOnLine(endPoint, lineCoords);

  let idx1 = startProj.segmentIndex;
  let idx2 = endProj.segmentIndex;
  let pt1 = startProj.point;
  let pt2 = endProj.point;

  if (idx1 > idx2 || (idx1 === idx2 && haversineDistanceMeters(lineCoords[0], pt1) > haversineDistanceMeters(lineCoords[0], pt2))) {
    // Swap if end is before start along line
    [idx1, idx2] = [idx2, idx1];
    [pt1, pt2] = [pt2, pt1];
  }

  const sliced: CoordinateTuple[] = [pt1];

  for (let i = idx1 + 1; i <= idx2; i++) {
    const vertex = lineCoords[i];
    if (
      haversineDistanceMeters(pt1, vertex) > 1 &&
      haversineDistanceMeters(pt2, vertex) > 1
    ) {
      sliced.push(vertex);
    }
  }

  if (haversineDistanceMeters(sliced[sliced.length - 1], pt2) > 0.1) {
    sliced.push(pt2);
  }

  return sliced;
}

/**
 * Clips a route segment using nearestPointOnLine and lineSlice adhering to task specification.
 */
export function clipRouteSegment(
  userCoords: PointInput,
  targetSpotCoords: PointInput,
  routePolyline: Array<PointInput>
): CoordinateTuple[] {
  return lineSlice(userCoords, targetSpotCoords, routePolyline);
}

/**
 * Calculates dynamic marker scale according to altitude and map zoom level.
 * 
 * Formula:
 * S(z, A) = clamp( S_base * (1 + (A - A_ref) / 1000) * 1.15^(5 - z), S_min, S_max )
 * where S_base = 1.0, A_ref = 0, S_min = 0.5, S_max = 2.5
 */
export function calculateDynamicMarkerScale(zoomLevel: number, altitude: number = 0): number {
  const S_base = 1.0;
  const A_ref = 0;
  const S_min = 0.5;
  const S_max = 2.5;

  const validZoom =
    typeof zoomLevel === 'number' && !Number.isNaN(zoomLevel) && Number.isFinite(zoomLevel)
      ? zoomLevel
      : 5;
  const validAltitude =
    typeof altitude === 'number' && !Number.isNaN(altitude) && Number.isFinite(altitude)
      ? altitude
      : 0;

  const altitudeTerm = 1 + (validAltitude - A_ref) / 1000;
  const zoomTerm = Math.pow(1.15, 5 - validZoom);

  const rawScale = S_base * altitudeTerm * zoomTerm;
  return Math.max(S_min, Math.min(S_max, rawScale));
}
