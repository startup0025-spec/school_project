/**
 * V-World Water Body & Obstacle (Building/Road) WFS Scraper with Turf.js Clipping
 * 
 * Fetches spatial GeoJSON data for water bodies, buildings, and roads using WFS API with BBOX clipping.
 * Performs GIS Segment Clipping to separate exposed natural streams from covered underground streams (복개천).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const turf = require('@turf/turf');

const VWORLD_API_KEY = process.env.VWORLD_API_KEY || '58411BA3-A965-3751-B87F-9F551B97F37C';
const BBOX = '128.73,34.93,129.32,35.40';

const WATER_LAYERS = [
  { name: '연안', typename: 'lt_c_wgispl2abs', waterType: 'sea', radius: 3000, priority: 1 },
  { name: '하천망', typename: 'lt_c_wkmstrm', waterType: 'river', radius: 1000, priority: 4 }
];

const OBSTACLE_LAYERS = [
  { name: '건물', typename: 'lt_c_spbd' },
  { name: '도로', typename: 'lt_c_uq111' }
];

function fetchWfsLayer(layer) {
  return new Promise((resolve, reject) => {
    const bboxParts = BBOX.split(',').map(Number);
    const ptMin = turf.toMercator(turf.point([bboxParts[0], bboxParts[1]]));
    const ptMax = turf.toMercator(turf.point([bboxParts[2], bboxParts[3]]));
    const bbox3857 = `${ptMin.geometry.coordinates[0]},${ptMin.geometry.coordinates[1]},${ptMax.geometry.coordinates[0]},${ptMax.geometry.coordinates[1]}`;
    const url = `https://api.vworld.kr/req/wfs?service=WFS&request=GetFeature&version=1.1.0&typename=${layer.typename}&bbox=${bbox3857}&output=application/json&key=${VWORLD_API_KEY}&domain=https://github.com/startup0025-spec/school_project.git&size=3000`;
    
    console.log(`[WFS] Fetching ${layer.name} (${layer.typename})...`);
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (data.startsWith('<')) console.error('[WFS] XML Response for', layer.typename, ':', data.substring(0, 500));
          const json = JSON.parse(data);
          if (json.response && json.response.status === 'ERROR') {
            console.warn(`[WFS] Error in ${layer.typename}:`, json.response.result);
            resolve([]);
            return;
          }
          if (json.features) {
            console.log(`[WFS] Loaded ${json.features.length} features for ${layer.name}`);
            const wgs84Features = json.features.map(f => {
              const wgs84 = turf.toWgs84(f);
              return { ...wgs84, _layerMeta: layer };
            });
            resolve(wgs84Features);
          } else {
            resolve([]);
          }
        } catch(e) {
          console.error(`[WFS] Exception caught for ${layer.typename}:`, e.message);
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

function intersectBbox(b1, b2) {
  return !(b2[0] > b1[2] || b2[2] < b1[0] || b2[1] > b1[3] || b2[3] < b1[1]);
}

/**
 * Clips a water feature (LineString/Polygon) against obstacle polygons using Turf.js.
 * Returns an array of GeoJSON LineString features with an `isCovered` property.
 */
