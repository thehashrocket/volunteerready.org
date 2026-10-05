-- The platform org's default ScreenerQuestions are templates: signup copies the
-- active templates into each new org. The platform org's questions predate the
-- "isTemplate" column (added with the catalog editor in v0.22.0.0), which defaulted them to false,
-- so production had no templates: new orgs were created with no screener
-- questions, and the boot guard's template insert collided on (orgId, key) on
-- every cold start. Only the default keys (DEFAULT_SCREENER_QUESTIONS) are
-- marked: any other row on the platform org stays as it is rather than being
-- copied into every new org. Idempotent; a database with no platform org
-- updates nothing.
UPDATE "ScreenerQuestion"
SET "isTemplate" = true, "updatedAt" = now()
WHERE "isTemplate" = false
  AND "orgId" IN (SELECT "id" FROM "Organization" WHERE "slug" = 'platform')
  AND "key" IN ('age-18-plus', 'background-check-consent', 'availability', 'prior-experience', 'why-volunteer');
