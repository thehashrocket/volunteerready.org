-- Step 1: Remove pre-existing duplicate applications before adding the constraint.
-- Keeps the earliest application (by submittedAt) for each (user, opportunity) pair.
-- Only targets non-REJECTED applications with both submittedByUserId and opportunityId set.
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "submittedByUserId", "opportunityId"
           ORDER BY "submittedAt" ASC
         ) AS rn
  FROM "VolunteerApplication"
  WHERE "submittedByUserId" IS NOT NULL
    AND "opportunityId" IS NOT NULL
    AND "status" != 'REJECTED'
)
DELETE FROM "VolunteerApplication"
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Partial unique index to prevent future duplicates.
-- Only applies when both submittedByUserId and opportunityId are non-null
-- and the application is not REJECTED (rejected volunteers can re-apply).
CREATE UNIQUE INDEX "VolunteerApplication_userId_opportunityId_active"
  ON "VolunteerApplication" ("submittedByUserId", "opportunityId")
  WHERE "submittedByUserId" IS NOT NULL
    AND "opportunityId" IS NOT NULL
    AND "status" != 'REJECTED';
