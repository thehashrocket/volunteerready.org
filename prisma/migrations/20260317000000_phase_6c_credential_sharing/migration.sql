-- Phase 6C: Portable Credential Sharing
-- Adds CredentialShareToken model, provenance fields on VolunteerCredential,
-- and notifiedAt for future expiry notification support.

-- CreateEnum
CREATE TYPE "ShareTokenStatus" AS ENUM ('ACTIVE', 'CLAIMED', 'EXPIRED');

-- AlterTable: add provenance + notifiedAt to VolunteerCredential
ALTER TABLE "VolunteerCredential" ADD COLUMN "sharedFromOrgId" TEXT;
ALTER TABLE "VolunteerCredential" ADD COLUMN "sharedFromCredentialId" TEXT;
ALTER TABLE "VolunteerCredential" ADD COLUMN "notifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CredentialShareToken" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedByOrgId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "status" "ShareTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CredentialShareToken_tokenHash_key" ON "CredentialShareToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CredentialShareToken_credentialId_idx" ON "CredentialShareToken"("credentialId");

-- CreateIndex
CREATE INDEX "CredentialShareToken_createdByUserId_idx" ON "CredentialShareToken"("createdByUserId");

-- CreateIndex
CREATE INDEX "CredentialShareToken_expiresAt_idx" ON "CredentialShareToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "VolunteerCredential" ADD CONSTRAINT "VolunteerCredential_sharedFromOrgId_fkey" FOREIGN KEY ("sharedFromOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialShareToken" ADD CONSTRAINT "CredentialShareToken_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "VolunteerCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialShareToken" ADD CONSTRAINT "CredentialShareToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialShareToken" ADD CONSTRAINT "CredentialShareToken_claimedByOrgId_fkey" FOREIGN KEY ("claimedByOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
