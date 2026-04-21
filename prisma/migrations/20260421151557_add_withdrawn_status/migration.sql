-- DropTransaction
-- Reason: ALTER TYPE ADD VALUE and DROP/CREATE INDEX CONCURRENTLY cannot run inside a transaction.

-- Step 1: Add WITHDRAWN to the ApplicationStatus enum.
ALTER TYPE "ApplicationStatus" ADD VALUE 'WITHDRAWN';

-- Step 2: Drop the existing partial unique index (predicate cannot be altered in place).
DROP INDEX IF EXISTS "VolunteerApplication_userId_opportunityId_active";

-- Step 3: Recreate it excluding both REJECTED and WITHDRAWN so withdrawn volunteers can re-apply.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "VolunteerApplication_userId_opportunityId_active"
  ON "VolunteerApplication" ("submittedByUserId", "opportunityId")
  WHERE "submittedByUserId" IS NOT NULL
    AND "opportunityId" IS NOT NULL
    AND "status" NOT IN ('REJECTED', 'WITHDRAWN');
