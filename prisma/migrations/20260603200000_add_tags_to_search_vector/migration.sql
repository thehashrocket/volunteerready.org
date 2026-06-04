-- Migration: include tag names in VolunteerOpportunity.searchVector
--
-- The stored generated column can only reference columns on the same row.
-- Tags live in a separate OpportunityTag table, so we:
--  1. Drop the generated column and replace it with a plain nullable tsvector column.
--  2. Backfill the column for all existing rows (title + description + tags).
--  3. Add a trigger that recomputes searchVector on INSERT/UPDATE to VolunteerOpportunity
--     or INSERT/UPDATE/DELETE to OpportunityTag.
--
-- This is the standard Postgres approach when a tsvector must include joined data.
--
-- NOTE: The GIN index is created in a separate migration
-- (20260603200100_add_search_vector_index_concurrently) using CREATE INDEX CONCURRENTLY
-- to avoid an ACCESS EXCLUSIVE table lock during the index build.

-- Step 1: replace the generated column with a plain column
ALTER TABLE "VolunteerOpportunity"
  DROP COLUMN IF EXISTS "searchVector";

ALTER TABLE "VolunteerOpportunity"
  ADD COLUMN "searchVector" tsvector;

-- Step 2: create the trigger function
CREATE OR REPLACE FUNCTION update_opportunity_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  opp_id TEXT;
  tag_text TEXT;
BEGIN
  -- Guard against recursive trigger calls.
  -- The function UPDATEs VolunteerOpportunity, which would re-fire this trigger
  -- when triggered by VolunteerOpportunity itself. pg_trigger_depth() > 1 means
  -- we are already inside a trigger call chain, so skip to avoid infinite recursion.
  IF TG_TABLE_NAME = 'VolunteerOpportunity' AND pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Determine which opportunity row to refresh
  IF TG_TABLE_NAME = 'OpportunityTag' THEN
    IF TG_OP = 'DELETE' THEN
      opp_id := OLD."opportunityId";
    ELSE
      opp_id := NEW."opportunityId";
    END IF;
  ELSE
    -- Triggered from VolunteerOpportunity itself
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    opp_id := NEW.id;
  END IF;

  -- Concatenate all tag names for this opportunity
  SELECT coalesce(string_agg(name, ' '), '')
    INTO tag_text
    FROM "OpportunityTag"
   WHERE "opportunityId" = opp_id;

  -- Update the search vector (title + description + tags)
  UPDATE "VolunteerOpportunity"
     SET "searchVector" = to_tsvector(
           'english',
           coalesce(title, '') || ' ' ||
           coalesce(description, '') || ' ' ||
           tag_text
         )
   WHERE id = opp_id;

  IF TG_TABLE_NAME = 'VolunteerOpportunity' THEN
    RETURN NEW;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;
END;
$$;

-- Step 3: attach trigger to VolunteerOpportunity
-- Fires on ALL updates (not just title/description) so that status changes
-- (e.g. DRAFT -> PUBLISHED) also refresh the vector and make the opportunity
-- discoverable in full-text search immediately.
DROP TRIGGER IF EXISTS trg_opportunity_search_vector ON "VolunteerOpportunity";
CREATE TRIGGER trg_opportunity_search_vector
  AFTER INSERT OR UPDATE
  ON "VolunteerOpportunity"
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_search_vector();

-- Step 4: attach trigger to OpportunityTag (tag add/rename/delete)
DROP TRIGGER IF EXISTS trg_opportunity_tag_search_vector ON "OpportunityTag";
CREATE TRIGGER trg_opportunity_tag_search_vector
  AFTER INSERT OR UPDATE OR DELETE
  ON "OpportunityTag"
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_search_vector();

-- Step 5: backfill all existing rows
UPDATE "VolunteerOpportunity" o
   SET "searchVector" = to_tsvector(
         'english',
         coalesce(o.title, '') || ' ' ||
         coalesce(o.description, '') || ' ' ||
         coalesce((
           SELECT string_agg(t.name, ' ')
             FROM "OpportunityTag" t
            WHERE t."opportunityId" = o.id
         ), '')
       );

-- Step 6: GIN index is created in a separate migration using CONCURRENTLY.
-- See: prisma/migrations/20260603200100_add_search_vector_index_concurrently/migration.sql
