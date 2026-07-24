/**
 * Reusable Haversine distance and coordinate utilities.
 */

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
export function sortPlacesByDistance<T extends { latitude: number; longitude: number }>(
  placesList: (T | null | undefined)[],
  userCoords: { latitude: number; longitude: number }
): T[] {
  if (!placesList || placesList.length === 0) return [];
  const validPlaces = placesList.filter((p): p is T => p != null);
  if (!isValidCoordinate(userCoords.latitude, userCoords.longitude)) {
    return validPlaces;
  }

  const decorated = validPlaces.map(place => {
    const dist = getHaversineDistance(
      userCoords.latitude,
      userCoords.longitude,
      place.latitude,
      place.longitude
    );
    return {
      place,
      dist: Number.isNaN(dist) ? Number.MAX_VALUE : dist
    };
  });

  decorated.sort((a, b) => a.dist - b.dist);

  return decorated.map(item => item.place);
}
