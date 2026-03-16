-- Phase 6B — Checkr Partner API: per-org OAuth credentials
-- checkrAccessToken: stores the OAuth access token used to call Checkr on behalf of this org
-- checkrAccountId:   Checkr account ID returned at OAuth connect time; used to route webhooks

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "checkrAccessToken" TEXT;
ALTER TABLE "Organization" ADD COLUMN "checkrAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_checkrAccountId_key" ON "Organization"("checkrAccountId");
