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

const { Pool } = require('pg');

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
  console.error('[leadService] Unexpected Postgres pool error:', err.message);
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
    console.log(`[leadService][sql] ${duration}ms | ${text.split('\n')[0]}`);
  }
  return result;
}

module.exports = { query, pool };
