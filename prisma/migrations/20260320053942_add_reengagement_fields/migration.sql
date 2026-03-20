-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REENGAGEMENT';

-- AlterTable
ALTER TABLE "OrganizationMember" ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "lastReengagementSegment" TEXT;

-- CreateIndex
CREATE INDEX "OrganizationMember_lastActivityAt_idx" ON "OrganizationMember"("lastActivityAt");
