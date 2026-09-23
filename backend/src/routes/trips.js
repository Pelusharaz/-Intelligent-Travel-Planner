const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const recommendationEngine = require('../services/recommendationEngine');
const { persistItinerary, loadItinerary } = require('../services/itineraryPersistence');

const router = express.Router();
router.use(requireAuth);

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

async function fetchTripWithPreferences(tripId, userId) {
  const tripResult = await db.query('SELECT * FROM trips WHERE id = $1 AND user_id = $2', [
    tripId,
    userId,
  ]);
  if (tripResult.rows.length === 0) return null;
  const prefsResult = await db.query(
    'SELECT id, interest_tag, weight FROM trip_preferences WHERE trip_id = $1',
    [tripId]
  );
  return { ...tripResult.rows[0], preferences: prefsResult.rows };
}

// POST /api/trips - Create trip + preferences
router.post(
  '/',
  [
    body('destination_name').isString().trim().notEmpty(),
    body('start_date').isISO8601(),
    body('end_date').isISO8601(),
    body('budget_total').optional().isFloat({ min: 0 }),
    body('budget_currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('preferences').isArray({ min: 1 }).withMessage('At least one interest tag is required'),
    body('preferences.*.interest_tag').isString().notEmpty(),
    body('preferences.*.weight').optional().isInt({ min: 1, max: 10 }),
  ],
  async (req, res, next) => {
    const client = await db.getClient();
    try {
      if (!handleValidation(req, res)) return;
      const {
        destination_name: destinationName,
        destination_lat: destinationLat,
        destination_lng: destinationLng,
        start_date: startDate,
        end_date: endDate,
        budget_total: budgetTotal,
        budget_currency: budgetCurrency,
        preferences,
      } = req.body;

      if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ error: 'end_date must be on or after start_date' });
      }

      await client.query('BEGIN');
      const tripResult = await client.query(
        `INSERT INTO trips
           (user_id, destination_name, destination_lat, destination_lng,
            start_date, end_date, budget_total, budget_currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          req.user.id,
          destinationName,
          destinationLat || null,
          destinationLng || null,
          startDate,
          endDate,
          budgetTotal || null,
          budgetCurrency || 'USD',
        ]
      );
      const trip = tripResult.rows[0];

      const insertedPrefs = [];
      for (const pref of preferences) {
        const prefResult = await client.query(
          `INSERT INTO trip_preferences (trip_id, interest_tag, weight)
           VALUES ($1,$2,$3) RETURNING id, interest_tag, weight`,
          [trip.id, pref.interest_tag, pref.weight ?? 5]
        );
        insertedPrefs.push(prefResult.rows[0]);
      }

      await client.query('COMMIT');
      return res.status(201).json({ ...trip, preferences: insertedPrefs });
    } catch (err) {
      await client.query('ROLLBACK');
      return next(err);
    } finally {
      client.release();
    }
  }
);

// GET /api/trips - list current user's trips
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM trips WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    return next(err);
  }
});

// GET /api/trips/:id
router.get('/:id', async (req, res, next) => {
  try {
    const trip = await fetchTripWithPreferences(req.params.id, req.user.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    return res.json(trip);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/trips/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = [
      'destination_name',
      'destination_lat',
      'destination_lng',
      'start_date',
      'end_date',
      'budget_total',
      'budget_currency',
      'status',
    ];
    const updates = Object.keys(req.body).filter((k) => allowed.includes(k));
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const setClause = updates.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
    const values = updates.map((key) => req.body[key]);

    const result = await db.query(
      `UPDATE trips SET ${setClause} WHERE id = $${updates.length + 1} AND user_id = $${
        updates.length + 2
      } RETURNING *`,
      [...values, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/trips/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.user.id,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// GET /api/trips/:id/itinerary - convenience lookup for the latest generated itinerary
router.get('/:id/itinerary', async (req, res, next) => {
  try {
    const trip = await db.query('SELECT id FROM trips WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (trip.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

    const latest = await db.query(
      'SELECT id FROM itineraries WHERE trip_id = $1 ORDER BY version DESC LIMIT 1',
      [req.params.id]
    );
    if (latest.rows.length === 0) {
      return res.status(404).json({ error: 'No itinerary generated for this trip yet' });
    }
    const itinerary = await loadItinerary(latest.rows[0].id, req.user.id);
    return res.json(itinerary);
  } catch (err) {
    return next(err);
  }
});

// POST /api/trips/:id/generate - triggers recommendation engine, persists itinerary
router.post('/:id/generate', async (req, res, next) => {
  try {
    const trip = await fetchTripWithPreferences(req.params.id, req.user.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.preferences.length === 0) {
      return res
        .status(400)
        .json({ error: 'Trip has no interest preferences; add some before generating' });
    }

    const generated = await recommendationEngine.generateItinerary({
      trip,
      preferences: trip.preferences,
    });

    const itinerary = await persistItinerary({ tripId: trip.id, generated });

    await db.query('UPDATE trips SET status = $1 WHERE id = $2', ['generated', trip.id]);
    if (!trip.destination_lat || !trip.destination_lng) {
      await db.query('UPDATE trips SET destination_lat = $1, destination_lng = $2 WHERE id = $3', [
        generated.destination.lat,
        generated.destination.lng,
        trip.id,
      ]);
    }

    return res.status(201).json(itinerary);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
module.exports.fetchTripWithPreferences = fetchTripWithPreferences;
