-- DropTransaction
-- Reason: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
--
-- CONCURRENTLY, following 20260727210100 and the ten other precedents in this
-- directory. An earlier draft of this migration used a plain CREATE INDEX on
-- the belief that this repo reserved CONCURRENTLY for one large GIN index.
-- That was wrong: 20260320100000 builds Shift_status_endTime_idx — the same
-- shape as the first index below, equality column plus timestamp on a
-- pre-existing table — with CONCURRENTLY, and 20260727210100 already wrote
-- down why. A plain CREATE INDEX takes a SHARE lock for the whole build,
-- blocking every INSERT and UPDATE on "VolunteerCredential" — staff issuing a
-- credential, the Checkr/Sterling webhooks resolving one, and the nightly
-- expirer's own transaction — and scripts/vercel-build.sh runs migrate deploy
-- while the previous build is still serving.

-- Serves findExpiredCredentials: status = VERIFIED AND "expiresAt" < now.
-- The three pre-existing indexes on this table all lead with "userId", so a
-- table-wide scan by status could not use any of them.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "VolunteerCredential_status_expiresAt_idx"
  ON "VolunteerCredential"("status", "expiresAt");

-- Serves the expiry-notice scan, which additionally filters on the notice
-- cycle. PARTIAL on "notifiedAt" IS NULL because that is the steady-state
-- shape: a credential is stamped once per cycle and then sits inside the
-- 30-day window for the rest of it. Without the partial predicate the scan
-- walks ~30 days of already-stamped rows to find ~1 day of new ones, and the
-- LIMIT cannot terminate early because almost nothing matches. The partial
-- index stays small because rows leave it as soon as they are stamped.
--
-- Renewals re-enter through the non-partial index above rather than this one:
-- a renewed credential has a non-null "notifiedAt" from its previous cycle, so
-- it is excluded here and found by the planner via (status, "expiresAt").
CREATE INDEX CONCURRENTLY IF NOT EXISTS "VolunteerCredential_notice_due_idx"
  ON "VolunteerCredential"("status", "expiresAt")
  WHERE "notifiedAt" IS NULL;
