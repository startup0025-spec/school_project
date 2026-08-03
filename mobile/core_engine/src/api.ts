import { Place } from './models/place_model';
import { SafetyLevel } from './models/safety_status';
import { AudioParams } from './models/audio_params';
import { getPlaces } from './database/local_places';
import { fetchWeatherWarning, fetchUltraShortForecast } from './network/kma_api';
import { fetchRiverWaterLevel, fetchRiverWaterQuality } from './network/busan_api';
import { getHaversineDistance } from './utils/haversine';

const levelMap: Record<SafetyLevel, number> = {
  [SafetyLevel.Safe]: 0,
  [SafetyLevel.Warning]: 1,
  [SafetyLevel.Danger]: 2,
};

function getHigherLevel(a: SafetyLevel, b: SafetyLevel): SafetyLevel {
  return levelMap[a] >= levelMap[b] ? a : b;
}

/**
 * Helper to calculate KMA Ultra Short Forecast base time (KST).
 */
function getKMABaseTime(): { baseDate: string; baseTime: string } {
  const now = new Date();
  const kstOffset = 9 * 60; // KST is UTC+9
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kst = new Date(utc + (kstOffset * 60 * 1000));

  let year = kst.getFullYear();
  let month = kst.getMonth() + 1;
  let date = kst.getDate();
  let hours = kst.getHours();
  const minutes = kst.getMinutes();

  // KMA ultra short forecast releases at 45 minutes past every hour.
  if (minutes < 45) {
    hours -= 1;
    if (hours < 0) {
      kst.setDate(kst.getDate() - 1);
      year = kst.getFullYear();
      month = kst.getMonth() + 1;
      date = kst.getDate();
      hours = 23;
    }
  }

  const baseDate = `${year}${String(month).padStart(2, '0')}${String(date).padStart(2, '0')}`;
  const baseTime = `${String(hours).padStart(2, '0')}00`;

  return { baseDate, baseTime };
}

/**
 * Internal helper to evaluate the safety level of a specific place.
 */
