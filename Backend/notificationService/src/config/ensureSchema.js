/**
 * ensureSchema.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   notificationService's background reminder scanner reads the
 *   `meetings` table directly (see src/jobs/reminderScanner.js), which
 *   needs a `status` column (scheduled/completed/cancelled) beyond the
 *   base schema. This makes sure it (and the related lead_id /
 *   duration_minutes columns owned by meetingService) exist every time
 *   this service starts, independently of whatever migration tooling
 *   did or didn't run against the database -- every statement uses an
 *   IF NOT EXISTS-equivalent guard, so running it again on a database
 *   that already has these is a harmless no-op.
 */

const { query } = require('./db');

async function ensureSchema() {
  await query(`
    DO $$ BEGIN
        CREATE TYPE meeting_status AS ENUM ('scheduled', 'completed', 'cancelled');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;`);
  await query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status meeting_status NOT NULL DEFAULT 'scheduled';`);
  await query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30;`);
  await query(`CREATE INDEX IF NOT EXISTS idx_meetings_lead_id ON meetings(lead_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);`);
}

module.exports = { ensureSchema };
