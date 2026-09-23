const jwt = require('jsonwebtoken');

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

/** Converts a JWT expiresIn string like '7d' / '15m' into a JS Date. */
function expiryToDate(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  const now = new Date();
  if (!match) return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return new Date(now.getTime() + value * multipliers[unit]);
}

module.exports = { signAccessToken, signRefreshToken, verifyRefreshToken, expiryToDate };
