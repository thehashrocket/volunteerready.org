-- CreateTable
CREATE TABLE "ApplicationStatusToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationStatusToken_tokenHash_key" ON "ApplicationStatusToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApplicationStatusToken_email_idx" ON "ApplicationStatusToken"("email");

-- CreateIndex
CREATE INDEX "ApplicationStatusToken_expiresAt_idx" ON "ApplicationStatusToken"("expiresAt");
