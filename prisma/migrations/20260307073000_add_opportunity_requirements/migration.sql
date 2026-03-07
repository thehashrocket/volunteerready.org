-- CreateEnum
CREATE TYPE "RequirementLevel" AS ENUM ('REQUIRED', 'PREFERRED');

-- CreateTable
CREATE TABLE "OpportunityRequirement" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "level" "RequirementLevel" NOT NULL DEFAULT 'REQUIRED',

    CONSTRAINT "OpportunityRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityRequirement_opportunityId_idx" ON "OpportunityRequirement"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityRequirement_opportunityId_skill_key" ON "OpportunityRequirement"("opportunityId", "skill");

-- AddForeignKey
ALTER TABLE "OpportunityRequirement" ADD CONSTRAINT "OpportunityRequirement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "VolunteerOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
