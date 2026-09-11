/**
 * authMiddleware.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Protects routes by requiring a valid JWT access token. authService
 *   is the only service that ISSUES tokens (on login/register); every
 *   other service just VERIFIES the token that arrives in the request.
 *   Because JWTs are self-contained and signed with a shared secret
 *   (JWT_ACCESS_SECRET, identical across all services via each
 *   service's .env), no service has to call authService over the
 *   network just to check "is this user logged in?" -- verification is
 *   instant and local. This is a standard microservices auth pattern.
 *
 * WHAT IT ATTACHES
 *   On success, `req.user = { id, email, name }` is attached so every
 *   downstream controller can filter data by the logged-in user
 *   (multi-tenant safety: a user can only ever see/edit THEIR OWN
 *   leads/clients/projects/etc, enforced by using req.user.id in every
 *   WHERE clause).
 */

const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization; // expected: "Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: decoded.sub, email: decoded.email, name: decoded.name };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid access token.' });
  }
}

module.exports = { verifyToken };
