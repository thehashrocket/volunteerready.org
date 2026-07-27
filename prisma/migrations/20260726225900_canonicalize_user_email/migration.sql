-- Canonicalize User.email at the database (T1).
-- See docs/designs/staff-created-volunteers.md
--
-- HAND-WRITTEN in full. schema.prisma does NOT change: a trigger and a
-- functional index are both invisible to Prisma, so `migrate diff` generates
-- nothing for this. (It would also try to drop the searchVector GIN index —
-- see the T2 migration's header.)
--
-- WHY THIS IS A PREREQUISITE, NOT A CLEANUP
-- -----------------------------------------
-- `User.email` is `String? @unique` — plain text, no normalization. The
-- unclaimed-email guard looks a user up by lowercased address, so a row stored
-- as `Bob@shelter.org` is never found and the guard FAILS OPEN: unrequested
-- bulk mail goes to a shadow user who never asked for it. `sendEmail` already
-- keys bounce suppression on `to.toLowerCase()` (email.ts:29), so the two
-- halves of the same lookup currently disagree about what an address is.
--
-- WHY A TRIGGER AND NOT SERVICE-LAYER LOWERCASING
-- ----------------------------------------------
-- New auth users are created by the raw `PrismaAdapter` (auth.ts:26), which
-- never passes through a service. Any fix that depends on callers cooperating
-- misses the single biggest write path. A BEFORE trigger covers every writer,
-- including ones nobody has written yet.
--
-- Trade-off accepted: storage is normalized, so an address typed as
-- `Bob@Shelter.org` reads back as `bob@shelter.org`. Prisma does not know the
-- trigger exists, so a create() returns the value you passed while the row
-- holds the normalized one — always re-read if you need the stored form.
--
-- ORDERING IS LOAD-BEARING — DO NOT RENUMBER
-- -----------------------------------------
-- This is timestamped 20260726225900 so it sorts BEFORE
-- 20260726230000_add_org_volunteer_and_account_state. Prisma runs each
-- migration in its own transaction, so if the Step 1 guard RAISEs while a
-- schema migration has already committed, `_prisma_migrations` records THIS
-- one as failed and every later `prisma migrate deploy` aborts with P3009
-- until an operator intervenes. Failing first means failing clean: nothing
-- has been altered, and the fix is to resolve the collisions and redeploy.
--
-- If it does fail mid-deploy, recovery is:
--   pnpm check:email-collisions          # list them, with blast radius
--   <resolve the collisions>
--   pnpm prisma migrate resolve --rolled-back 20260726225900_canonicalize_user_email
--   pnpm prisma migrate deploy
--
-- `scripts/vercel-build.sh` runs the pre-check before `migrate deploy`, so in
-- practice production should never reach the RAISE.

-- ---------------------------------------------------------------------------
-- Step 1: refuse to run if case-only duplicates exist.
--
-- Without this guard the backfill below fails on the existing "User_email_key"
-- unique constraint with a bare 23505 naming a random id, which tells an
-- operator nothing. Fail loudly and point at the tool that explains it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  collision_groups INT;
BEGIN
  SELECT COUNT(*) INTO collision_groups
  FROM (
    SELECT lower(btrim(email))
    FROM "User"
    WHERE email IS NOT NULL
    GROUP BY lower(btrim(email))
    HAVING COUNT(*) > 1
  ) AS dupes;

  IF collision_groups > 0 THEN
    RAISE EXCEPTION
      'Cannot canonicalize User.email: % case-only collision group(s) exist. Run `pnpm check:email-collisions` to list them (with blast radius) and resolve before migrating.',
      collision_groups;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 2: backfill existing rows.
--
-- Runs BEFORE the functional unique index is created — building the index
-- first would fail on any row still holding a mixed-case address.
-- The WHERE clause makes this a no-op for already-clean rows, so it is cheap
-- and safe to re-run.
-- ---------------------------------------------------------------------------
UPDATE "User"
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

-- ---------------------------------------------------------------------------
-- Step 2b: canonicalize every column that is COMPARED against User.email.
--
-- Backfilling User.email alone is silent data loss. These columns hold an
-- address and are matched against a User by EXACT equality, so lowercasing one
-- side and not the other permanently de-links the pair:
--
--   VolunteerApplication.submittedByEmail
--     my-applications.ts `linkApplicationsToUser` and volunteerDashboardService
--     both do `{ submittedByEmail: email, submittedByUserId: null }` with the
--     session address. Miss it and an anonymous application becomes
--     unclaimable forever and vanishes from the volunteer's dashboard — no
--     error, just an empty list.
--   OrganizationInvitation.email / CompanyInvitation.email
--     the "is this person already a member/invited?" guards compare raw input
--     to stored rows; a miss silently issues a duplicate invitation.
--   ApplicationStatusToken.email
--     /apply/status looks a token up by the address the applicant typed.
--
-- All four are NON-UNIQUE (verified against pg_index), so collapsing case
-- cannot raise a constraint violation here.
--
-- DELIBERATELY NOT INCLUDED:
--   EmailBounceStatus.email is UNIQUE, so lowercasing could collide and would
--     need a merge policy. It is also already looked up as `to.toLowerCase()`
--     (email.ts:29), so mixed-case rows are invisible today with or without
--     this migration — normalizing it is a separate improvement, not damage
--     this migration causes.
--   LeadCapture.contactEmail is marketing data, never compared to User.email,
--     and carries a unique on (contactEmail, locationSlug).
--   NotificationPreference.email is a BOOLEAN, not an address.
-- ---------------------------------------------------------------------------
UPDATE "VolunteerApplication"
SET "submittedByEmail" = lower(btrim("submittedByEmail"))
WHERE "submittedByEmail" IS NOT NULL
  AND "submittedByEmail" <> lower(btrim("submittedByEmail"));

UPDATE "OrganizationInvitation"
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

UPDATE "CompanyInvitation"
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

UPDATE "ApplicationStatusToken"
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

-- ---------------------------------------------------------------------------
-- Step 3: normalize on every future write.
--
-- `BEFORE INSERT OR UPDATE OF email` — scoped to the column so ordinary user
-- updates (name, image, accountState) do not pay for the trigger.
-- btrim as well as lower: a trailing space is the other way two rows that are
-- "the same address" fail to match.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_user_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(btrim(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_email_normalize ON "User";
CREATE TRIGGER trg_user_email_normalize
  BEFORE INSERT OR UPDATE OF email
  ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION normalize_user_email();

-- ---------------------------------------------------------------------------
-- Step 4: enforce case-insensitive uniqueness independently of the trigger.
--
-- DELIBERATELY REDUNDANT. With the trigger in place, storage is always
-- lowercase, so the existing "User_email_key" unique already rejects
-- case-variant duplicates. This index is belt-and-braces: if the trigger is
-- ever dropped or disabled, this still refuses the bad row rather than letting
-- a privacy control silently start failing open again. That asymmetry — cheap
-- index vs. silent re-breakage of an opt-in mail guard — is why the duplication
-- is worth its write cost on a table this size.
--
-- CONCURRENTLY is omitted: Prisma wraps migrations in a transaction and
-- Postgres refuses CREATE INDEX CONCURRENTLY inside one. If User is large
-- enough that the lock matters at deploy time, pull this statement into its own
-- migration and run it CONCURRENTLY there — the precedent is
-- 20260603200100_add_search_vector_index_concurrently.
-- ---------------------------------------------------------------------------
-- Expression MUST match the trigger exactly: lower(btrim(...)). With only
-- lower(), '  Bob@x.org ' and 'bob@x.org' produce different index keys, so if
-- the trigger were ever dropped both rows would insert — reintroducing the
-- fail-open guard bug this migration exists to close. An index that normalizes
-- differently from the thing it backstops is not a backstop.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower(btrim(email)))
  WHERE email IS NOT NULL;
