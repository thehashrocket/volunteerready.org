-- CreateTable
CREATE TABLE "VolunteerSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerSkill_userId_idx" ON "VolunteerSkill"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerSkill_userId_skill_key" ON "VolunteerSkill"("userId", "skill");

-- AddForeignKey
ALTER TABLE "VolunteerSkill" ADD CONSTRAINT "VolunteerSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
