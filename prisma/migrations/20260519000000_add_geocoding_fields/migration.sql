-- CreateEnum
CREATE TYPE "GeocodeStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "VolunteerOpportunity" ADD COLUMN "lat" DOUBLE PRECISION,
ADD COLUMN "lng" DOUBLE PRECISION,
ADD COLUMN "geocodeStatus" "GeocodeStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "VolunteerOpportunity_status_geocodeStatus_idx" ON "VolunteerOpportunity"("status", "geocodeStatus");
