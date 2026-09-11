/**
 * server.js  (authService)
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Boots the Express app for authService and wires up global
 *   middleware. Every backend service in this project follows this
 *   same shape (helmet -> cors -> json parsing -> logging -> routes ->
 *   404 -> error handler) so any developer who understands one service
 *   immediately understands them all.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./src/routes/authRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5001;

// --- Security headers ------------------------------------------------
// helmet sets a collection of HTTP headers (X-Content-Type-Options,
// X-Frame-Options, etc.) that protect against common attacks like
// clickjacking and MIME-sniffing, with zero configuration needed.
app.use(helmet());

// --- CORS --------------------------------------------------------------
// Only the frontend's own origin is allowed to call this API with
// credentials -- prevents arbitrary websites from making authenticated
// requests to our API on a logged-in user's behalf.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// --- Body parsing --------------------------------------------------------
app.use(express.json({ limit: '1mb' }));

// --- Request logging (development only) ---------------------------------
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// --- Health check ---------------------------------------------------------
// Used by Docker/Kubernetes (later) and by developers to quickly confirm
// the service is up.
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'authService' }));

// --- Routes --------------------------------------------------------------
app.use('/api/auth', authRoutes);

// --- 404 + centralised error handler (always mounted LAST) --------------
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[authService] listening on port ${PORT}`);
});
