import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from '../models/place_model';

const CACHE_KEY = '@anywayTheSea:places_cache';
const CDN_URL = 'https://haetae05.github.io/Anyway_the_Sea/data/busan_places_master.json';

let isRevalidating = false;

type CacheUpdateListener = (places: Place[]) => void;
const listeners = new Set<CacheUpdateListener>();

/**
 * 캐시 업데이트 리스너 구독 등록
 * SWR 백그라운드 데이터 갱신 완료 시 등록된 콜백들이 실행됩니다.
 * 반환값은 구독을 해제하는 함수(unsubscribe)입니다.
 */
export const subscribeToPlacesCache = (listener: CacheUpdateListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * 등록된 리스너들에게 새로운 데이터를 전달하여 알림
 */
const notifyListeners = (places: Place[]) => {
  listeners.forEach((listener) => {
    try {
      listener(places);
    } catch (e) {
      console.error('[local_places] 리스너 호출 중 에러 발생:', e);
    }
  });
};

/**
 * 백그라운드 정적 URL(GitHub Pages) 업데이트 (Revalidate)
 * 앱의 코어 로직(UI 렌더링, 위치 추적)을 막지 않도록 비동기로 조용히 실행됩니다.
 */
async function revalidateData(): Promise<void> {
  try {
    const response = await fetch(CDN_URL, {
      // 캐시 무효화: 항상 최신 JSON을 가져오도록 강제
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json && Array.isArray(json.places) && json.places.length > 0) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json));
      console.log(`[local_places] SWR: GitHub Pages에서 최신 장소 데이터(${json.places.length}건) 캐싱 완료.`);
      notifyListeners(json.places as Place[]);
    }
  } catch (error) {
    console.warn('[local_places] SWR Revalidate 실패 (네트워크 오프라인 등):', error);
  }
}

/**
 * SWR (Stale-While-Revalidate) 패턴이 적용된 장소 데이터 전체 조회
 * 
 * 1. 백그라운드 데이터 최신화 트리거 (Revalidate)
 * 2. AsyncStorage의 캐시 데이터 즉시 반환 (Stale)
 * 3. 캐시가 없으면 앱에 내장된 번들 데이터(assets/data) 즉시 반환 (Fallback)
 */
export const getPlaces = async (): Promise<Place[]> => {
  // 1. 백그라운드 갱신 트리거 (동시 다발적 요청 방지 Lock)
  if (!isRevalidating) {
    isRevalidating = true;
    revalidateData().finally(() => {
      isRevalidating = false;
    });
  }

  // 2. Stale (AsyncStorage 캐시 확인)
  try {
    const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && Array.isArray(parsed.places) && parsed.places.length > 0) {
        return parsed.places as Place[];
      }
    }
  } catch (error) {
    console.warn('[local_places] AsyncStorage 읽기 에러:', error);
  }

  // 3. Fallback (캐시 없음 -> 앱 내장 번들 데이터 사용)
  try {
    // 번들러 에러 방지를 위해, JSON 파일은 빌드 타임에 반드시 존재해야 함
    const bundledData = require('../../../assets/data/busan_places_master.json');
    if (bundledData && Array.isArray(bundledData.places)) {
      return bundledData.places as Place[];
    }
  } catch (error) {
    console.warn('[local_places] 번들 데이터 로드 에러:', error);
  }

  // 4. 극한의 예외 상황 (캐시도 없고 번들도 비정상일 때)
  return [];
};

/**
 * 특정 ID의 장소 데이터 단건 조회
 */
export const getPlaceById = async (id: string): Promise<Place | null> => {
  const places = await getPlaces();
  const place = places.find((p) => p.id === id);
  return place || null;
};
