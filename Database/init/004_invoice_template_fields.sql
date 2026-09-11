-- =====================================================================
-- 004_invoice_template_fields.sql
-- ---------------------------------------------------------------------
-- PURPOSE
--   Extends the invoices table to match the richer invoice template
--   the client provided: a Subject line, a free-text Bill To address
--   (separate from the client's stored address, since invoices are
--   sometimes billed to a different address/department), Notes,
--   Terms & Conditions, and an uploaded logo/signature image.
--
--   Logo and signature images are stored as base64 data URLs directly
--   on the invoice row (simple, self-contained, no separate file
--   storage needed for what are typically small images) rather than in
--   the documentService uploads folder, since they're a structural part
--   of the invoice itself, not a freestanding document.
-- =====================================================================

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS subject           TEXT,
    ADD COLUMN IF NOT EXISTS bill_to_address   TEXT,
    ADD COLUMN IF NOT EXISTS notes             TEXT,
    ADD COLUMN IF NOT EXISTS terms             TEXT,
    ADD COLUMN IF NOT EXISTS logo_data_url     TEXT,
    ADD COLUMN IF NOT EXISTS signature_data_url TEXT,
    ADD COLUMN IF NOT EXISTS signature_name    VARCHAR(150);
