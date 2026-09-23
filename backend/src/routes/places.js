const express = require('express');
const { query, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const placesService = require('../services/placesService');

const router = express.Router();
router.use(requireAuth);

// GET /api/places/search?lat&lng&category - thin proxy/cache layer, keeps API keys server-side
router.get(
  '/search',
  [
    query('lat').isFloat(),
    query('lng').isFloat(),
    query('category').isString().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      const { lat, lng, category } = req.query;
      const results = await placesService.searchPlaces({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        category,
      });
      return res.json(results);
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
