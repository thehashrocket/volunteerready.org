-- AlterTable
ALTER TABLE "VolunteerApplication" ADD COLUMN     "submittedByUserId" TEXT,
ALTER COLUMN "screeningStatus" SET DEFAULT 'REVIEW',
ALTER COLUMN "screeningReasons" SET DEFAULT '[]';

-- CreateIndex
CREATE INDEX "VolunteerApplication_submittedByUserId_idx" ON "VolunteerApplication"("submittedByUserId");

-- AddForeignKey
ALTER TABLE "VolunteerApplication" ADD CONSTRAINT "VolunteerApplication_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
