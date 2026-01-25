-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScreeningStatus" AS ENUM ('PASS', 'REVIEW', 'FAIL');

-- CreateEnum
CREATE TYPE "ScreenerQuestionType" AS ENUM ('TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'BOOLEAN', 'NUMBER');

-- CreateTable
CREATE TABLE "VolunteerApplication" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "submittedByEmail" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "screeningStatus" "ScreeningStatus" NOT NULL,
    "screeningReasons" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerAnswer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerJson" JSONB NOT NULL,

    CONSTRAINT "VolunteerAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenerQuestion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "ScreenerQuestionType" NOT NULL,
    "configJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenerQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerApplication_orgId_status_idx" ON "VolunteerApplication"("orgId", "status");

-- CreateIndex
CREATE INDEX "VolunteerAnswer_applicationId_idx" ON "VolunteerAnswer"("applicationId");

-- CreateIndex
CREATE INDEX "ScreenerQuestion_orgId_isActive_order_idx" ON "ScreenerQuestion"("orgId", "isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenerQuestion_orgId_key_key" ON "ScreenerQuestion"("orgId", "key");

-- AddForeignKey
ALTER TABLE "VolunteerApplication" ADD CONSTRAINT "VolunteerApplication_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAnswer" ADD CONSTRAINT "VolunteerAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "VolunteerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenerQuestion" ADD CONSTRAINT "ScreenerQuestion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