function clipWaterFeature(feature, obstaclePolygons) {
  let lines = [];
  
  if (feature.geometry.type === 'LineString') {
    lines.push(turf.lineString(feature.geometry.coordinates));
  } else if (feature.geometry.type === 'MultiLineString') {
    feature.geometry.coordinates.forEach(coords => {
      lines.push(turf.lineString(coords));
    });
  } else if (feature.geometry.type === 'Polygon') {
    // Extract the outer ring of the polygon to treat as a line
    lines.push(turf.lineString(feature.geometry.coordinates[0]));
  } else if (feature.geometry.type === 'MultiPolygon') {
    feature.geometry.coordinates.forEach(polyCoords => {
      lines.push(turf.lineString(polyCoords[0]));
    });
  } else {
    return [];
  }

  let finalSegments = [];

  for (const line of lines) {
    let segments = [line];
    const lineBbox = turf.bbox(line);

    for (const poly of obstaclePolygons) {
      if (poly.geometry.type !== 'Polygon' && poly.geometry.type !== 'MultiPolygon') continue;
      
      const polyBbox = turf.bbox(poly);
      if (!intersectBbox(lineBbox, polyBbox)) continue;

      let newSegments = [];
      for (const segment of segments) {
        if (turf.booleanIntersects(segment, poly)) {
          try {
            const splitResult = turf.lineSplit(segment, poly);
            if (splitResult.features.length > 0) {
              newSegments.push(...splitResult.features);
            } else {
              newSegments.push(segment);
            }
          } catch (e) {
            newSegments.push(segment);
          }
        } else {
          newSegments.push(segment);
        }
      }
      segments = newSegments;
    }

    // Determine visibility for chopped segments
    for (const seg of segments) {
      if (seg.geometry.coordinates.length < 2) continue;
      
      const p1 = turf.point(seg.geometry.coordinates[0]);
      const p2 = turf.point(seg.geometry.coordinates[seg.geometry.coordinates.length - 1]);
      const mid = turf.midpoint(p1, p2);
      
      let isCovered = false;
      const segBbox = turf.bbox(seg);
      
      for (const poly of obstaclePolygons) {
        if (poly.geometry.type !== 'Polygon' && poly.geometry.type !== 'MultiPolygon') continue;
        const polyBbox = turf.bbox(poly);
        if (!intersectBbox(segBbox, polyBbox)) continue;

        if (turf.booleanPointInPolygon(mid, poly)) {
          isCovered = true;
          break;
        }
      }
      
      seg.properties = { ...feature.properties, isCovered };
      finalSegments.push(seg);
    }
  }

  return finalSegments;
}

async function fetchOsmLakes() {
  const query = `
    [out:json];
    area["name"="부산광역시"]->.searchArea;
    (
      relation["natural"="water"]["water"="reservoir"](area.searchArea);
      way["natural"="water"]["water"="reservoir"](area.searchArea);
      relation["natural"="water"]["water"="lake"](area.searchArea);
      way["natural"="water"]["water"="lake"](area.searchArea);
    );
    out center;
  `;
  
  console.log(`[OSM] Fetching Lakes & Reservoirs from OpenStreetMap...`);
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Nodejs/fetch_vworld.js'
      },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(60000) // 60s timeout
    });

    if (!response.ok) {
      console.error(`[OSM] Failed to fetch: HTTP ${response.status}. Using cached OSM fallback data.`);
      return getFallbackLakes();
    }

    const data = await response.text();
    try {
      const json = JSON.parse(data);
      const elements = json.elements.filter(e => e.tags && e.tags.name);
      console.log(`[OSM] Fetched ${elements.length} named lakes/reservoirs.`);
      
      const lakes = elements.map(e => {
        const lat = e.center ? e.center.lat : e.lat;
        const lon = e.center ? e.center.lon : e.lon;
        const radius = e.tags.name.includes('회동') ? 2000 : 500;
        
        return {
          id: `osm_${e.id}`,
          name: e.tags.name,
          category: '호소',
          waterCategory: '호소',
          waterType: 'lake',
          latitude: lat,
          longitude: lon,
          geofenceRadius: radius,
          description: `${e.tags.name} (호소)`,
          priority: 3,
          geojsonSegments: []
        };
      });
      return lakes;
    } catch (e) {
      console.error(`[OSM] Exception parsing JSON:`, e.message, `Using fallback.`);
      return getFallbackLakes();
    }
  } catch (err) {
    console.error(`[OSM] Request error:`, err.message, `Using fallback.`);
    return getFallbackLakes();
  }
}

