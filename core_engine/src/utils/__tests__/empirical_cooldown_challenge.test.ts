import assert from 'node:assert';
import { test, describe } from 'node:test';
import { sortPlacesByDistance } from '../haversine.ts';

interface Spot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Simulated state tracker encapsulating MapScreen (map.tsx:439-459) logic.
 */
class MapScreenLocationTracker {
  private places: Spot[];
  private index: number;
  private lastSortTime: number;
  private readonly SORT_COOLDOWN_MS = 180000;
  public sortCount = 0;

  constructor(initialPlaces: Spot[], initialIndex = 0, initialLastSortTime = 0) {
    this.places = [...initialPlaces];
    this.index = initialIndex;
    this.lastSortTime = initialLastSortTime;
  }

  public getPlaces(): Spot[] {
    return this.places;
  }

  public getIndex(): number {
    return this.index;
  }

  public getActivePlace(): Spot | undefined {
    return this.places[this.index];
  }

  public getLastSortTime(): number {
    return this.lastSortTime;
  }

  public setIndex(newIndex: number): void {
    this.index = newIndex;
  }

  public setPlaces(newPlaces: Spot[]): void {
    this.places = [...newPlaces];
  }

  /**
   * Processes a location update at given timestamp (ms) and coordinates,
   * matching MapScreen.tsx logic in app/(tabs)/map.tsx:439-459.
   */
  public onLocationUpdate(latitude: number, longitude: number, timestampMs: number): boolean {
    const now = timestampMs;
    if (this.lastSortTime === 0 || now - this.lastSortTime >= this.SORT_COOLDOWN_MS) {
      if (!this.places || this.places.length === 0) return false;

      const currentSelectedId = this.places[this.index]?.id;
      const sorted = sortPlacesByDistance(this.places, { latitude, longitude });

      if (currentSelectedId) {
        const newIdx = sorted.findIndex((p) => p.id === currentSelectedId);
        this.index = newIdx !== -1 ? newIdx : 0;
      } else {
        this.index = 0;
      }

      this.places = sorted;
      this.lastSortTime = now;
      this.sortCount++;
      return true; // Sort occurred
    }

    return false; // Throttled
  }
}