async function getSafetyLevelForPlace(place: Place): Promise<SafetyLevel> {
  let currentLevel = SafetyLevel.Safe;

  // 1. Check weather warnings
  try {
    const warningResponse = await fetchWeatherWarning();
    const items = warningResponse?.response?.body?.items?.item || [];
    for (const item of items) {
      const title = item.title || '';
      const hasLocation = (place.district && title.includes(place.district)) || title.includes('부산');
      if (hasLocation) {
        const placeRecord = place as unknown as Record<string, string | undefined>;
        const isSea = place.waterType === 'sea' || placeRecord.category?.includes('연안') || placeRecord.waterCategory?.includes('연안');
        if (title.includes('호우경보') || (isSea && title.includes('풍랑경보'))) {
          currentLevel = getHigherLevel(currentLevel, SafetyLevel.Danger);
        } else if (title.includes('호우주의보') || (isSea && title.includes('풍랑주의보'))) {
          currentLevel = getHigherLevel(currentLevel, SafetyLevel.Warning);
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching weather warnings:', err);
  }

  // 2. Check wind speed WSD
  if (place.kmaNx !== undefined && place.kmaNy !== undefined) {
    try {
      const { baseDate, baseTime } = getKMABaseTime();
      const forecastResponse = await fetchUltraShortForecast(baseDate, baseTime, place.kmaNx, place.kmaNy);
      const wsdItem = forecastResponse?.response?.body?.items?.item?.find(item => item.category === 'WSD');
      if (wsdItem) {
        const wsdValue = parseFloat(wsdItem.fcstValue);
        const wsd = Number.isNaN(wsdValue) ? 0 : wsdValue;
        if (wsd >= 14) {
          currentLevel = getHigherLevel(currentLevel, SafetyLevel.Danger);
        } else if (wsd >= 8) {
          currentLevel = getHigherLevel(currentLevel, SafetyLevel.Warning);
        }
      }
    } catch (err) {
      console.warn('Error fetching forecast:', err);
    }
  }

  // 3. Check water level
  if (place.waterStationName) {
    try {
      const waterLevels = await fetchRiverWaterLevel();
      const matched = waterLevels.find(wl => wl.stationName === place.waterStationName);
      if (matched) {
        const wlValue = matched.waterLevel;
        const wl = Number.isNaN(wlValue) ? 0 : wlValue;
        if (wl >= 1.5) {
          currentLevel = getHigherLevel(currentLevel, SafetyLevel.Danger);
        } else if (wl >= 0.8) {
          currentLevel = getHigherLevel(currentLevel, SafetyLevel.Warning);
        }
      }
    } catch (err) {
      console.warn('Error fetching water level:', err);
    }
  }

  return currentLevel;
}

function parseDefensiveNumber(val: unknown, fallback: number): number {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isNaN(num) || !Number.isFinite(num) ? fallback : num;
}

/**
 * Checks if the user is inside the geofence of any place and calculates the safety level.
 */
export async function checkGeofenceAndSafety(userLat: number, userLng: number): Promise<SafetyLevel> {
  const lat = parseDefensiveNumber(userLat, NaN);
  const lng = parseDefensiveNumber(userLng, NaN);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return SafetyLevel.Safe;
  }

  const places = await getPlaces();
  if (!places || places.length === 0) {
    return SafetyLevel.Safe;
  }

  let closestPlace: Place | null = null;
  let minDistance = Infinity;

  for (const place of places) {
    if (!place) continue;
    const pLat = parseDefensiveNumber(place.latitude, NaN);
    const pLng = parseDefensiveNumber(place.longitude, NaN);
    if (Number.isNaN(pLat) || Number.isNaN(pLng)) continue;

    const dist = getHaversineDistance(lat, lng, pLat, pLng);
    if (!Number.isNaN(dist) && dist < minDistance) {
      minDistance = dist;
      closestPlace = place;
    }
  }

  const geofenceRadius = closestPlace ? parseDefensiveNumber(closestPlace.geofenceRadius, 1000) : 1000;
  if (closestPlace && minDistance <= geofenceRadius) {
    return await getSafetyLevelForPlace(closestPlace);
  }

  return SafetyLevel.Safe;
}

/**
 * Computes sonification params for the given place based on live/fallback environment metrics.
 */
export async function getSonificationParams(place: Place): Promise<AudioParams> {
  const safetyLevel = await getSafetyLevelForPlace(place);
  const alarmActive = safetyLevel === SafetyLevel.Danger;

  // 1. Wind speed (WSD)
  let windVolume = 0.2; // default
  if (place.kmaNx !== undefined && place.kmaNy !== undefined) {
    try {
      const { baseDate, baseTime } = getKMABaseTime();
      const forecastResponse = await fetchUltraShortForecast(baseDate, baseTime, place.kmaNx, place.kmaNy);
      const wsdItem = forecastResponse?.response?.body?.items?.item?.find(item => item.category === 'WSD');
      if (wsdItem) {
        const wsdValue = parseDefensiveNumber(wsdItem.fcstValue, NaN);
        if (!Number.isNaN(wsdValue)) {
          const scaled = wsdValue / 15.0;
          windVolume = Math.max(0, Math.min(1, scaled));
        }
      }
    } catch (err) {
      console.warn('Error fetching forecast for getSonificationParams:', err);
    }
  }

  // 2. Water level & Turbidity
  let waterLevel: number | undefined = undefined;
  let turbidity: number | undefined = undefined;

  if (place.waterStationName) {
    try {
      const waterLevels = await fetchRiverWaterLevel();
      const matchedLevel = waterLevels.find(wl => wl.stationName === place.waterStationName);
      if (matchedLevel) {
        const wlParsed = parseDefensiveNumber(matchedLevel.waterLevel, NaN);
        if (!Number.isNaN(wlParsed)) {
          waterLevel = wlParsed;
        }
      }
    } catch (err) {
      console.warn('Error fetching water level for getSonificationParams:', err);
    }

    try {
      const waterQualities = await fetchRiverWaterQuality();
      const matchedQuality = waterQualities.find(wq => wq.stationName === place.waterStationName);
      if (matchedQuality) {
        const tParsed = parseDefensiveNumber(matchedQuality.turbidity, NaN);
        if (!Number.isNaN(tParsed)) {
          turbidity = tParsed;
        }
      }
    } catch (err) {
      console.warn('Error fetching water quality for getSonificationParams:', err);
    }
  }

  // Calculate ambientVolume
  let ambientVolume = 0.6; // default
  if (place.waterType === 'none') {
    ambientVolume = 0;
  } else if (waterLevel !== undefined) {
    const scaledAmbient = waterLevel / 2.0 + 0.3;
    ambientVolume = Math.max(0, Math.min(1, parseDefensiveNumber(scaledAmbient, 0.6)));
  }

  // Calculate filterFrequency
  let filterFrequency = 20000; // default
  if (turbidity !== undefined) {
    const calculatedFreq = 20000 - turbidity * 1000;
    filterFrequency = Math.max(200, Math.min(20000, parseDefensiveNumber(calculatedFreq, 20000)));
  }

  // Calculate pitch
  let pitch = 1.0; // default
  if (waterLevel !== undefined) {
    const calculatedPitch = 1.0 + (waterLevel - 0.5);
    pitch = Math.max(0.5, Math.min(2.0, parseDefensiveNumber(calculatedPitch, 1.0)));
  }

  return {
    waterType: place.waterType,
    ambientVolume: parseDefensiveNumber(ambientVolume, 0.6),
    windVolume: parseDefensiveNumber(windVolume, 0.2),
    pitch: parseDefensiveNumber(pitch, 1.0),
    filterFrequency: parseDefensiveNumber(filterFrequency, 20000),
    alarmActive,
  };
}
