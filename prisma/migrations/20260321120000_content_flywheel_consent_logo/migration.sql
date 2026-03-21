-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "consentToPublicize" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "logoUrl" TEXT;
