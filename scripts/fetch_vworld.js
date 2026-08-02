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

const VWORLD_API_KEY = process.env.VWORLD_API_KEY || '09DBB978-D1AB-3A87-9204-62EE9F6F06EA';
const BBOX = '128.73,34.93,129.32,35.40';

const WATER_LAYERS = [
  { name: '연안', typename: 'LT_C_W_COASTLINE', waterType: 'sea', radius: 3000, priority: 1 },
  { name: '호소', typename: 'LT_C_W_LAKE', waterType: 'stream', radius: 1500, priority: 3 },
  { name: '하천구역', typename: 'LT_C_W_RIVERAREA', waterType: 'river', radius: 2000, priority: 2 },
  { name: '하천망', typename: 'LT_L_TOPO_Y_Y7', waterType: 'river', radius: 1000, priority: 4 },
  { name: '지방하천', typename: 'lt_l_river', waterType: 'stream', radius: 800, priority: 5 }
];

const OBSTACLE_LAYERS = [
  { name: '건물', typename: 'LT_C_BULD_INFO' },
  { name: '도로', typename: 'LT_C_UQ111' }
];

function fetchWfsLayer(layer) {
  return new Promise((resolve, reject) => {
    // size=3000 to get enough data for demo BBOX without timeout
    const url = `https://api.vworld.kr/req/wfs?service=WFS&request=GetFeature&version=2.0.0&crs=EPSG:4326&typename=${layer.typename}&bbox=${BBOX}&format=json&key=${VWORLD_API_KEY}&size=3000`;
    
    console.log(`[WFS] Fetching ${layer.name} (${layer.typename})...`);
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.response && json.response.status === 'ERROR') {
            console.warn(`[WFS] Error in ${layer.typename}:`, json.response.result);
            resolve([]);
            return;
          }
          if (json.features) {
            console.log(`[WFS] Loaded ${json.features.length} features for ${layer.name}`);
            resolve(json.features.map(f => ({ ...f, _layerMeta: layer })));
          } else {
            resolve([]);
          }
        } catch(e) {
          console.error(`[WFS] Parse error for ${layer.typename}`);
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

      const title = (f.properties && (f.properties.명칭 || f.properties.이름 || f.properties.NAME || f.properties.RIV_NAM)) || `${layer.name} 수계`;
      const placeId = f.id || `vw_${layer.typename}_${catCount}`;
      
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
        category: layer.name,
        waterCategory: layer.name,
        waterType: layer.waterType,
        latitude: lat,
        longitude: lng,
        geofenceRadius: layer.radius,
        description: `${title} (${layer.name})`.trim(),
        priority: layer.priority,
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
