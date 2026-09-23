const express = require('express');
const { query, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const weatherService = require('../services/weatherService');

const router = express.Router();
router.use(requireAuth);

// GET /api/weather/forecast?lat&lng&dates - thin proxy/cache layer
router.get(
  '/forecast',
  [query('lat').isFloat(), query('lng').isFloat(), query('dates').isString().notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      const { lat, lng, dates } = req.query;
      const dateList = dates.split(',').map((d) => d.trim());
      const forecast = await weatherService.getForecast({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        dates: dateList,
      });
      return res.json(forecast);
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
