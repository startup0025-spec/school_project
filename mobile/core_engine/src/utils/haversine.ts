/**
 * Reusable Haversine distance and coordinate utilities.
 */
import { point, lineString, nearestPointOnLine } from '@turf/turf';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Validates whether latitude and longitude values are valid numbers within legal geographic bounds.
 * - Latitude: [-90, 90]
 * - Longitude: [-180, 180]
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  if (
    lat === null ||
    lat === undefined ||
    typeof lat !== 'number' ||
    Number.isNaN(lat) ||
    !Number.isFinite(lat) ||
    lng === null ||
    lng === undefined ||
    typeof lng !== 'number' ||
    Number.isNaN(lng) ||
    !Number.isFinite(lng)
  ) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Calculates the Haversine distance in meters between two GPS coordinates.
 * Returns NaN if any coordinate is invalid.
 */
export function getHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    return Number.NaN;
  }

  if (lat1 === lat2 && lng1 === lng2) {
    return 0;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const clampedA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Returns a new array sorted by Haversine distance from the given user coordinates.
 * The closest place is positioned at index 0.
 */
export function sortPlacesByDistance<T extends { latitude: number; longitude: number; waterCategory?: string; geojsonSegments?: any }>(
  placesList: (T | null | undefined)[],
  userCoords: { latitude: number; longitude: number; altitude?: number }
): T[] {
  if (!placesList || placesList.length === 0) return [];
  const validPlaces = placesList.filter((p): p is T => p != null);
  if (!isValidCoordinate(userCoords.latitude, userCoords.longitude)) {
    return validPlaces;
  }

  const userPt = point([userCoords.longitude, userCoords.latitude]);

  const decorated = validPlaces.map(place => {
    let rawDist = Number.MAX_VALUE;
    let nearestLng = place.longitude;
    let nearestLat = place.latitude;
    
    if (place.geojsonSegments && Array.isArray(place.geojsonSegments) && place.geojsonSegments.length > 0) {
      try {
        let minDist = Number.MAX_VALUE;
        let bestCoord = null;
        for (const seg of place.geojsonSegments) {
          if (seg.coordinates && seg.coordinates.length >= 2) {
            const line = lineString(seg.coordinates);
            const snapped = nearestPointOnLine(line, userPt, { units: 'meters' });
            if (snapped && snapped.properties.dist !== undefined && snapped.properties.dist < minDist) {
              minDist = snapped.properties.dist;
              bestCoord = snapped.geometry.coordinates;
            }
          }
        }
        if (bestCoord) {
          rawDist = minDist;
          nearestLng = bestCoord[0];
          nearestLat = bestCoord[1];
        }
      } catch (e) {
        console.warn("[haversine] Turf nearestPointOnLine error", e);
      }
    }

    if (rawDist === Number.MAX_VALUE) {
      const hd = getHaversineDistance(
        userCoords.latitude,
        userCoords.longitude,
        place.latitude,
        place.longitude
      );
      rawDist = Number.isNaN(hd) ? Number.MAX_VALUE : hd;
    }
    
    // We clone the place to safely update latitude/longitude for the UI marker
    const updatedPlace = { ...place, latitude: nearestLat, longitude: nearestLng };

    let dist = rawDist;

    if (userCoords.altitude !== undefined && dist !== Number.MAX_VALUE) {
      const alt = userCoords.altitude;
      const cat = updatedPlace.waterCategory || '';
      
      if (alt > 100) {
        if (cat === '연안') {
          dist *= 2.0; // 200% penalty for sea
        }
      } else if (alt < 50) {
        if (cat === '지방하천') {
          dist *= 1.5; // 150% penalty for mountain streams
        }
      }
    }

    return {
      place: updatedPlace,
      dist
    };
  });

  decorated.sort((a, b) => a.dist - b.dist);

  return decorated.map(item => item.place);
}

