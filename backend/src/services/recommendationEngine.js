const placesService = require('./placesService');
const weatherService = require('./weatherService');
const distanceService = require('./distanceService');

/**
 * Core Recommendation & Itinerary Engine - Development Prompt Section 6.
 * A hybrid rule-based + weighted-ranking system (deliberately NOT full ML,
 * per the spec's scope-control note).
 */

// Suggested starting weights (Section 6.2) - tune during evaluation.
const WEIGHTS = {
  interest: 0.5,
  rating: 0.25,
  budget: 0.15,
  redundancy: 0.1,
};

const DAILY_TIME_BUDGET_MINUTES = 9 * 60; // configurable daily activity budget
const DAY_START_HOUR = 9; // itinerary day starts at 09:00
const MAX_STOPS_PER_DAY = 5;
const MIN_STOPS_PER_DAY = 3;

/** budget_total / (#days) / a nominal per-POI spend baseline -> 0-4 target price level */
function computeTargetPriceLevel(budgetTotal, numDays) {
  if (!budgetTotal || !numDays) return 2; // mid-range default
  const perDay = budgetTotal / numDays;
  if (perDay < 40) return 0;
  if (perDay < 90) return 1;
  if (perDay < 160) return 2;
  if (perDay < 260) return 3;
  return 4;
}

/**
 * 6.2 Scoring formula.
 * score(poi) = w_interest*interest_match + w_rating*normalized_rating
 *            + w_budget*budget_fit - w_redundancy*category_redundancy_penalty
 */
function scorePoi(poi, { preferenceWeights, targetPriceLevel, categoryCounts }) {
  const tagWeight = preferenceWeights[poi.category] || 0; // 0 if not selected by user
  const interestMatch = tagWeight > 0 ? tagWeight / 10 : 0; // normalise 1-10 -> 0-1

  const normalizedRating = (poi.rating || 0) / 5;

  const budgetFit = 1 - Math.abs((poi.price_level ?? 2) - targetPriceLevel) / 4;

  const timesSeen = categoryCounts[poi.category] || 0;
  const redundancyPenalty = timesSeen; // increases each time the category is already selected

  const score =
    WEIGHTS.interest * interestMatch +
    WEIGHTS.rating * normalizedRating +
    WEIGHTS.budget * budgetFit -
    WEIGHTS.redundancy * redundancyPenalty;

  return { score, interestMatch, normalizedRating, budgetFit, redundancyPenalty };
}

