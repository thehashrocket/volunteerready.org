-- DropTransaction
-- Reason: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
--
-- Separate migration from 20260727210000 for the same reason as
-- 20260603200100_add_search_vector_index_concurrently: Prisma does NOT wrap a
-- migration file in a transaction (proved by 20260421151557, which combines
-- `ALTER TYPE ... ADD VALUE` with `CREATE INDEX CONCURRENTLY` — both illegal
-- inside a transaction block — and applies cleanly). An earlier version of the
-- previous migration relied on the opposite belief, claiming the `ADD COLUMN`'s
-- ACCESS EXCLUSIVE lock still covered a plain `CREATE INDEX` in the same file.
-- It does not: that lock is released at the end of its own statement, and the
-- plain CREATE INDEX would then take a fresh SHARE lock for the whole index
-- build, blocking every INSERT and UPDATE on "VolunteerApplication" — i.e. every
-- new application and every staff status change — for its duration. PARTIAL does
-- not help; Postgres still scans the heap.

-- Covers the claimable lookup, which is
--   WHERE "submittedByUserId" IS NULL
--     AND "submittedByEmail" = $1
--     AND "declinedAt" IS NULL
--
-- There was NO index on "submittedByEmail" before this, partial or otherwise, so
-- that query — run by any signed-in user on every /app/my-applications load —
-- scanned the whole table. PARTIAL so it covers only unclaimed, undeclined rows,
-- a small and shrinking fraction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "VolunteerApplication_claimable"
  ON "VolunteerApplication" ("submittedByEmail")
  WHERE "submittedByUserId" IS NULL AND "declinedAt" IS NULL;

-- "declinedByUserId" carries ON DELETE SET NULL, so without an index every User
-- deletion sequentially scans "VolunteerApplication" to find referencing rows.
-- User deletion is a real operation here — `pnpm check:email-collisions` exists
-- specifically to report its blast radius. "submittedByUserId" is already
-- indexed; this was the only unindexed FK on the table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "VolunteerApplication_declinedByUserId_idx"
  ON "VolunteerApplication" ("declinedByUserId");

-- Validate the FK added NOT VALID by the previous migration. VALIDATE CONSTRAINT
-- takes only SHARE UPDATE EXCLUSIVE, which does not block reads or writes.
ALTER TABLE "VolunteerApplication"
  VALIDATE CONSTRAINT "VolunteerApplication_declinedByUserId_fkey";
