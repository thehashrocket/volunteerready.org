-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('WEEKDAYS', 'WEEKENDS', 'EVENINGS', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'ORGS_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('BACKGROUND_CHECK', 'TRAINING_COMPLETE', 'ID_VERIFIED', 'REFERENCE_CHECK', 'ORIENTATION_COMPLETE');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "VolunteerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "availability" "AvailabilityType" NOT NULL DEFAULT 'FLEXIBLE',
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'ORGS_ONLY',
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "CredentialType" NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerProfile_userId_key" ON "VolunteerProfile"("userId");

-- CreateIndex
CREATE INDEX "VolunteerCredential_userId_idx" ON "VolunteerCredential"("userId");

-- CreateIndex
CREATE INDEX "VolunteerCredential_orgId_idx" ON "VolunteerCredential"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerCredential_userId_orgId_type_key" ON "VolunteerCredential"("userId", "orgId", "type");

-- AddForeignKey
ALTER TABLE "VolunteerProfile" ADD CONSTRAINT "VolunteerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerCredential" ADD CONSTRAINT "VolunteerCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerCredential" ADD CONSTRAINT "VolunteerCredential_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
