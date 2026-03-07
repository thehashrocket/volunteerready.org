-- AlterTable
ALTER TABLE "VolunteerApplication" ADD COLUMN     "opportunityId" TEXT;

-- CreateIndex
CREATE INDEX "VolunteerApplication_opportunityId_idx" ON "VolunteerApplication"("opportunityId");

-- AddForeignKey
ALTER TABLE "VolunteerApplication" ADD CONSTRAINT "VolunteerApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "VolunteerOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
