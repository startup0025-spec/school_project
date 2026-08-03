import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from '../models/place_model';
import bundledVWorld from '../../../assets/data/vworld_places.json';

const CACHE_KEY = '@anywayTheSea:vworld_places_cache_v2';
const CDN_URLS = [
  'https://raw.githubusercontent.com/startup0025-spec/school_project/main/vworld_places.json',
  'https://startup0025-spec.github.io/school_project/data/vworld_places.json',
];

let isRevalidating = false;
let lastFetchTime = 0;
const FRESHNESS_THRESHOLD = 30000; // 30 seconds revalidation rate limit

type CacheUpdateListener = (places: Place[]) => void;
const listeners = new Set<CacheUpdateListener>();

/**
 * Register a listener to be notified when the background cache updates.
 * Returns an unsubscribe callback function.
 */
export const subscribeToPlacesCache = (listener: CacheUpdateListener): (() => void) => {
  if (typeof listener !== 'function') {
    return () => {};
  }
  if (listeners.size >= 15) {
    console.warn(`[local_places] Warning: Cache update listeners size (${listeners.size}) exceeds 15. This might indicate a memory leak.`);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const clearAllPlacesCacheListeners = (): void => {
  listeners.clear();
};

const notifyListeners = (places: Place[]) => {
  listeners.forEach((listener) => {
    try {
      listener(places);
    } catch (e) {
      console.error('[local_places] Error executing listener callback:', e);
    }
  });
};

async function revalidateData(): Promise<void> {
  const allPlaces: Place[] = [];
  
  // 1. Fetch VWorld Data Only
  for (const cdnUrl of CDN_URLS) {
    try {
      const res = await fetch(cdnUrl, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.places)) {
          // Verify that this CDN response contains the new geojsonSegments data.
          // Otherwise, fall back to the bundled data (which is guaranteed to have it).
          if (json.places.length > 0 && json.places[0].geojsonSegments) {
            allPlaces.push(...json.places);
            break; // Stop falling back
          } else {
            console.warn('[local_places] CDN data is outdated (missing geojsonSegments). Skipping.');
          }
        }
      }
    } catch (e) {}
  }

  if (allPlaces.length > 0) {
    const output = { places: allPlaces };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(output));
    console.log(`[local_places] SWR: Cached ${allPlaces.length} VWorld places from CDN.`);
    notifyListeners(allPlaces);
  } else {
    console.warn('[local_places] SWR revalidation failed for all CDNs (offline mode).');
  }
}

export const getPlaces = async (): Promise<Place[]> => {
  const now = Date.now();
  if (!isRevalidating && now - lastFetchTime > FRESHNESS_THRESHOLD) {
    isRevalidating = true;
    lastFetchTime = now;
    revalidateData()
      .catch((e) => console.warn('[local_places] Background revalidation error:', e))
      .finally(() => {
        isRevalidating = false;
      });
  }

  // Try Async Storage Cache
  try {
    const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && Array.isArray(parsed.places) && parsed.places.length > 0) {
        return parsed.places as Place[];
      }
    }
  } catch (error) {
    console.warn('[local_places] AsyncStorage read error:', error);
  }

  // Fallback to Bundled Data
  try {
    if (bundledVWorld && Array.isArray((bundledVWorld as { places?: Place[] }).places)) {
      return (bundledVWorld as { places: Place[] }).places;
    }
  } catch (e) {}
  
  return [];
};

export const getPlaceById = async (id: string): Promise<Place | null> => {
  const places = await getPlaces();
  const place = places.find((p) => p.id === id);
  return place || null;
};

