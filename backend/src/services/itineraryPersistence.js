const db = require('../config/db');

/** Upsert a POI into the points_of_interest cache table, return its row id. */
async function upsertPoi(client, poi) {
  const result = await client.query(
    `INSERT INTO points_of_interest
       (external_place_id, name, category, lat, lng, price_level, rating,
        avg_visit_minutes, outdoor, raw_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (external_place_id) DO UPDATE SET
       name = EXCLUDED.name,
       rating = EXCLUDED.rating,
       price_level = EXCLUDED.price_level,
       fetched_at = NOW()
     RETURNING id`,
    [
      poi.external_place_id,
      poi.name,
      poi.category,
      poi.lat,
      poi.lng,
      poi.price_level,
      poi.rating,
      poi.avg_visit_minutes,
      poi.outdoor,
      JSON.stringify(poi.raw_data || {}),
    ]
  );
  return result.rows[0].id;
}

/**
 * Persists a full engine-generated itinerary (Section 4 tables:
 * itineraries -> itinerary_days -> itinerary_stops) and returns it in the
 * shape the frontend expects (nested days/stops with POI details inlined).
 */
async function persistItinerary({ tripId, generated }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const versionResult = await client.query(
      'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM itineraries WHERE trip_id = $1',
      [tripId]
    );
    const nextVersion = versionResult.rows[0].next_version;

    const itineraryResult = await client.query(
      'INSERT INTO itineraries (trip_id, version) VALUES ($1,$2) RETURNING *',
      [tripId, nextVersion]
    );
    const itinerary = itineraryResult.rows[0];

    const days = [];
    for (const day of generated.days) {
      const dayResult = await client.query(
        `INSERT INTO itinerary_days (itinerary_id, day_number, date, weather_summary, weather_temp_c)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [itinerary.id, day.day_number, day.date, day.weather_summary, day.weather_temp_c]
      );
      const dayRow = dayResult.rows[0];

      const stops = [];
      for (let i = 0; i < day.stops.length; i += 1) {
        const stop = day.stops[i];
        const poiId = await upsertPoi(client, stop);
        const stopResult = await client.query(
          `INSERT INTO itinerary_stops
             (itinerary_day_id, poi_id, sequence_order, estimated_arrival,
              estimated_duration_minutes, travel_minutes_from_prev)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [
            dayRow.id,
            poiId,
            i + 1,
            stop.estimated_arrival,
            stop.estimated_duration_minutes,
            stop.travel_minutes_from_prev,
          ]
        );
        stops.push({
          ...stopResult.rows[0],
          poi: {
            name: stop.name,
            category: stop.category,
            lat: stop.lat,
            lng: stop.lng,
            rating: stop.rating,
            price_level: stop.price_level,
            outdoor: stop.outdoor,
          },
          score: stop.score,
        });
      }

      days.push({ ...dayRow, precip_probability: day.precip_probability, stops });
    }

    await client.query('COMMIT');
    return { ...itinerary, destination: generated.destination, days };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Loads a persisted itinerary (with days + stops + POI details) by id, scoped to the owning user. */
async function loadItinerary(itineraryId, userId) {
  const itinResult = await db.query(
    `SELECT i.* FROM itineraries i
     JOIN trips t ON t.id = i.trip_id
     WHERE i.id = $1 AND t.user_id = $2`,
    [itineraryId, userId]
  );
  if (itinResult.rows.length === 0) return null;
  const itinerary = itinResult.rows[0];

  const daysResult = await db.query(
    'SELECT * FROM itinerary_days WHERE itinerary_id = $1 ORDER BY day_number',
    [itineraryId]
  );

  const days = [];
  for (const day of daysResult.rows) {
    const stopsResult = await db.query(
      `SELECT s.*, p.name, p.category, p.lat, p.lng, p.rating, p.price_level, p.outdoor
       FROM itinerary_stops s
       JOIN points_of_interest p ON p.id = s.poi_id
       WHERE s.itinerary_day_id = $1
       ORDER BY s.sequence_order`,
      [day.id]
    );
    days.push({
      ...day,
      stops: stopsResult.rows.map((row) => ({
        id: row.id,
        sequence_order: row.sequence_order,
        estimated_arrival: row.estimated_arrival,
        estimated_duration_minutes: row.estimated_duration_minutes,
        travel_minutes_from_prev: row.travel_minutes_from_prev,
        poi: {
          name: row.name,
          category: row.category,
          lat: row.lat,
          lng: row.lng,
          rating: row.rating,
          price_level: row.price_level,
          outdoor: row.outdoor,
        },
      })),
    });
  }

  return { ...itinerary, days };
}

module.exports = { persistItinerary, loadItinerary };
