import type { PrismaClient } from '@/prisma/generated/client';

export function orgRepo(prisma: PrismaClient) {
	return {
		async userIsMemberOfOrg(userId: string, orgId: string) {
			const membership = await prisma.organizationMember.findUnique({
				where: { organizationId_userId: { organizationId: orgId, userId } },
				select: { role: true },
			});
			return membership; // null if not member
		},

		async getFirstOrgForUser(userId: string) {
			const m = await prisma.organizationMember.findFirst({
				where: { userId },
				orderBy: { createdAt: 'asc' },
				select: { organizationId: true, role: true },
			});
			return m; // {orgId, role} | null
		},

		async findBySlug(slug: string) {
			return prisma.organization.findUnique({
				where: { slug },
				select: { id: true, slug: true },
			});
		},

		async createOrgWithOwner(input: {
			name: string;
			slug: string;
			userId: string;
		}) {
			return prisma.$transaction(async (tx) => {
				const org = await tx.organization.create({
					data: { name: input.name, slug: input.slug },
					select: { id: true, name: true, slug: true },
				});

				await tx.organizationMember.create({
					data: {
						organizationId: org.id,
						userId: input.userId,
						role: 'OWNER',
					},
				});

				return org;
			});
		},
	};
}
