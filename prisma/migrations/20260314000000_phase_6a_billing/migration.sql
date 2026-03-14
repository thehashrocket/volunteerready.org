-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'PRO');

-- CreateEnum
CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "CompanyNonprofitLinkStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "currentCompanyId" TEXT;

-- CreateTable
CREATE TABLE "CompanyAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInvitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyNonprofitLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "CompanyNonprofitLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyNonprofitLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAccount_slug_key" ON "CompanyAccount"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAccount_stripeCustomerId_key" ON "CompanyAccount"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAccount_stripeSubscriptionId_key" ON "CompanyAccount"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "CompanyMember_companyId_idx" ON "CompanyMember"("companyId");

-- CreateIndex
CREATE INDEX "CompanyMember_userId_idx" ON "CompanyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_companyId_userId_key" ON "CompanyMember"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvitation_tokenHash_key" ON "CompanyInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "CompanyInvitation_email_idx" ON "CompanyInvitation"("email");

-- CreateIndex
CREATE INDEX "CompanyInvitation_companyId_idx" ON "CompanyInvitation"("companyId");

-- CreateIndex
CREATE INDEX "CompanyInvitation_expiresAt_idx" ON "CompanyInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "CompanyNonprofitLink_companyId_idx" ON "CompanyNonprofitLink"("companyId");

-- CreateIndex
CREATE INDEX "CompanyNonprofitLink_orgId_idx" ON "CompanyNonprofitLink"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyNonprofitLink_companyId_orgId_key" ON "CompanyNonprofitLink"("companyId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeId_key" ON "StripeWebhookEvent"("stripeId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "Organization"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Session_currentCompanyId_idx" ON "Session"("currentCompanyId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_currentCompanyId_fkey" FOREIGN KEY ("currentCompanyId") REFERENCES "CompanyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyNonprofitLink" ADD CONSTRAINT "CompanyNonprofitLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyNonprofitLink" ADD CONSTRAINT "CompanyNonprofitLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
