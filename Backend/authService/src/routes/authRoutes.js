/**
 * authRoutes.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Maps HTTP endpoints to their controller functions. Public routes
 *   (register/login/google/refresh) need no token. `/me` routes require
 *   a valid access token, enforced by the verifyToken middleware.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  googleAuth,
  refresh,
  logout,
  me,
  updateMe,
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Rate limit login/register specifically to slow down brute-force /
// credential-stuffing attacks, without limiting the rest of the API.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

router.post('/register', authRateLimiter, asyncHandler(register));
router.post('/login', authRateLimiter, asyncHandler(login));
router.post('/google', authRateLimiter, asyncHandler(googleAuth));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));

router.get('/me', verifyToken, asyncHandler(me));
router.patch('/me', verifyToken, asyncHandler(updateMe));

module.exports = router;
