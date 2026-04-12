-- CreateTable
CREATE TABLE "LeadCapture" (
    "id" TEXT NOT NULL,
    "locationSlug" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "volunteerCount" TEXT,
    "currentProcess" TEXT,
    "painPoints" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LeadCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadCapture_contactEmail_locationSlug_key" ON "LeadCapture"("contactEmail", "locationSlug");

-- CreateIndex
CREATE INDEX "LeadCapture_locationSlug_createdAt_idx" ON "LeadCapture"("locationSlug", "createdAt");

-- CreateIndex
CREATE INDEX "LeadCapture_deletedAt_idx" ON "LeadCapture"("deletedAt");
