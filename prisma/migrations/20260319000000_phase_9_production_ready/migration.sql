-- Phase 9: Production-Ready + Activation
-- All changes are additive (nullable columns, new tables, new indexes)

-- AuditLog: index for status timeline queries
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CredentialShareToken: expiry notification tracking
ALTER TABLE "CredentialShareToken" ADD COLUMN "notifiedAt" TIMESTAMP(3);

-- ShiftSignup: reminder idempotency
ALTER TABLE "ShiftSignup" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- Organization: onboarding + first-volunteer activation
ALTER TABLE "Organization" ADD COLUMN "onboardingProgress" JSONB;
ALTER TABLE "Organization" ADD COLUMN "onboardingDismissedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "firstApplicationReceivedAt" TIMESTAMP(3);

-- Notification: digest delivery tracking
ALTER TABLE "Notification" ADD COLUMN "emailSentAt" TIMESTAMP(3);

-- CronJobRun: cron health dashboard
CREATE TYPE "CronJobStatus" AS ENUM ('SUCCESS', 'FAILURE');

CREATE TABLE "CronJobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "CronJobStatus" NOT NULL,
    "resultSummary" JSONB,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronJobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CronJobRun_jobName_startedAt_idx" ON "CronJobRun"("jobName", "startedAt");

-- UserDigestPreference: per-user digest settings
CREATE TYPE "DigestFrequency" AS ENUM ('OFF', 'DAILY', 'WEEKLY');

CREATE TABLE "UserDigestPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "digestFrequency" "DigestFrequency" NOT NULL DEFAULT 'WEEKLY',
    "lastDigestSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDigestPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDigestPreference_userId_orgId_key" ON "UserDigestPreference"("userId", "orgId");
CREATE INDEX "UserDigestPreference_digestFrequency_lastDigestSentAt_idx" ON "UserDigestPreference"("digestFrequency", "lastDigestSentAt");

ALTER TABLE "UserDigestPreference" ADD CONSTRAINT "UserDigestPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDigestPreference" ADD CONSTRAINT "UserDigestPreference_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BulkImportJob: async CSV import processing
CREATE TYPE "BulkImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "BulkImportJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "status" "BulkImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" JSONB,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulkImportJob_orgId_status_idx" ON "BulkImportJob"("orgId", "status");
CREATE INDEX "BulkImportJob_uploadedById_idx" ON "BulkImportJob"("uploadedById");

ALTER TABLE "BulkImportJob" ADD CONSTRAINT "BulkImportJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BulkImportJob" ADD CONSTRAINT "BulkImportJob_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
