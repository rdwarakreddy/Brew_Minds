/**
 * tokens.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Centralises how we create the two tokens every logged-in user gets:
 *
 *   ACCESS TOKEN  - short-lived (15 min default). Sent with every API
 *                   request as `Authorization: Bearer <token>`. Because
 *                   it's short-lived, even if it leaks it's only
 *                   dangerous for a short window.
 *
 *   REFRESH TOKEN - long-lived (30 days default). Used ONLY to silently
 *                   obtain a new access token when the old one expires,
 *                   so the user doesn't have to log in again every 15
 *                   minutes. We store a HASH of it in the
 *                   `refresh_tokens` table so we can invalidate it
 *                   server-side (logout) -- a stolen JWT that's merely
 *                   "valid" but not in our table gets rejected.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
}

// We never store the raw refresh token in the database -- only a SHA-256
// hash of it. If the `refresh_tokens` table were ever leaked, the tokens
// inside it would be useless to an attacker (same principle as hashing
// passwords, just with a fast hash since the token itself is already
// high-entropy/random, unlike a human-chosen password).
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { signAccessToken, signRefreshToken, hashToken };
