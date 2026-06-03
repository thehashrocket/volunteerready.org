-- Phase 11A: Volunteer Marketplace infrastructure

-- AlterTable Organization: marketplace fields
ALTER TABLE "Organization"
  ADD COLUMN "marketplaceVisible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "causeAreaTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum ApplicationSource
CREATE TYPE "ApplicationSource" AS ENUM ('DIRECT', 'MARKETPLACE', 'REFERRAL', 'WIDGET');

-- AlterTable VolunteerApplication: add source tracking
ALTER TABLE "VolunteerApplication"
  ADD COLUMN "source" "ApplicationSource" NOT NULL DEFAULT 'DIRECT';

-- AlterTable VolunteerOpportunity: add tsvector for full-text search
ALTER TABLE "VolunteerOpportunity"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", ''))
  ) STORED;

-- CreateIndex GIN on searchVector
CREATE INDEX "VolunteerOpportunity_searchVector_idx"
  ON "VolunteerOpportunity" USING GIN ("searchVector");

-- CreateTable UserMarketplacePreference
CREATE TABLE "UserMarketplacePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "digestFrequency" "DigestFrequency" NOT NULL DEFAULT 'WEEKLY',
    "lastDigestSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMarketplacePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable OpportunityInterest
CREATE TABLE "OpportunityInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserMarketplacePreference_userId_key" ON "UserMarketplacePreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityInterest_userId_opportunityId_key" ON "OpportunityInterest"("userId", "opportunityId");
CREATE INDEX "OpportunityInterest_userId_idx" ON "OpportunityInterest"("userId");
CREATE INDEX "OpportunityInterest_opportunityId_idx" ON "OpportunityInterest"("opportunityId");

-- AddForeignKey
ALTER TABLE "UserMarketplacePreference" ADD CONSTRAINT "UserMarketplacePreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpportunityInterest" ADD CONSTRAINT "OpportunityInterest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpportunityInterest" ADD CONSTRAINT "OpportunityInterest_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "VolunteerOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
