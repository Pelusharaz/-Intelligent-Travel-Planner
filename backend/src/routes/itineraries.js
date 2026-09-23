const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { loadItinerary } = require('../services/itineraryPersistence');

const router = express.Router();
router.use(requireAuth);

// GET /api/itineraries/:id - full itinerary with days + stops
router.get('/:id', async (req, res, next) => {
  try {
    const itinerary = await loadItinerary(req.params.id, req.user.id);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
    return res.json(itinerary);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/itineraries/:id/stops/:stopId - manual reorder (drag-to-reorder override)
router.patch(
  '/:id/stops/:stopId',
  [body('sequence_order').isInt({ min: 1 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      // Ownership check: stop -> day -> itinerary -> trip -> user
      const ownership = await db.query(
        `SELECT s.id FROM itinerary_stops s
         JOIN itinerary_days d ON d.id = s.itinerary_day_id
         JOIN itineraries i ON i.id = d.itinerary_id
         JOIN trips t ON t.id = i.trip_id
         WHERE s.id = $1 AND i.id = $2 AND t.user_id = $3`,
        [req.params.stopId, req.params.id, req.user.id]
      );
      if (ownership.rows.length === 0) {
        return res.status(404).json({ error: 'Stop not found' });
      }

      const result = await db.query(
        'UPDATE itinerary_stops SET sequence_order = $1 WHERE id = $2 RETURNING *',
        [req.body.sequence_order, req.params.stopId]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
