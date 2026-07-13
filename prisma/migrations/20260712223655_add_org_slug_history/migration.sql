-- CreateTable
CREATE TABLE "OrgSlugHistory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgSlugHistory_oldSlug_idx" ON "OrgSlugHistory"("oldSlug");

-- CreateIndex
CREATE INDEX "OrgSlugHistory_orgId_idx" ON "OrgSlugHistory"("orgId");

-- AddForeignKey
ALTER TABLE "OrgSlugHistory" ADD CONSTRAINT "OrgSlugHistory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
