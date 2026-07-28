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
--
-- Indexes live in the next migration, which needs CONCURRENTLY. See its header.

ALTER TABLE "VolunteerApplication"
  ADD COLUMN "declinedByUserId" TEXT,
  ADD COLUMN "declinedAt" TIMESTAMP(3);

-- NOT VALID: adding a validated FK takes ACCESS EXCLUSIVE on
-- "VolunteerApplication" and SHARE ROW EXCLUSIVE on "User" for a full
-- RI_Initial_Check scan. Every existing row has a NULL "declinedByUserId", which
-- trivially satisfies the constraint, but all-NULL does NOT exempt the table from
-- that scan. NOT VALID skips it and still enforces the constraint on every
-- subsequent INSERT and UPDATE, which is all this column will ever see. The
-- next migration validates it under a lock that does not block writes.
ALTER TABLE "VolunteerApplication"
  ADD CONSTRAINT "VolunteerApplication_declinedByUserId_fkey"
  FOREIGN KEY ("declinedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;
