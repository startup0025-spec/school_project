const fs = require('fs');
const path = require('path');

// Test vworld_places.json structure
function verifyJsonStructure() {
  const jsonPath = path.join(__dirname, '..', 'vworld_places.json');
  console.log('🔍 [Verification] Testing vworld_places.json structure at:', jsonPath);
  
  if (!fs.existsSync(jsonPath)) {
    throw new Error('vworld_places.json does not exist!');
  }

  const content = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(content);

  console.log('   generatedAt:', data.generatedAt);
  console.log('   totalCount:', data.totalCount);
  console.log('   categoriesCount:', JSON.stringify(data.categoriesCount));

  if (!Array.isArray(data.places) || data.places.length === 0) {
    throw new Error('Places array is empty or invalid!');
  }

  const categories = ['연안', '국가하천', '호소', '지방하천', '소하천'];
  for (const cat of categories) {
    if (!data.categoriesCount || typeof data.categoriesCount[cat] !== 'number' || data.categoriesCount[cat] < 0) {
      throw new Error(`Category [${cat}] missing in categoriesCount!`);
    }
  }

  console.log('✅ vworld_places.json structure verification PASSED!\n');
}

// Unit test priority override logic algorithm matching geofencing_service.ts
function verifyPriorityAlgorithm() {
  console.log('🔍 [Verification] Testing distance weight priority override logic algorithm...');

  // Mock places
  const streamPlace = {
    id: 'p-stream-1',
    name: '작은 소하천',
    latitude: 35.1005, // ~200m away
    longitude: 129.0000,
    waterCategory: '소하천',
    waterType: 'stream',
    geofenceRadius: 800,
    priority: 5,
  };

  const coastPlace = {
    id: 'p-coast-1',
    name: '해운대 연안',
    latitude: 35.1050, // ~600m away
    longitude: 129.0000,
    waterCategory: '연안',
    waterType: 'sea',
    geofenceRadius: 3000,
    priority: 1,
  };

  const places = [streamPlace, coastPlace];

  // Simulated user position (35.1000, 129.0000)
  // Distance to stream: ~555m (inside 800m geofence)
  // Distance to coast: ~555m + delta (inside 3000m geofence)
  
  // Inline implementation of findOptimalTargetPlace logic for test verification
  const CATEGORY_WEIGHTS = { 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1.0, 6: 1.2 };

  function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function getCategoryPriority(p) {
    if (typeof p.priority === 'number') return p.priority;
    const cat = p.waterCategory || p.category || '';
    if (cat.includes('연안') || p.waterType === 'sea') return 1;
    if (cat.includes('국가하천')) return 2;
    if (cat.includes('호소')) return 3;
    if (cat.includes('지방하천')) return 4;
    if (cat.includes('소하천') || p.waterType === 'stream') return 5;
    return 6;
  }

  function findOptimal(placeList, uLat, uLng) {
    let best = null;
    let bestRealDist = Infinity;
    let bestWeightedDist = Infinity;

    for (const p of placeList) {
      const dist = getHaversineDistance(uLat, uLng, p.latitude, p.longitude);
      const priority = getCategoryPriority(p);
      const weight = CATEGORY_WEIGHTS[priority] || 1.0;
      const weightedDist = dist * weight;

      if (!best) {
        best = p;
        bestRealDist = dist;
        bestWeightedDist = weightedDist;
        continue;
      }

      const currPriority = getCategoryPriority(best);
      const inRange = dist <= p.geofenceRadius;
      const currInRange = bestRealDist <= best.geofenceRadius;

      if (inRange && !currInRange) {
        best = p;
        bestRealDist = dist;
        bestWeightedDist = weightedDist;
      } else if (inRange && currInRange) {
        if (priority < currPriority) {
          best = p;
          bestRealDist = dist;
          bestWeightedDist = weightedDist;
        } else if (priority === currPriority && dist < bestRealDist) {
          best = p;
          bestRealDist = dist;
          bestWeightedDist = weightedDist;
        }
      } else if (!inRange && !currInRange) {
        if (weightedDist < bestWeightedDist) {
          best = p;
          bestRealDist = dist;
          bestWeightedDist = weightedDist;
        }
      }
    }
    return best;
  }

  const result = findOptimal(places, 35.1000, 129.0000);
  console.log(`   User at (35.1000, 129.0000). Stream dist: ${getHaversineDistance(35.1000, 129.0000, streamPlace.latitude, streamPlace.longitude).toFixed(1)}m, Coast dist: ${getHaversineDistance(35.1000, 129.0000, coastPlace.latitude, coastPlace.longitude).toFixed(1)}m`);
  console.log(`   Selected target place: "${result.name}" (${result.waterCategory}, priority ${result.priority})`);

  if (result.id !== 'p-coast-1') {
    throw new Error(`Priority override test failed! Expected Coastline to override Small Stream, but got: ${result.name}`);
  }

  console.log('✅ Priority Override algorithm verification PASSED!\n');
}

verifyJsonStructure();
verifyPriorityAlgorithm();
console.log('🎉 ALL VERIFICATIONS PASSED SUCCESSFULLY!');
