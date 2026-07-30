import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from '../models/place_model';

const CACHE_KEY = '@anywayTheSea:places_cache';
const CDN_URL = 'https://startup0025-spec.github.io/school_project/data/busan_places_master.json';

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
  if (listeners.size >= 15) {
    console.warn(`[local_places] Warning: Cache update listeners size (${listeners.size}) exceeds 15. This might indicate a memory leak.`);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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
  try {
    const response = await fetch(CDN_URL, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    const places: Place[] = json.places;

    // Data Sanitizer (Interceptor) for API errors
    for (const place of places) {
      if (place.id === 'p-hakjang') {
        place.latitude = 35.1328;
        place.longitude = 128.9897;
      }
    }

    if (json && Array.isArray(json.places) && json.places.length > 0) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json));
      console.log(`[local_places] SWR: Cached latest places from CDN (${json.places.length} items).`);
      notifyListeners(json.places as Place[]);
    }
  } catch (error) {
    console.warn('[local_places] SWR revalidation failed (offline mode):', error);
  }
}

export const getPlaces = async (): Promise<Place[]> => {
  const now = Date.now();
  if (!isRevalidating && now - lastFetchTime > FRESHNESS_THRESHOLD) {
    isRevalidating = true;
    lastFetchTime = now;
    revalidateData().finally(() => {
      isRevalidating = false;
    });
  }

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

  try {
    const bundledData = require('../../../assets/data/busan_places_master.json');
    if (bundledData && Array.isArray(bundledData.places)) {
      return bundledData.places as Place[];
    }
  } catch (error) {
    console.warn('[local_places] Bundled fallback data error:', error);
  }

  return [];
};

export const getPlaceById = async (id: string): Promise<Place | null> => {
  const places = await getPlaces();
  const place = places.find((p) => p.id === id);
  return place || null;
}
