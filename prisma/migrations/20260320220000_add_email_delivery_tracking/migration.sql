-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED');

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "resendId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "eventType" "EmailEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailBounceStatus" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "suppressedAt" TIMESTAMP(3),
    "lastBouncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailBounceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailEvent_to_eventType_idx" ON "EmailEvent"("to", "eventType");

-- CreateIndex
CREATE INDEX "EmailEvent_resendId_idx" ON "EmailEvent"("resendId");

-- CreateIndex
CREATE INDEX "EmailEvent_createdAt_idx" ON "EmailEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailBounceStatus_email_key" ON "EmailBounceStatus"("email");
