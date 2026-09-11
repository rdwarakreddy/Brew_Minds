/**
 * migrate.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   A tiny, dependency-light migration runner. It looks at every .sql
 *   file in this folder, checks a `schema_migrations` tracking table to
 *   see which ones have already been applied, and runs the ones that
 *   haven't -- in filename order (001_, 002_, 003_...).
 *
 * WHY WE BUILT OUR OWN INSTEAD OF A BIG LIBRARY
 *   For a project this size, a 60-line script that we fully understand
 *   and can debug is more valuable than a heavyweight migration
 *   framework. It does exactly one job: apply new .sql files exactly
 *   once, in order, inside a transaction.
 *
 * WHY THIS IS SAFE TO RUN ANY TIME, FROM ANY STARTING DATABASE STATE
 *   Every .sql file in this folder is written to be idempotent -- every
 *   CREATE TABLE / CREATE INDEX / ADD COLUMN / CREATE TYPE uses an
 *   "IF NOT EXISTS" (or equivalent) guard. That means running a file a
 *   second time, or against a database that already has some (but not
 *   all) of its changes applied by hand or by Docker's init step, is
 *   always a safe no-op for the parts that already exist. This is what
 *   makes it safe to run `node migrate.js` automatically on every
 *   startup (see Backend/package.json's "dev" script) instead of
 *   relying on every developer remembering to run it by hand after
 *   pulling an update -- forgetting that step is exactly what produces
 *   errors like "column X does not exist" at runtime.
 *
 * USAGE
 *   node migrate.js            # apply all pending migrations (safe to run repeatedly)
 *   node migrate.js --baseline # mark all EXISTING .sql files as already
 *                               # applied without running them. Rarely
 *                               # needed now that every file is
 *                               # idempotent, but still available if
 *                               # you want the schema_migrations log to
 *                               # reflect "these were already here" for
 *                               # bookkeeping purposes.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Picks up DB_* overrides from Database/.env (the same file used by
// docker-compose.yml) if the person copied it from .env.example, so a
// customized username/password/db name is respected automatically
// instead of only working with the hardcoded defaults below.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Connection details come from environment variables so the same script
// works locally, in CI, and in production without code changes.
const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'Brew_Minds',
  password: process.env.DB_PASSWORD || 'Macha@2003',
  database: process.env.DB_NAME || 'Brew_Minds_db',
});

async function ensureTrackingTable() {
  // This table remembers which migration files have already run so we
  // never accidentally run "CREATE TABLE users" a second time.
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations() {
  const result = await client.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r) => r.filename));
}

async function getMigrationFiles() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // relies on the numeric filename prefix for ordering
}

async function connectWithRetry(maxAttempts = 15, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.connect();
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(
        `[migrate] Postgres not ready yet (attempt ${attempt}/${maxAttempts}: ${err.message}). Retrying in ${delayMs / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function run() {
  const isBaseline = process.argv.includes('--baseline');

  // Postgres (especially a Docker container that was just started by the
  // same `npm run dev` invocation) can take a few seconds to accept
  // connections -- retry instead of crashing the whole dev startup on a
  // benign race condition.
  await connectWithRetry();
  await ensureTrackingTable();

  const applied = await getAppliedMigrations();
  const files = await getMigrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('No pending migrations. Database is up to date.');
    await client.end();
    return;
  }

  for (const file of pending) {
    if (isBaseline) {
      // Just record it as applied, don't actually run the SQL again.
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      console.log(`Baselined: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    console.log(`Applying: ${file}`);

    // Run each migration inside its own transaction so a failure halfway
    // through a file doesn't leave the schema in a half-migrated state.
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  -> success`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  -> FAILED: ${err.message}`);
      process.exit(1);
    }
  }

  await client.end();
  console.log('All migrations applied.');
}

run().catch((err) => {
  console.error('Migration runner crashed:', err);
  process.exit(1);
});
