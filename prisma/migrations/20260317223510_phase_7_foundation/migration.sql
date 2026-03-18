-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CredentialType" ADD VALUE 'TENURE_1YR';
ALTER TYPE "CredentialType" ADD VALUE 'TENURE_3YR';
ALTER TYPE "CredentialType" ADD VALUE 'TENURE_5YR';

-- CreateTable
CREATE TABLE "VolunteerInvitation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerInvitation_orgId_sentAt_idx" ON "VolunteerInvitation"("orgId", "sentAt");

-- CreateIndex
CREATE INDEX "VolunteerInvitation_volunteerId_sentAt_idx" ON "VolunteerInvitation"("volunteerId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerInvitation_orgId_volunteerId_opportunityId_key" ON "VolunteerInvitation"("orgId", "volunteerId", "opportunityId");

-- CreateIndex
CREATE INDEX "VolunteerCredential_userId_status_idx" ON "VolunteerCredential"("userId", "status");

-- CreateIndex
CREATE INDEX "VolunteerProfile_visibility_idx" ON "VolunteerProfile"("visibility");

-- CreateIndex
CREATE INDEX "VolunteerProfile_city_state_idx" ON "VolunteerProfile"("city", "state");

-- AddForeignKey
ALTER TABLE "VolunteerInvitation" ADD CONSTRAINT "VolunteerInvitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerInvitation" ADD CONSTRAINT "VolunteerInvitation_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerInvitation" ADD CONSTRAINT "VolunteerInvitation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "VolunteerOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
