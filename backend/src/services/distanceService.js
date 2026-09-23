/**
 * Distance-aware ordering (Development Prompt Section 6.3).
 *
 * Uses the Haversine formula as the free fallback for the prototype
 * (the spec explicitly allows this in place of the Distance Matrix API).
 * If GOOGLE_MAPS_API_KEY is set, swap haversineKm() below for a real
 * Distance Matrix / Directions API call - the rest of the algorithm
 * (nearest-neighbour ordering) stays the same.
 */

const EARTH_RADIUS_KM = 6371;
const AVG_WALK_SPEED_KMH = 4.5; // used to estimate travel_minutes_from_prev

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

function travelMinutes(a, b) {
  const km = haversineKm(a, b);
  return Math.max(5, Math.round((km / AVG_WALK_SPEED_KMH) * 60));
}

/**
 * Nearest-Neighbour TSP heuristic. Sufficient for 3-6 stops/day per spec -
 * intentionally NOT a full TSP solver (scope control for the Nov 30 freeze).
 *
 * @param {{lat:number,lng:number}} anchor - accommodation / city centre
 * @param {Array<{id,lat,lng}>} stops - candidate POIs for the day
 * @returns {Array} stops re-ordered nearest-neighbour style, each annotated
 *   with travel_minutes_from_prev
 */
function orderStopsNearestNeighbour(anchor, stops) {
  const remaining = [...stops];
  const ordered = [];
  let current = anchor;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const d = haversineKm(current, remaining[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const next = remaining.splice(nearestIdx, 1)[0];
    const minutes = travelMinutes(current, next);
    ordered.push({ ...next, travel_minutes_from_prev: minutes });
    current = next;
  }

  return ordered;
}

module.exports = { haversineKm, travelMinutes, orderStopsNearestNeighbour };
