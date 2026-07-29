-- Volunteer-held revocation of one org's access (P1 from the T32 ship).
-- See docs/TODOS.md and docs/designs/staff-created-volunteers.md §2.
--
-- HAND-WRITTEN, like every migration in this repo. `prisma migrate dev` cannot
-- run here at all: migration 20260320100000 uses CREATE INDEX CONCURRENTLY,
-- which Postgres refuses inside the transaction Prisma wraps the shadow
-- database in. Apply with `prisma migrate deploy`.
--
-- WHY THIS TABLE EXISTS. `leaveOrgRoster` soft-deleted the OrgVolunteer row and
-- nothing else, but `findOrgVolunteerRelationship` accepts four edge kinds and
-- staff can mint every one of them unilaterally — `addVolunteer` takes an email
-- address and requires no consent. So a volunteer who left could be re-added and
-- re-assigned to a shift in two clicks, restoring the org's access to their
-- profile, their credentials, and `backgroundChecks.initiate` (which accepts
-- staff-supplied SSN and date of birth and makes a paid third-party call). This
-- row is the one piece of state in that relationship staff cannot clear.

-- CreateTable
CREATE TABLE "OrgVolunteerBlock" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgVolunteerBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- A plain compound unique, NOT the partial index OrgVolunteer uses. There is no
-- soft delete on this table, so "at most one block per (org, user)" is the whole
-- rule. That keeps the generated compound-unique input available, so the lift
-- path is one deleteMany on the pair and the create is an upsert — neither needs
-- OrgVolunteer's findFirst-then-create-then-catch-P2002 dance.
CREATE UNIQUE INDEX "OrgVolunteerBlock_orgId_userId_key" ON "OrgVolunteerBlock"("orgId", "userId");

-- CreateIndex
-- Load-bearing TODAY, despite no query keying on userId alone: Postgres does not
-- auto-index the REFERENCING side of a foreign key, so without this a User
-- delete sequentially scans this table to enforce OrgVolunteerBlock_userId_fkey's
-- ON DELETE CASCADE. Do not drop it as unused. (The orgId cascade is already
-- served by the leading column of the compound unique above.)
CREATE INDEX "OrgVolunteerBlock_userId_idx" ON "OrgVolunteerBlock"("userId");

-- AddForeignKey
ALTER TABLE "OrgVolunteerBlock" ADD CONSTRAINT "OrgVolunteerBlock_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgVolunteerBlock" ADD CONSTRAINT "OrgVolunteerBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: volunteers who ALREADY left, under v0.36.0.0's weaker semantics.
--
-- That version shipped `leaveOrgRoster` with no block, so every volunteer who
-- has used the Leave button until now soft-deleted their roster row and revoked
-- nothing — their surviving APPLICATION / SHIFT_SIGNUP edges still satisfy the
-- guard on `credentials.issue` and `backgroundChecks.initiate`. Without this
-- they stay unprotected forever, because only a NEW leave writes a block and
-- their row is already gone.
--
-- `AuditLog` is the only record of the departure: `VOLUNTEER_LEFT` is written
-- inside the same transaction as the soft delete, with `orgId` set to the org
-- that lost the volunteer and `actorId` to the volunteer themselves (they are
-- the actor on their own exit). Keyed on `action`, not `entityType` — the
-- entityType there is 'OrgVolunteer', the row's id, not the block's subject.
--
-- The NOT EXISTS is the load-bearing clause. If an org legitimately re-added
-- someone after they left — permitted, and openly promised by the old confirm
-- copy ("they can add you again") — that pair has a LIVE roster row today.
-- Blocking it would strand exactly the zombie state this feature exists to
-- prevent: a volunteer visible on the roster whom staff cannot schedule,
-- credential, or background-check, with no explanation in the UI. Those people
-- re-consented; leave them alone.
INSERT INTO "OrgVolunteerBlock" ("id", "orgId", "userId", "createdAt", "updatedAt")
SELECT DISTINCT ON (a."orgId", a."actorId")
       gen_random_uuid()::text, a."orgId", a."actorId", a."createdAt", a."createdAt"
  FROM "AuditLog" a
 WHERE a."action" = 'VOLUNTEER_LEFT'
   AND a."orgId" IS NOT NULL
   AND a."actorId" IS NOT NULL
   AND NOT EXISTS (
         SELECT 1 FROM "OrgVolunteer" ov
          WHERE ov."orgId" = a."orgId"
            AND ov."userId" = a."actorId"
            AND ov."deletedAt" IS NULL
       )
 ORDER BY a."orgId", a."actorId", a."createdAt" DESC
    ON CONFLICT ("orgId", "userId") DO NOTHING;
