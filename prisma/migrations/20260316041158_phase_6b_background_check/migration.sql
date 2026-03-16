-- CreateEnum
CREATE TYPE "BackgroundCheckProvider" AS ENUM ('CHECKR', 'STERLING');

-- CreateEnum
CREATE TYPE "BackgroundCheckStatus" AS ENUM ('PENDING', 'COMPLETE', 'CONSIDER', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BackgroundCheckRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BackgroundCheckProvider" NOT NULL DEFAULT 'CHECKR',
    "externalId" TEXT NOT NULL,
    "status" "BackgroundCheckStatus" NOT NULL DEFAULT 'PENDING',
    "webhookPayload" JSONB,
    "credentialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundCheckRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckrWebhookEvent" (
    "id" TEXT NOT NULL,
    "checkrId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "CheckrWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundCheckRequest_externalId_key" ON "BackgroundCheckRequest"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundCheckRequest_credentialId_key" ON "BackgroundCheckRequest"("credentialId");

-- CreateIndex
CREATE INDEX "BackgroundCheckRequest_orgId_idx" ON "BackgroundCheckRequest"("orgId");

-- CreateIndex
CREATE INDEX "BackgroundCheckRequest_userId_idx" ON "BackgroundCheckRequest"("userId");

-- CreateIndex
CREATE INDEX "BackgroundCheckRequest_orgId_status_idx" ON "BackgroundCheckRequest"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CheckrWebhookEvent_checkrId_key" ON "CheckrWebhookEvent"("checkrId");

-- AddForeignKey
ALTER TABLE "BackgroundCheckRequest" ADD CONSTRAINT "BackgroundCheckRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundCheckRequest" ADD CONSTRAINT "BackgroundCheckRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundCheckRequest" ADD CONSTRAINT "BackgroundCheckRequest_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "VolunteerCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