function getFallbackLakes() {
  const cached = [
    { name: '회동저수지', lat: 35.2563868, lon: 129.1169305 },
    { name: '대천공원 호수', lat: 35.1805872, lon: 129.166714 },
    { name: '성지곡수원지', lat: 35.1869304, lon: 129.040731 },
    { name: '내리저수지', lat: 35.2204543, lon: 129.1868369 },
    { name: '용천 저수지', lat: 35.2989427, lon: 129.1929163 },
    { name: '명례 소류지', lat: 35.3798112, lon: 129.2615747 },
    { name: '천성저수지', lat: 35.034329, lon: 128.8240088 },
    { name: '성북소류지', lat: 35.0522912, lon: 128.8273285 },
    { name: '병산저수지', lat: 35.3439709, lon: 129.1824555 },
    { name: '사기점못', lat: 35.269236, lon: 129.0796798 },
    { name: '부산 제1수원지', lat: 35.1231064, lon: 129.0183756 },
    { name: '지석골소류지', lat: 35.3434893, lon: 129.171721 },
    { name: '성골소류지', lat: 35.1104764, lon: 128.8641748 },
    { name: '산양소류지', lat: 35.1155824, lon: 128.8661046 },
    { name: '수서생태원', lat: 35.2527456, lon: 129.0409616 },
    { name: '연꽃소류지', lat: 35.299961, lon: 129.1151061 },
    { name: '1단지 연못', lat: 35.2197029, lon: 129.0097259 },
    { name: '임기저수지', lat: 35.3231564, lon: 129.1378505 },
    { name: '홍류동소류지', lat: 35.2962058, lon: 129.1671113 },
    { name: '만화곡저수지', lat: 35.2707148, lon: 129.186758 },
    { name: '안평저수지', lat: 35.2488174, lon: 129.1828848 },
    { name: '예지골못', lat: 35.2629818, lon: 129.202877 },
    { name: '큰이내터못', lat: 35.2534988, lon: 129.1902796 },
    { name: '작은이내터못', lat: 35.2546317, lon: 129.1948401 },
    { name: '신천 저수지', lat: 35.2455889, lon: 129.2310646 },
    { name: '뒷들 저수지', lat: 35.2763879, lon: 129.2214227 },
    { name: '횡계 저수지', lat: 35.2729762, lon: 129.2275871 },
    { name: '석산못', lat: 35.2092719, lon: 129.2096968 },
    { name: '화전소류지', lat: 35.1037689, lon: 128.8643818 },
    { name: '참샘골못', lat: 35.2642988, lon: 129.2175606 },
    { name: '홍류지', lat: 35.2884588, lon: 129.1619978 },
    { name: '탑골못', lat: 35.31597, lon: 129.1207856 },
    { name: '불당골못', lat: 35.2880022, lon: 129.2193112 },
    { name: '신촌소류지', lat: 35.1116371, lon: 128.8537783 },
    { name: '대덕못', lat: 35.3316718, lon: 129.2352944 },
    { name: '대덕소류지', lat: 35.3323075, lon: 129.2237664 },
    { name: '안골못', lat: 35.3190494, lon: 129.1253051 },
    { name: '대곡저수지', lat: 35.2595327, lon: 129.1476968 },
    { name: '물랑소류지', lat: 35.2821865, lon: 129.0906389 },
    { name: '작장소류지', lat: 35.2856826, lon: 129.0929335 },
    { name: '녹동소류지', lat: 35.2972196, lon: 129.0828705 },
    { name: '보굴소류지', lat: 35.2860668, lon: 129.087962 },
    { name: '상곡소류지', lat: 35.3109229, lon: 129.1576687 },
    { name: '세척소류지', lat: 35.2898747, lon: 129.1176696 },
    { name: '호수형 습지', lat: 35.1147139, lon: 128.9471551 },
    { name: '담수습지', lat: 35.1040693, lon: 128.9416351 },
    { name: '기수습지', lat: 35.1029226, lon: 128.9445325 }
  ];
  return cached.map((e, idx) => {
    const radius = e.name.includes('회동') ? 2000 : 500;
    return {
      id: `osm_cached_${idx}`,
      name: e.name,
      category: '호소',
      waterCategory: '호소',
      waterType: 'lake',
      latitude: e.lat,
      longitude: e.lon,
      geofenceRadius: radius,
      description: `${e.name} (호소)`,
      priority: 3,
      geojsonSegments: []
    };
  });
}

