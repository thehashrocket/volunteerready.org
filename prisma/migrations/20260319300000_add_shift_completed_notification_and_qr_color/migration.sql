-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SHIFT_COMPLETED';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "qrForegroundColor" TEXT;
