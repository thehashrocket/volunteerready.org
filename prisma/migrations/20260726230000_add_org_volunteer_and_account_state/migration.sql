-- Staff-Created Volunteers, v1a schema (T2).
-- See docs/designs/staff-created-volunteers.md
--
-- HAND-WRITTEN. Do not regenerate this file with `prisma migrate diff`.
-- The generated diff for this change also emitted three statements that must
-- NOT ship:
--   * DROP INDEX "VolunteerOpportunity_searchVector_idx" — the GIN full-text
--     index built CONCURRENTLY in 20260603200100. It is raw SQL that
--     schema.prisma cannot represent, so every diff wants to drop it. Doing so
--     silently degrades marketplace search.
--   * DROP/ADD FOREIGN KEY churn on Organization_suspendedById_fkey and
--     FeatureFlag_updatedById_fkey — identical definitions, pure noise.
--
-- Note also that `prisma migrate dev` cannot run in this repo at all: migration
-- 20260320100000 uses CREATE INDEX CONCURRENTLY, which Postgres refuses inside
-- the transaction Prisma wraps the shadow database in. Apply with
-- `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "AccountState" AS ENUM ('ACTIVE', 'UNCLAIMED');

-- CreateEnum
CREATE TYPE "OrgVolunteerSource" AS ENUM ('STAFF_ADDED', 'APPLIED');

-- AlterTable
-- Additive and defaulted, so every pre-existing row backfills to ACTIVE with no
-- separate backfill step and no table rewrite lock on a modern Postgres.
ALTER TABLE "User" ADD COLUMN     "accountState" "AccountState" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrgVolunteer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "source" "OrgVolunteerSource" NOT NULL DEFAULT 'STAFF_ADDED',
    "addedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrgVolunteer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgVolunteer_orgId_createdAt_idx" ON "OrgVolunteer"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "OrgVolunteer_userId_idx" ON "OrgVolunteer"("userId");

-- CreateIndex
-- PARTIAL unique index, hand-written because Prisma has no @@unique equivalent.
-- Roster removal is a SOFT delete, so a plain @@unique([orgId, userId]) would
-- raise P2002 forever on re-adding a removed volunteer: Postgres does not know
-- that deletedAt means "gone". Scoping uniqueness to live rows makes re-add work
-- while still rejecting a genuine live duplicate.
--
-- Consequence for callers: Prisma cannot see this index, so the generated
-- compound-unique input does not exist and upsert({ where: { orgId_userId } })
-- and findUnique on the pair DO NOT TYPECHECK. That is by design. Use
-- findFirst({ orgId, userId, deletedAt: null }) then create, catching P2002 —
-- Postgres still raises 23505 on a partial unique index and Prisma still maps
-- it to P2002. Precedent: VolunteerApplication's withdrawn-status index.
--
-- CONCURRENTLY is deliberately omitted: the table is brand new and empty, so
-- there is nothing to lock, and CONCURRENTLY cannot run inside the transaction
-- Prisma wraps a migration in.
CREATE UNIQUE INDEX "OrgVolunteer_orgId_userId_active"
  ON "OrgVolunteer" ("orgId", "userId")
  WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "OrgVolunteer" ADD CONSTRAINT "OrgVolunteer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgVolunteer" ADD CONSTRAINT "OrgVolunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SetNull, not Cascade: if the coordinator who added a volunteer is later
-- deleted, the roster row must survive — it carries the org's own data.
ALTER TABLE "OrgVolunteer" ADD CONSTRAINT "OrgVolunteer_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
