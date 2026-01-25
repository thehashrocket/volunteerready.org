/*
  Warnings:

  - Added the required column `updatedAt` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currentOrgId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_currentOrgId_idx" ON "Session"("currentOrgId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_currentOrgId_fkey" FOREIGN KEY ("currentOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