async function main() {
  console.log('====================================================');
  console.log('🌊 V-World WFS API with GIS Segment Clipping starting');
  console.log('====================================================');

  // 1. Fetch Obstacles (Buildings, Roads)
  let obstaclePolygons = [];
  for (const layer of OBSTACLE_LAYERS) {
    const features = await fetchWfsLayer(layer);
    obstaclePolygons.push(...features);
  }
  console.log(`[GIS] Total obstacle polygons fetched: ${obstaclePolygons.length}`);

  // 2. Fetch Water Features and clip them
  const allPlaces = [];
  const categoriesCount = {};
  let totalSegments = 0;
  let exposedSegments = 0;
  let coveredSegments = 0;

  for (const layer of WATER_LAYERS) {
    const features = await fetchWfsLayer(layer);
    let catCount = 0;
    
    for (const f of features) {
      if (!f.geometry || !f.geometry.coordinates) continue;

      const props = f.properties || {};
      const title = props.riv_nm || props.명칭 || props.이름 || props.NAME || `${layer.name} 수계`;
      const placeId = f.id || `vw_${layer.typename}_${catCount}`;
      
      let actualWaterType = layer.waterType;
      let actualCategory = layer.name;
      let priority = layer.priority;

      if (layer.typename === 'lt_c_wkmstrm') {
        const level = props.riv_level || props.cat_nam || '';
        if (level.includes('국가')) {
          actualWaterType = 'national_river';
          actualCategory = '국가하천';
          priority = 2;
        } else if (level.includes('지방')) {
          actualWaterType = 'local_river';
          actualCategory = '지방하천';
          priority = 4;
        } else {
          actualWaterType = 'stream';
          actualCategory = '세천';
          priority = 5;
        }
      }

      // Compute center for marker distance logic (Ensures point is EXACTLY on the geometry)
      const center = turf.pointOnFeature(f);
      const [lng, lat] = center.geometry.coordinates;
      if (lat === 0 && lng === 0) continue;

      // Clip the feature against buildings and roads
      const clippedSegments = clipWaterFeature(f, obstaclePolygons);
      
      totalSegments += clippedSegments.length;
      clippedSegments.forEach(s => s.properties.isCovered ? coveredSegments++ : exposedSegments++);

      allPlaces.push({
        id: placeId,
        name: title,
        category: actualCategory,
        waterCategory: actualCategory,
        waterType: actualWaterType,
        latitude: lat,
        longitude: lng,
        geofenceRadius: layer.radius,
        description: `${title} (${actualCategory})`.trim(),
        priority: priority,
        geojsonSegments: clippedSegments.map(s => ({
          type: s.geometry.type,
          coordinates: s.geometry.coordinates,
          isCovered: s.properties.isCovered
        }))
      });
      catCount++;
    }
    categoriesCount[layer.name] = catCount;
  }

  // 3. Fetch OSM Lakes and append
  const osmLakes = await fetchOsmLakes();
  allPlaces.push(...osmLakes);
  categoriesCount['호소'] = osmLakes.length;

  console.log('====================================================');
  console.log(`[GIS] Clipping Summary:`);
  console.log(`  - Total Water Segments: ${totalSegments}`);
  console.log(`  - Exposed Streams (Safe): ${exposedSegments}`);
  console.log(`  - Covered Streams (Hidden): ${coveredSegments}`);
  console.log('====================================================');

  if (allPlaces.length === 0) {
    console.error(`❌ No places were fetched or generated. Aborting save to prevent overwriting with empty data.`);
    return;
  }

  const outputData = {
    generatedAt: new Date().toISOString(),
    totalCount: allPlaces.length,
    categoriesCount: categoriesCount,
    places: allPlaces,
  };

  const rootPath = path.join(__dirname, '..', 'vworld_places.json');
  const mobileDataPath = path.join(__dirname, '..', 'mobile', 'assets', 'data', 'vworld_places.json');

  const saveJson = (filePath) => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');
      console.log(`💾 Saved ${allPlaces.length} places to: ${filePath}`);
    } catch (err) {
      console.error(`❌ Failed to write file to ${filePath}:`, err.message);
    }
  };

  saveJson(rootPath);
  saveJson(mobileDataPath);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
