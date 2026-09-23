const axios = require('axios');

/**
 * Places / geocoding service.
 *
 * If GOOGLE_MAPS_API_KEY is configured, real Google Geocoding + Places
 * (Nearby Search) calls are used. Otherwise a deterministic mock provider
 * generates plausible POIs around the destination so the rest of the
 * pipeline (scoring, ordering, weather adjustment) can be built/tested
 * without live API keys or billing set up.
 */

const CATEGORY_LIBRARY = {
  museums: ['Museum', 'Gallery', 'History Centre'],
  nature: ['National Park', 'Botanical Garden', 'Nature Reserve', 'Viewpoint'],
  nightlife: ['Rooftop Bar', 'Jazz Club', 'Night Market'],
  food: ['Food Market', 'Bistro', 'Street Food Alley', 'Local Eatery'],
  history: ['Old Town', 'Historic Fort', 'Heritage Site', 'Ancient Ruins'],
  shopping: ['Shopping District', 'Craft Market', 'Boutique Row'],
  adventure: ['Zipline Park', 'Hiking Trail', 'Watersports Centre'],
  relaxation: ['Spa', 'Beach', 'Thermal Baths'],
  art: ['Art District', 'Sculpture Garden', 'Design Studio'],
  family: ['Aquarium', 'Zoo', 'Interactive Science Centre'],
};

const OUTDOOR_CATEGORIES = new Set(['nature', 'adventure', 'relaxation', 'history']);

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}

/** Geocode a destination name to { lat, lng }. Falls back to a small known-city table, then a hashed pseudo-location. */
async function geocodeDestination(destinationName) {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    const resp = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: destinationName, key: process.env.GOOGLE_MAPS_API_KEY },
    });
    const result = resp.data.results && resp.data.results[0];
    if (!result) throw new Error(`Could not geocode destination: ${destinationName}`);
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
    };
  }

  const KNOWN = {
    paris: { lat: 48.8566, lng: 2.3522 },
    'paris, france': { lat: 48.8566, lng: 2.3522 },
    tokyo: { lat: 35.6762, lng: 139.6503 },
    nairobi: { lat: -1.2921, lng: 36.8219 },
    rome: { lat: 41.9028, lng: 12.4964 },
    'new york': { lat: 40.7128, lng: -74.006 },
    london: { lat: 51.5074, lng: -0.1278 },
    barcelona: { lat: 41.3874, lng: 2.1686 },
    bali: { lat: -8.3405, lng: 115.092 },
    'cape town': { lat: -33.9249, lng: 18.4241 },
  };
  const key = destinationName.trim().toLowerCase();
  if (KNOWN[key]) {
    return { ...KNOWN[key], formatted_address: destinationName };
  }

  // Deterministic pseudo-geocode so repeated calls for the same string agree.
  const rand = seededRandom(hashStr(key));
  return {
    lat: rand() * 140 - 70,
    lng: rand() * 340 - 170,
    formatted_address: destinationName,
  };
}

/**
 * Returns candidate POIs near `center` for a single interest tag.
 * Mirrors the shape returned by Google Places Nearby Search closely enough
 * that swapping providers only touches this function.
 */
async function searchPlaces({ lat, lng, category, radiusKm = 8 }) {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    const resp = await axios.get(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      {
        params: {
          location: `${lat},${lng}`,
          radius: radiusKm * 1000,
          keyword: category,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );
    return (resp.data.results || []).map((p) => ({
      external_place_id: p.place_id,
      name: p.name,
      category,
      lat: p.geometry.location.lat,
      lng: p.geometry.location.lng,
      price_level: p.price_level ?? 2,
      rating: p.rating ?? 4.0,
      avg_visit_minutes: 90,
      outdoor: OUTDOOR_CATEGORIES.has(category),
      raw_data: p,
    }));
  }

  // --- Mock provider ---
  const names = CATEGORY_LIBRARY[category] || ['Local Attraction'];
  const rand = seededRandom(hashStr(`${lat.toFixed(3)},${lng.toFixed(3)},${category}`));
  const count = 7 + Math.floor(rand() * 4); // 7-10 candidates per tag
  const results = [];
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * 2 * Math.PI;
    const distanceKm = rand() * radiusKm;
    const dLat = (distanceKm / 111) * Math.cos(angle);
    const dLng = (distanceKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    const label = names[i % names.length];
    results.push({
      external_place_id: `mock-${category}-${lat.toFixed(3)}-${lng.toFixed(3)}-${i}`,
      name: `${label} ${i + 1}`,
      category,
      lat: lat + dLat,
      lng: lng + dLng,
      price_level: Math.floor(rand() * 5), // 0-4
      rating: Math.round((3 + rand() * 2) * 10) / 10, // 3.0 - 5.0
      avg_visit_minutes: [60, 90, 120, 150][Math.floor(rand() * 4)],
      outdoor: OUTDOOR_CATEGORIES.has(category),
      raw_data: { mock: true },
    });
  }
  return results;
}

module.exports = { geocodeDestination, searchPlaces, OUTDOOR_CATEGORIES };
