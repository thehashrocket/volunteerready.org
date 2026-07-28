-- Decline path for claimable (orphan) volunteer applications.
--
-- `screener.submit` is a publicProcedure accepting an arbitrary
-- `submittedByEmail`, so a third party can plant an application bearing someone
-- else's address. The claim card offers those rows to the address owner for
-- explicit confirmation, but until now the ONLY control was "Add to my account"
-- and the card's dismissal condition was "the claimable list is empty" — a list
-- that shrank only when the user claimed. So in exactly the abuse case the
-- feature exists to stop, the victim saw a permanent, undismissable card whose
-- sole button granted the planting org a relationship edge over them.
--
-- Declining is terminal and per-user. It also frees a slot in the
-- CLAIMABLE_LIST_CAP window that `listClaimableApplicationsByEmail` documents as
-- starvable, which was noted there as needing exactly this.

ALTER TABLE "VolunteerApplication"
  ADD COLUMN "declinedByUserId" TEXT,
  ADD COLUMN "declinedAt" TIMESTAMP(3);

ALTER TABLE "VolunteerApplication"
  ADD CONSTRAINT "VolunteerApplication_declinedByUserId_fkey"
  FOREIGN KEY ("declinedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Covers the claimable lookup, which is
--   WHERE "submittedByUserId" IS NULL
--     AND "submittedByEmail" = $1
--     AND "declinedAt" IS NULL
--
-- There was NO index on "submittedByEmail" before this, partial or otherwise, so
-- that query — reachable by any signed-in user on every /app/my-applications load
-- — scanned the whole table. PARTIAL so it indexes only unclaimed, undeclined
-- rows, which is a small and shrinking fraction of the table.
--
-- Not CONCURRENTLY: the ADD COLUMN statements above already take ACCESS EXCLUSIVE
-- on this table in the same transaction, so there is no lock to avoid, and
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
CREATE INDEX "VolunteerApplication_claimable"
  ON "VolunteerApplication" ("submittedByEmail")
  WHERE "submittedByUserId" IS NULL AND "declinedAt" IS NULL;
