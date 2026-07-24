import axios, { AxiosError, AxiosResponse } from 'axios';
import { setupCache, buildStorage } from 'axios-cache-interceptor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFallbackData } from '../../../constants/mockData';

const MAX_CACHE_ENTRIES = 100;

async function pruneCacheIfNeeded() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith('api_cache:'));
    if (cacheKeys.length > MAX_CACHE_ENTRIES) {
      const keysToRemove = cacheKeys.slice(0, cacheKeys.length - MAX_CACHE_ENTRIES);
      await AsyncStorage.multiRemove(keysToRemove);
      console.log(`[client.ts] Pruned ${keysToRemove.length} cache entries from AsyncStorage.`);
    }
  } catch (err) {
    console.warn('[client.ts] Pruning cache failed:', err);
  }
}

// 1. AsyncStorage Adapter supporting async Promise operations
export const offlineStorage = buildStorage({
  find: async (key: string) => {
    try {
      const val = await AsyncStorage.getItem(`api_cache:${key}`);
      return val ? JSON.parse(val) : undefined;
    } catch {
      return undefined;
    }
  },
  set: async (key: string, value: unknown) => {
    try {
      await AsyncStorage.setItem(`api_cache:${key}`, JSON.stringify(value));
      await pruneCacheIfNeeded();
    } catch (e) {
      console.warn('[client.ts] AsyncStorage write failed / quota exceeded', e);
      try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter((k) => k.startsWith('api_cache:'));
        if (cacheKeys.length > 0) {
          const toRemove = cacheKeys.slice(0, Math.max(1, Math.floor(cacheKeys.length / 2)));
          await AsyncStorage.multiRemove(toRemove);
          await AsyncStorage.setItem(`api_cache:${key}`, JSON.stringify(value));
        }
      } catch (recoveryErr) {
        console.warn('[client.ts] Cache error recovery failed:', recoveryErr);
      }
    }
  },
  remove: async (key: string) => {
    try {
      await AsyncStorage.removeItem(`api_cache:${key}`);
    } catch {}
  }
});

// 2. Base Axios Instantiation
const baseAxios = axios.create({
  timeout: 5000,
});

// 3. Cache setup wrapping
export const client = setupCache(baseAxios, {
  storage: offlineStorage,
  staleIfError: true, // Auto-serve expired cache on network error
  methods: ['get'],   // Apply only to GET requests
  ttl: 1000 * 60 * 5, // Force 5-minute cache TTL for all requests
  interpretHeader: false, // Ignore data.go.kr's 'no-cache' headers to protect traffic limits
});

// 4. Custom response interceptor for empty-cache offline cold starts
client.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    // Catch connection errors, timeouts, or specific network offline codes
    const isNetworkError = axios.isAxiosError(error) && 
      (!error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error'));

    if (isNetworkError) {
      const url = error.config?.url || '';
      const fallbackData = getFallbackData(url);

      const fakeResponse: AxiosResponse = {
        data: fallbackData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: error.config!,
      };

      console.warn(`[client.ts] Suppressing network error. Returning mock payload for URL: ${url}`);
      return Promise.resolve(fakeResponse);
    }

    return Promise.reject(error);
  }
);
