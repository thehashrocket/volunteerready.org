-- Tier 2: Platform Admin Catalog Editor
-- Adds soft-delete (isActive), ordering (order) to SkillFamily/Skill.
-- Adds updatedAt + isTemplate to ScreenerQuestion.

-- AlterTable: SkillFamily
ALTER TABLE "SkillFamily"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Skill
ALTER TABLE "Skill"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: ScreenerQuestion
-- updatedAt: backfill existing rows with createdAt to preserve chronological truth.
ALTER TABLE "ScreenerQuestion"
  ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "ScreenerQuestion" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "ScreenerQuestion"
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SkillFamily_isActive_order_idx" ON "SkillFamily"("isActive", "order");
CREATE INDEX "Skill_isActive_order_idx" ON "Skill"("isActive", "order");
CREATE INDEX "ScreenerQuestion_isTemplate_idx" ON "ScreenerQuestion"("isTemplate");
