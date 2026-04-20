-- Tier 3: Org suspension + FeatureFlag audit columns
-- Adds suspension state to Organization for platform admin freeze.
-- Adds updatedAt/updatedById to FeatureFlag for audit-friendly change tracking.

-- AlterTable: Organization — suspension state
ALTER TABLE "Organization"
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedReason" TEXT,
  ADD COLUMN "suspendedById" TEXT;

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_suspendedById_fkey"
  FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL;

CREATE INDEX "Organization_suspendedAt_idx" ON "Organization"("suspendedAt");

-- AlterTable: FeatureFlag — audit columns
ALTER TABLE "FeatureFlag"
  ADD COLUMN "updatedAt" TIMESTAMP(3),
  ADD COLUMN "updatedById" TEXT;

UPDATE "FeatureFlag" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "FeatureFlag"
  ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "FeatureFlag"
  ADD CONSTRAINT "FeatureFlag_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL;
