/**
 * ensureSchema.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   meetingService's `meetings` table needs a `lead_id` link, a
 *   `status` (scheduled/completed/cancelled), and a `duration_minutes`
 *   column beyond the base schema. This makes sure they exist every
 *   time the service starts, independently of whatever migration
 *   tooling did or didn't run against the database -- every statement
 *   uses an IF NOT EXISTS-equivalent guard, so running it again on a
 *   database that already has these is a harmless no-op.
 *
 *   This is what stops 'column "status" does not exist' / 'column
 *   m.lead_id does not exist' from ever happening again for this
 *   service, even if it's deployed/copied on its own without the rest
 *   of the repo's migration step.
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
