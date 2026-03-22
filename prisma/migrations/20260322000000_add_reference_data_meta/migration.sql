-- CreateTable
CREATE TABLE "ReferenceDataMeta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceDataMeta_pkey" PRIMARY KEY ("key")
);
