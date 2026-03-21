-- Phase 12: Concierge Activation Engine

-- New fields on Organization
ALTER TABLE "Organization" ADD COLUMN "onboardingBaseline" JSONB;
ALTER TABLE "Organization" ADD COLUMN "showPoweredBy" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "referralSource" TEXT;

-- OrgFeedbackType enum
CREATE TYPE "OrgFeedbackType" AS ENUM ('DAY_7', 'DAY_30');

-- OrgFeedback table
CREATE TABLE "OrgFeedback" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "OrgFeedbackType" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgFeedback_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "OrgFeedback_orgId_idx" ON "OrgFeedback"("orgId");
CREATE UNIQUE INDEX "OrgFeedback_orgId_type_key" ON "OrgFeedback"("orgId", "type");

-- Foreign key
ALTER TABLE "OrgFeedback" ADD CONSTRAINT "OrgFeedback_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
