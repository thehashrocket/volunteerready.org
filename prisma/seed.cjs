const { PrismaClient, Role } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const existingOrg = await prisma.organization.findFirst({
    where: { name: "Dev Organization" },
  });
  const org =
    existingOrg ??
    (await prisma.organization.create({
      data: { name: "Dev Organization" },
    }));

  const user = await prisma.user.upsert({
    where: { email: "admin@volunteeermatch.local" },
    update: { name: "Dev Admin" },
    create: {
      name: "Dev Admin",
      email: "admin@volunteeermatch.local",
      memberships: {
        create: {
          organizationId: org.id,
          role: Role.OWNER,
        },
      },
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: user.id,
      },
    },
    update: { role: Role.OWNER },
    create: {
      organizationId: org.id,
      userId: user.id,
      role: Role.OWNER,
    },
  });

  await prisma.featureFlag.upsert({
    where: {
      orgId_key: {
        orgId: org.id,
        key: "volunteer_screener_v1",
      },
    },
    update: { enabled: true },
    create: {
      orgId: org.id,
      key: "volunteer_screener_v1",
      enabled: true,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
