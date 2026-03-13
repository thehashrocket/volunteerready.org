-- Migration: skill-catalog
-- Clear free-text skill data that cannot be mapped to canonical IDs
TRUNCATE "VolunteerSkill" CASCADE;
TRUNCATE "OpportunityRequirement" CASCADE;

-- Drop old free-text columns and constraints
ALTER TABLE "VolunteerSkill" DROP COLUMN "skill";
ALTER TABLE "OpportunityRequirement" DROP COLUMN "skill";
DROP INDEX IF EXISTS "OpportunityRequirement_opportunityId_skill_key";
DROP INDEX IF EXISTS "VolunteerSkill_userId_skill_key";

-- Create SkillFamily table
CREATE TABLE "SkillFamily" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillFamily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SkillFamily_name_key" ON "SkillFamily"("name");
CREATE UNIQUE INDEX "SkillFamily_slug_key" ON "SkillFamily"("slug");

-- Create Skill table
CREATE TABLE "Skill" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "familyId"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");
CREATE INDEX "Skill_familyId_idx" ON "Skill"("familyId");
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "SkillFamily"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update VolunteerSkill: add skillId FK
ALTER TABLE "VolunteerSkill" ADD COLUMN "skillId" TEXT NOT NULL;
CREATE UNIQUE INDEX "VolunteerSkill_userId_skillId_key" ON "VolunteerSkill"("userId", "skillId");
ALTER TABLE "VolunteerSkill" ADD CONSTRAINT "VolunteerSkill_skillId_fkey"
    FOREIGN KEY ("skillId") REFERENCES "Skill"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update OpportunityRequirement: add skillId + familyId FKs
ALTER TABLE "OpportunityRequirement" ADD COLUMN "skillId"  TEXT;
ALTER TABLE "OpportunityRequirement" ADD COLUMN "familyId" TEXT;
CREATE INDEX "OpportunityRequirement_skillId_idx"  ON "OpportunityRequirement"("skillId");
CREATE INDEX "OpportunityRequirement_familyId_idx" ON "OpportunityRequirement"("familyId");

-- Partial unique indexes (nullable FKs — standard @@unique won't work)
CREATE UNIQUE INDEX "OpportunityRequirement_opp_skill_key"
    ON "OpportunityRequirement"("opportunityId", "skillId")
    WHERE "skillId" IS NOT NULL;
CREATE UNIQUE INDEX "OpportunityRequirement_opp_family_key"
    ON "OpportunityRequirement"("opportunityId", "familyId")
    WHERE "familyId" IS NOT NULL;

ALTER TABLE "OpportunityRequirement" ADD CONSTRAINT "OpportunityRequirement_skillId_fkey"
    FOREIGN KEY ("skillId") REFERENCES "Skill"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityRequirement" ADD CONSTRAINT "OpportunityRequirement_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "SkillFamily"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
