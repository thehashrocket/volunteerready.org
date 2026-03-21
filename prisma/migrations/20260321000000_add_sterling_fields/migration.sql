-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "sterlingApiKey" TEXT,
ADD COLUMN "sterlingAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_sterlingAccountId_key" ON "Organization"("sterlingAccountId");
