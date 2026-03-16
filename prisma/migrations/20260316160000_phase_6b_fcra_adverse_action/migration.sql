-- Phase 6B: FCRA Adverse Action workflow
-- Adds FCRA status tracking to BackgroundCheckRequest for
-- pre-adverse and adverse action notice compliance.

-- CreateEnum
CREATE TYPE "FcraStatus" AS ENUM ('NONE', 'PRE_ADVERSE_SENT', 'ADVERSE_ACTION_SENT', 'RESOLVED');

-- AlterTable
ALTER TABLE "BackgroundCheckRequest" ADD COLUMN "fcraStatus" "FcraStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "BackgroundCheckRequest" ADD COLUMN "preAdverseNoticeSentAt" TIMESTAMP(3);
ALTER TABLE "BackgroundCheckRequest" ADD COLUMN "adverseActionAt" TIMESTAMP(3);