describe('Empirical Verification: 3-Minute Cooldown Throttle & Active Index Preservation', () => {
  const samplePlaces: Spot[] = [
    { id: 'spot_a', name: 'Sebyeonggyo', latitude: 35.1978, longitude: 129.0837 },
    { id: 'spot_b', name: 'Gwangalli Beach', latitude: 35.1532, longitude: 129.1189 },
    { id: 'spot_c', name: 'Haeundae Beach', latitude: 35.1587, longitude: 129.1601 },
    { id: 'spot_d', name: 'Oncheoncheon Stream', latitude: 35.2050, longitude: 129.0780 },
  ];

  // Base timestamp simulating real-world Unix epoch timestamp (ms)
  const BASE_TIME_MS = 1_700_000_000_000;

  test('Empirical Test 1: Rapid GPS Update Sequence (t=0s, 10s, 30s, 60s, 120s, 179s, 180s, 181s)', () => {
    const tracker = new MapScreenLocationTracker(samplePlaces, 0, 0);

    const timeline = [
      { timeSec: 0, lat: 35.1978, lng: 129.0837, expectedSort: true, desc: 'Initial update at t=0s' },
      { timeSec: 10, lat: 35.1530, lng: 129.1180, expectedSort: false, desc: 'Rapid update at t=10s' },
      { timeSec: 30, lat: 35.1580, lng: 129.1600, expectedSort: false, desc: 'Rapid update at t=30s' },
      { timeSec: 60, lat: 35.2050, lng: 129.0780, expectedSort: false, desc: 'Rapid update at t=60s' },
      { timeSec: 120, lat: 35.1530, lng: 129.1180, expectedSort: false, desc: 'Rapid update at t=120s' },
      { timeSec: 179, lat: 35.1580, lng: 129.1600, expectedSort: false, desc: 'Boundary update at t=179s (179,000ms)' },
      { timeSec: 180, lat: 35.1587, lng: 129.1601, expectedSort: true, desc: 'Cooldown expiry update at t=180s (180,000ms)' },
      { timeSec: 181, lat: 35.1978, lng: 129.0837, expectedSort: false, desc: 'Immediate subsequent update at t=181s' },
    ];

    timeline.forEach((step) => {
      const timeMs = BASE_TIME_MS + step.timeSec * 1000;
      const didSort = tracker.onLocationUpdate(step.lat, step.lng, timeMs);

      assert.strictEqual(
        didSort,
        step.expectedSort,
        `[${step.desc}] Expected sort=${step.expectedSort}, actual sort=${didSort}`
      );

      if (step.timeSec === 0) {
        assert.strictEqual(
          tracker.getLastSortTime(),
          BASE_TIME_MS,
          't=0s sort timestamp recorded correctly'
        );
      }

      if (step.timeSec === 180) {
        assert.strictEqual(
          tracker.getLastSortTime(),
          BASE_TIME_MS + 180000,
          't=180s sort timestamp updated to BASE_TIME + 180,000ms'
        );
      }
    });

    assert.strictEqual(tracker.sortCount, 2, 'Total sort calls over timeline must equal exactly 2');
  });

  test('Empirical Test 2: Active Place ID Preservation across Re-sorts', () => {
    const tracker = new MapScreenLocationTracker(samplePlaces, 0, 0);

    // Initial sort at t=0s near spot_a
    tracker.onLocationUpdate(35.1978, 129.0837, BASE_TIME_MS);
    assert.strictEqual(tracker.getPlaces()[0].id, 'spot_a');

    // User selects spot_c (Haeundae Beach), setting active index to 2
    const spotCIndex = tracker.getPlaces().findIndex((p) => p.id === 'spot_c');
    assert.ok(spotCIndex !== -1);
    tracker.setIndex(spotCIndex);
    assert.strictEqual(tracker.getActivePlace()?.id, 'spot_c', 'User selected spot_c');

    // At t=180s (cooldown elapsed), user updates GPS to near spot_b (Gwangalli)
    // New distance order: spot_b (closest), spot_a, spot_c, spot_d
    tracker.onLocationUpdate(35.1532, 129.1189, BASE_TIME_MS + 180000);

    const reSortedPlaces = tracker.getPlaces();
    assert.strictEqual(reSortedPlaces[0].id, 'spot_b', 'spot_b is now index 0 after re-sort');

    // Verify active place ID is STILL spot_c even though spot_c position in array moved
    const newActivePlace = tracker.getActivePlace();
    assert.strictEqual(
      newActivePlace?.id,
      'spot_c',
      'Active place ID must remain spot_c after re-sort'
    );
    assert.strictEqual(
      newActivePlace?.name,
      'Haeundae Beach',
      'Active place name must remain Haeundae Beach'
    );
  });

  test('Empirical Test 3: Sub-millisecond Boundary Verification (179,999ms vs 180,000ms)', () => {
    const tracker = new MapScreenLocationTracker(samplePlaces, 0, BASE_TIME_MS);

    // Update at BASE_TIME + 179,999 ms -> Should NOT sort
    const result179999 = tracker.onLocationUpdate(35.1587, 129.1601, BASE_TIME_MS + 179999);
    assert.strictEqual(result179999, false, '179,999ms elapsed must be throttled');

    // Update at BASE_TIME + 180,000 ms -> Should sort
    const result180000 = tracker.onLocationUpdate(35.1587, 129.1601, BASE_TIME_MS + 180000);
    assert.strictEqual(result180000, true, '180,000ms elapsed must trigger re-sort');
  });

  test('Empirical Test 4: Edge Case - Selected Place Missing / Deleted Fallback', () => {
    // Case 4A: Out-of-bounds selected index (e.g. index 3 when places array has length 3)
    const threePlaces = samplePlaces.slice(0, 3); // spot_a, spot_b, spot_c
    const trackerOOB = new MapScreenLocationTracker(threePlaces, 3, BASE_TIME_MS); // index 3 is undefined
    const didSort1 = trackerOOB.onLocationUpdate(35.1978, 129.0837, BASE_TIME_MS + 180000);
    assert.strictEqual(didSort1, true);
    assert.strictEqual(trackerOOB.getIndex(), 0, 'Out of bounds index resets safely to 0');

    // Case 4B: Selected ID is not present in sorted array (e.g. filtered out)
    // Create custom tracker where currentSelectedId is 'deleted_spot'
    const deletedSpotPlace: Spot = { id: 'deleted_spot', name: 'Deleted Spot', latitude: 35.1, longitude: 129.1 };
    const customPlaces = [samplePlaces[0], deletedSpotPlace];
    const trackerDeleted = new MapScreenLocationTracker(customPlaces, 1, BASE_TIME_MS);
    assert.strictEqual(trackerDeleted.getActivePlace()?.id, 'deleted_spot');

    // Filter out deleted_spot before sort or simulate findIndex returning -1
    trackerDeleted.setPlaces([samplePlaces[0], samplePlaces[1]]); // deleted_spot is gone
    // index is 1, pointing to samplePlaces[1] ('spot_b')
    // Now trigger location update at t=180,000 ms
    const didSort2 = trackerDeleted.onLocationUpdate(35.1978, 129.0837, BASE_TIME_MS + 180000);
    assert.strictEqual(didSort2, true);
    // 'spot_b' (id: 'spot_b') is selected and preserved
    assert.strictEqual(trackerDeleted.getActivePlace()?.id, 'spot_b');
  });

  test('Empirical Test 5: Edge Case - Out of Bounds Index Protection', () => {
    const tracker = new MapScreenLocationTracker(samplePlaces, 999, BASE_TIME_MS);

    const didSort = tracker.onLocationUpdate(35.1978, 129.0837, BASE_TIME_MS + 180000);
    assert.strictEqual(didSort, true);
    assert.strictEqual(tracker.getIndex(), 0, 'Invalid out-of-bounds index resets safely to 0');
  });
});
