import { Place } from '../models/place_model';

const TOUR_API_URL = 'https://apis.data.go.kr/B551011/KorService1/locationBasedList1';

/**
 * Fetches nearby beaches/sea locations using the Korea Tourism Organization API.
 * Currently filters for keywords related to the sea.
 * @param latitude User's current latitude
 * @param longitude User's current longitude
 * @param radius Search radius in meters (default 10000m = 10km)
 */
export async function fetchNearbyBeaches(latitude: number, longitude: number, radius: number = 10000): Promise<Place[]> {
  const serviceKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY;
  if (!serviceKey) {
    console.warn('[TourAPI] EXPO_PUBLIC_KMA_SERVICE_KEY is missing.');
    return [];
  }

  try {
    const params = new URLSearchParams({
      serviceKey: serviceKey, // URLSearchParams encodes it automatically, but it's hex so it's fine.
      numOfRows: '20',
      pageNo: '1',
      MobileOS: 'AND',
      MobileApp: 'AnywayTheSea',
      _type: 'json',
      mapX: longitude.toString(),
      mapY: latitude.toString(),
      radius: radius.toString(),
      contentTypeId: '12', // 12 = Tourist attraction
    });

    // In a React Native environment, fetch is available globally.
    const response = await fetch(`${TOUR_API_URL}?${params.toString()}`);
    
    if (!response.ok) {
      console.warn(`[TourAPI] HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const items = data?.response?.body?.items?.item;

    if (!items || !Array.isArray(items)) {
      return [];
    }

    const beaches: Place[] = [];
    for (const item of items) {
      const title = item.title || '';
      // Strict filter to identify sea/beaches among general tourist spots
      if (title.includes('해수욕장') || title.includes('해변') || title.includes('바다') || title.includes('해안')) {
        beaches.push({
          id: `tour-${item.contentid}`,
          name: title,
          description: '푸른 바다가 끝없이 펼쳐져 있어요. 시원한 파도 소리를 들어보세요.',
          latitude: parseFloat(item.mapy),
          longitude: parseFloat(item.mapx),
          waterType: 'sea',
          geofenceRadius: 1000, // Reduced radius per user rule
          district: item.addr1 || '부산',
          // kmaNx, kmaNy omitted as TourAPI locations bypass water level API and rely on district string for weather
        });
      }
    }

    return beaches;
  } catch (error) {
    // If the server returns 500 or network fails, gracefully catch and return empty array.
    console.warn('[TourAPI] Failed to fetch nearby beaches:', error);
    return [];
  }
}
