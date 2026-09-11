/**
 * db.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Creates ONE shared Postgres connection pool for this service and
 *   exports a single `query()` helper that every controller uses.
 *
 * WHY A "POOL" AND NOT A SINGLE CONNECTION
 *   Opening a fresh TCP connection to Postgres for every HTTP request
 *   would be slow and would exhaust Postgres's max_connections limit
 *   under load. A pool keeps a small set of connections open and reuses
 *   them across requests -- the standard pattern for any Node + Postgres
 *   service.
 *
 * WHY WE EXPORT A query() WRAPPER INSTEAD OF THE RAW POOL
 *   It gives us one place to (a) log slow queries in development and
 *   (b) swap the underlying driver later without touching every
 *   controller file.
 */

const { Pool, types } = require('pg');

// Postgres DATE columns (start_date, end_date, payment_date,
// meeting_date, issue_date, due_date...) are parsed by node-postgres
// into JS Date objects by default, which then serialize to a full ISO
// *datetime* string (e.g. "2026-09-08T00:00:00.000Z") when Express
// sends them as JSON -- not the plain "YYYY-MM-DD" string every date
// picker and calendar in the frontend expects. That mismatch is what
// causes things like the Tasks edit form's calendar showing "NaN"
// instead of day numbers. Overriding the type parser for OID 1082
// (Postgres's `date` type) to just return the raw string Postgres
// already sends fixes this at the source, for every query this
// service ever runs.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'Brew_Minds',
  password: process.env.DB_PASSWORD || 'Macha@2003',
  database: process.env.DB_NAME || 'Brew_Minds_db',
  // Caps how many simultaneous connections THIS service can open. With
  // many microservices sharing one Postgres instance, keeping each
  // service's pool modest avoids one service starving the others.
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // Fired for errors on IDLE clients in the pool (e.g. network blip).
  // We log and let the pool recover rather than crashing the service.
  console.error('[paymentService] Unexpected Postgres pool error:', err.message);
});

/**
 * Runs a parameterised SQL query.
 * ALWAYS use $1, $2... placeholders (never string-concatenate values
 * into SQL) -- this is what protects every service from SQL injection.
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (process.env.NODE_ENV !== 'production') {
    const duration = Date.now() - start;
    console.log(`[paymentService][sql] ${duration}ms | ${text.split('\n')[0]}`);
  }
  return result;
}

module.exports = { query, pool };
