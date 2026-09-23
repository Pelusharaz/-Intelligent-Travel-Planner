const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  expiryToDate,
} = require('../utils/tokens');

const router = express.Router();

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

// POST /api/auth/register  { email, password, full_name } -> user + tokens
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('full_name').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;
      const { email, password, full_name: fullName } = req.body;

      const existing = await db.query('SELECT id FROM users WHERE email = $1', [
        email.toLowerCase(),
      ]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await db.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name, created_at`,
        [email.toLowerCase(), passwordHash, fullName || null]
      );
      const user = result.rows[0];

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      await db.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [user.id, refreshToken, expiryToDate(process.env.JWT_REFRESH_EXPIRES_IN || '7d')]
      );

      return res.status(201).json({ user, accessToken, refreshToken });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/auth/login  { email, password } -> user + tokens
router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res, next) => {
    try {
      if (!handleValidation(req, res)) return;
      const { email, password } = req.body;

      const result = await db.query(
        'SELECT id, email, full_name, password_hash FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      delete user.password_hash;
      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      await db.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [user.id, refreshToken, expiryToDate(process.env.JWT_REFRESH_EXPIRES_IN || '7d')]
      );

      return res.json({ user, accessToken, refreshToken });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/auth/refresh  { refreshToken } -> { accessToken }
router.post('/refresh', [body('refreshToken').notEmpty()], async (req, res, next) => {
  try {
    if (!handleValidation(req, res)) return;
    const { refreshToken } = req.body;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await db.query(
      'SELECT id FROM refresh_tokens WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()',
      [refreshToken]
    );
    if (stored.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token revoked or not recognised' });
    }

    const accessToken = signAccessToken({ id: payload.sub, email: payload.email });
    return res.json({ accessToken });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/logout  { refreshToken } -> revokes it
router.post('/logout', [body('refreshToken').notEmpty()], async (req, res, next) => {
  try {
    if (!handleValidation(req, res)) return;
    await db.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [
      req.body.refreshToken,
    ]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
