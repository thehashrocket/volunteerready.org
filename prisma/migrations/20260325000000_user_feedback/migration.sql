-- CreateEnum
CREATE TYPE "FeedbackMood" AS ENUM ('HAPPY', 'NEUTRAL', 'FRUSTRATED', 'BUG', 'IDEA');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "mood" "FeedbackMood" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "message" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageName" TEXT,
    "userAgent" TEXT,
    "userRole" TEXT,
    "replyMessage" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserFeedback_userId_deletedAt_createdAt_idx" ON "UserFeedback"("userId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "UserFeedback_status_createdAt_idx" ON "UserFeedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserFeedback_orgId_createdAt_idx" ON "UserFeedback"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "UserFeedback_mood_createdAt_idx" ON "UserFeedback"("mood", "createdAt");

-- CreateIndex
CREATE INDEX "UserFeedback_deletedAt_idx" ON "UserFeedback"("deletedAt");

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_repliedBy_fkey" FOREIGN KEY ("repliedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
