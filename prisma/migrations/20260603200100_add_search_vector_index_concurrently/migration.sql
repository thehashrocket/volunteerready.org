-- GIN index for VolunteerOpportunity.searchVector (full-text search).
--
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- Prisma wraps migrations in transactions by default, so this migration
-- must be applied manually outside of `prisma migrate deploy`.
--
-- On a fresh database (CI, local dev, new environments) this index does not
-- exist yet. Run prisma migrate deploy normally — Prisma will record this
-- migration as applied in _prisma_migrations, then run the SQL below which
-- will fail because CONCURRENTLY can't run in a transaction. Instead:
--
--   Option A (production, existing data):
--     psql $DATABASE_URL -c 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "VolunteerOpportunity_searchVector_idx" ON "VolunteerOpportunity" USING GIN ("searchVector");'
--     Then mark this migration as applied: prisma migrate resolve --applied 20260603200100_add_search_vector_index_concurrently
--
--   Option B (fresh database / CI with no live traffic):
--     Run prisma migrate deploy as normal. The non-CONCURRENT CREATE INDEX
--     in this file is acceptable when the table has no concurrent readers
--     (e.g. test environment, empty production DB on first deploy).
--
-- The IF NOT EXISTS guard makes this file idempotent either way.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "VolunteerOpportunity_searchVector_idx"
  ON "VolunteerOpportunity" USING GIN ("searchVector");
