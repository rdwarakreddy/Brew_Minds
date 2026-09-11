/**
 * ensureSchema.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   invoiceService's `invoices` table needs a handful of template
 *   columns (subject, bill-to address, notes, terms, logo/signature
 *   images) beyond the base schema. This makes sure they exist every
 *   time the service starts, independently of whatever migration
 *   tooling did or didn't run against the database -- every statement
 *   uses IF NOT EXISTS, so running it again on a database that already
 *   has these columns is a harmless no-op.
 *
 *   This is what stops 'column "subject" of relation "invoices" does
 *   not exist' from ever happening again for this service, even if it's
 *   deployed/copied on its own without the rest of the repo's migration
 *   step.
 */

const { query } = require('./db');

async function ensureSchema() {
  await query(`
    ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS subject           TEXT,
        ADD COLUMN IF NOT EXISTS bill_to_address   TEXT,
        ADD COLUMN IF NOT EXISTS notes             TEXT,
        ADD COLUMN IF NOT EXISTS terms             TEXT,
        ADD COLUMN IF NOT EXISTS logo_data_url     TEXT,
        ADD COLUMN IF NOT EXISTS signature_data_url TEXT,
        ADD COLUMN IF NOT EXISTS signature_name    VARCHAR(150);
  `);
}

module.exports = { ensureSchema };