function dateRange(startDate, endDate) {
  const dates = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function addMinutesToTime(hour, minutes) {
  const total = hour * 60 + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/**
 * 6.1 Candidate generation: query Places API per interest tag, filter by
 * budget-appropriate price level, dedupe by external_place_id.
 */
async function generateCandidates({ lat, lng, preferences, targetPriceLevel }) {
  const perTagResults = await Promise.all(
    preferences.map((p) => placesService.searchPlaces({ lat, lng, category: p.interest_tag }))
  );

  const dedup = new Map();
  perTagResults.flat().forEach((poi) => {
    // Filter out POIs priced well above what the budget allocation supports.
    if ((poi.price_level ?? 0) > targetPriceLevel + 1) return;
    if (!dedup.has(poi.external_place_id)) {
      dedup.set(poi.external_place_id, poi);
    }
  });

  return Array.from(dedup.values());
}

/**
 * 6.3 Distance-aware ordering for a single day's stops, with the 9h day
 * budget check: if the total (visit + travel) time exceeds the configured
 * daily activity budget, drop the lowest-scoring stop and re-order.
 */
function buildDayStops(anchor, candidateStops, dailyBudgetMinutes = DAILY_TIME_BUDGET_MINUTES) {
  let working = [...candidateStops];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ordered = distanceService.orderStopsNearestNeighbour(anchor, working);
    const totalMinutes = ordered.reduce(
      (sum, s) => sum + s.avg_visit_minutes + s.travel_minutes_from_prev,
      0
    );

    if (totalMinutes <= dailyBudgetMinutes || ordered.length <= 1) {
      return ordered;
    }

    // Drop the lowest-scoring stop and try again.
    let lowestIdx = 0;
    for (let i = 1; i < working.length; i += 1) {
      if (working[i].score < working[lowestIdx].score) lowestIdx = i;
    }
    working.splice(lowestIdx, 1);
  }
}

/**
 * 6.4 Weather-aware adjustment: for days with >50% precipitation chance or
 * extreme temperature, deprioritise outdoor=true stops in favour of indoor
 * alternatives still available in the candidate pool.
 */
function applyWeatherAdjustment(dayStops, forecast, remainingPool, usedIds) {
  const badWeather =
    forecast.precip_probability > 0.5 || forecast.temp_c < 5 || forecast.temp_c > 35;
  if (!badWeather) return dayStops;

  return dayStops.map((stop) => {
    if (!stop.outdoor) return stop;
    const replacement = remainingPool.find((c) => !c.outdoor && !usedIds.has(c.external_place_id));
    if (replacement) {
      usedIds.delete(stop.external_place_id);
      usedIds.add(replacement.external_place_id);
      return { ...replacement, travel_minutes_from_prev: stop.travel_minutes_from_prev };
    }
    return stop; // no indoor alternative available - keep original
  });
}

/**
 * Orchestrates the full pipeline described in Section 3 steps 2-6 and
 * Section 6 (candidate generation -> scoring -> distance ordering ->
 * weather adjustment) for one trip.
 *
 * @returns {Promise<{destination, days: Array}>}
 */
async function generateItinerary({ trip, preferences }) {
  const geo = await placesService.geocodeDestination(trip.destination_name);
  const lat = trip.destination_lat ?? geo.lat;
  const lng = trip.destination_lng ?? geo.lng;

  const dates = dateRange(trip.start_date, trip.end_date);
  const numDays = dates.length;
  const targetPriceLevel = computeTargetPriceLevel(Number(trip.budget_total), numDays);

  const preferenceWeights = {};
  preferences.forEach((p) => {
    preferenceWeights[p.interest_tag] = p.weight;
  });

  const candidates = await generateCandidates({ lat, lng, preferences, targetPriceLevel });

  // Score every candidate once with a fresh redundancy tracker, then sort.
  const categoryCounts = {};
  const scored = candidates
    .map((poi) => {
      const { score } = scorePoi(poi, { preferenceWeights, targetPriceLevel, categoryCounts });
      return { ...poi, score };
    })
    .sort((a, b) => b.score - a.score);

  // Fetch weather for all days up front.
  const forecasts = await weatherService.getForecast({ lat, lng, dates });

  const anchor = { lat, lng }; // accommodation / city-centre proxy
  const usedIds = new Set();
  const days = [];

  for (let dayIdx = 0; dayIdx < numDays; dayIdx += 1) {
    // Greedily pick top-scoring, not-yet-used, variety-aware candidates for this day.
    const dayCandidates = [];
    const localCategoryCounts = { ...categoryCounts };

    for (const poi of scored) {
      if (dayCandidates.length >= MAX_STOPS_PER_DAY) break;
      if (usedIds.has(poi.external_place_id)) continue;

      const { score } = scorePoi(poi, {
        preferenceWeights,
        targetPriceLevel,
        categoryCounts: localCategoryCounts,
      });
      dayCandidates.push({ ...poi, score });
      localCategoryCounts[poi.category] = (localCategoryCounts[poi.category] || 0) + 1;
    }

    // Ensure a sensible minimum where the candidate pool allows it.
    if (dayCandidates.length < MIN_STOPS_PER_DAY) {
      for (const poi of scored) {
        if (dayCandidates.length >= MIN_STOPS_PER_DAY) break;
        if (usedIds.has(poi.external_place_id)) continue;
        if (dayCandidates.find((d) => d.external_place_id === poi.external_place_id)) continue;
        dayCandidates.push(poi);
      }
    }

    dayCandidates.forEach((c) => usedIds.add(c.external_place_id));
    dayCandidates.forEach((c) => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    });

    let orderedStops = buildDayStops(anchor, dayCandidates);
    orderedStops = applyWeatherAdjustment(orderedStops, forecasts[dayIdx], scored, usedIds);

    // Compute arrival times sequentially from DAY_START_HOUR.
    let cursorMinutes = DAY_START_HOUR * 60;
    const stopsWithTiming = orderedStops.map((stop) => {
      cursorMinutes += stop.travel_minutes_from_prev;
      const arrival = addMinutesToTime(0, cursorMinutes);
      cursorMinutes += stop.avg_visit_minutes;
      return {
        ...stop,
        estimated_arrival: arrival,
        estimated_duration_minutes: stop.avg_visit_minutes,
      };
    });

    days.push({
      day_number: dayIdx + 1,
      date: dates[dayIdx],
      weather_summary: forecasts[dayIdx].summary,
      weather_temp_c: forecasts[dayIdx].temp_c,
      precip_probability: forecasts[dayIdx].precip_probability,
      stops: stopsWithTiming,
    });
  }

  return {
    destination: { lat, lng, formatted_address: geo.formatted_address },
    target_price_level: targetPriceLevel,
    days,
  };
}

module.exports = {
  generateItinerary,
  scorePoi,
  computeTargetPriceLevel,
  buildDayStops,
  WEIGHTS,
};
