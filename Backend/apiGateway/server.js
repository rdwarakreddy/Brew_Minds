/**
 * server.js  (apiGateway)
 * ---------------------------------------------------------------------
 * PURPOSE
 *   The single entrypoint the React frontend talks to
 *   (http://localhost:5000). Incoming requests are matched by their
 *   URL prefix (/api/auth, /api/leads, /api/clients...) and transparently
 *   forwarded ("proxied") to the correct downstream microservice, which
 *   may be running on a completely different port/host.
 *
 * WHY A GATEWAY INSTEAD OF THE FRONTEND CALLING EACH SERVICE DIRECTLY
 *   - One base URL and one CORS policy for the frontend to configure,
 *     instead of eleven.
 *   - Services can be moved, renamed, split, merged, or scaled behind
 *     Kubernetes later without the frontend ever noticing.
 *   - Centralised place to add cross-cutting concerns later
 *     (global rate limiting, request logging, auth pre-checks, etc.)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const proxy = require('express-http-proxy');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// A generous, global rate limit as a baseline defence-in-depth measure;
// authService additionally applies a much stricter limit specifically
// to login/register (see authService/src/routes/authRoutes.js).
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'apiGateway' }));

// ---------------------------------------------------------------------
// Route table: URL prefix -> downstream service base URL.
// express-http-proxy forwards the method, headers (including
// Authorization), body, and query string as-is, and streams the
// downstream response straight back to the client.
// ---------------------------------------------------------------------
const routeTable = [
  { prefix: '/api/auth', target: process.env.AUTH_SERVICE_URL },
  { prefix: '/api/leads', target: process.env.LEAD_SERVICE_URL },
  { prefix: '/api/clients', target: process.env.CLIENT_SERVICE_URL },
  { prefix: '/api/projects', target: process.env.PROJECT_SERVICE_URL },
  { prefix: '/api/payments', target: process.env.PAYMENT_SERVICE_URL },
  { prefix: '/api/meetings', target: process.env.MEETING_SERVICE_URL },
  { prefix: '/api/tasks', target: process.env.TASK_SERVICE_URL },
  { prefix: '/api/documents', target: process.env.DOCUMENT_SERVICE_URL },
  { prefix: '/api/invoices', target: process.env.INVOICE_SERVICE_URL },
  { prefix: '/api/notifications', target: process.env.NOTIFICATION_SERVICE_URL },
  { prefix: '/api/dashboard', target: process.env.DASHBOARD_SERVICE_URL },
];

routeTable.forEach(({ prefix, target }) => {
  app.use(
    prefix,
    proxy(target, {
      // Keep the original path (including the prefix) when forwarding,
      // since every service mounts its routes under the same prefix
      // (e.g. leadService itself listens on /api/leads/...).
      proxyReqPathResolver: (req) => `${prefix}${req.url}`,
      // Multipart file uploads (documentService) need the raw body
      // streamed through untouched rather than parsed/reserialized.
      parseReqBody: !prefix.includes('/documents'),
      timeout: 30000,
    })
  );
});

app.use((req, res) => {
  res.status(404).json({ error: `No service is registered for ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`[apiGateway] listening on port ${PORT}`);
  console.log('[apiGateway] Routing table:');
  routeTable.forEach((r) => console.log(`  ${r.prefix.padEnd(20)} -> ${r.target}`));
});
