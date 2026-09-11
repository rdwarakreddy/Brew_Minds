-- =====================================================================
-- 001_extensions.sql
-- ---------------------------------------------------------------------
-- Purpose : Enable Postgres extensions the application relies on.
-- Why     : Every table in this app uses UUID primary keys instead of
--           auto-incrementing integers. UUIDs are safer in a micro-
--           service architecture because multiple services can insert
--           rows independently (offline, in parallel, from different
--           machines) without ever colliding on an ID -- there is no
--           central "next number" counter to coordinate.
-- Note    : Files in /docker-entrypoint-initdb.d run in alphabetical
--           order ONLY the first time the Postgres container starts
--           with an empty data directory. That's why these files are
--           numerically prefixed (001, 002, 003...).
-- =====================================================================

-- gen_random_uuid() -- used everywhere as the default for id columns
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
