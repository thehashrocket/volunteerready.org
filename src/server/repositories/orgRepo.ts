import { prisma } from './prisma';

export async function userIsMemberOfOrg(userId: string, orgId: string) {
	const membership = await prisma.organizationMember.findUnique({
		where: { organizationId_userId: { organizationId: orgId, userId } },
		select: { role: true },
	});
	return membership; // null if not member
}

export async function getFirstOrgForUser(userId: string) {
	const m = await prisma.organizationMember.findFirst({
		where: { userId },
		orderBy: { createdAt: 'asc' },
		select: { organizationId: true, role: true },
	});
	return m; // {orgId, role} | null
}

export async function findOrgBySlug(slug: string) {
	return prisma.organization.findUnique({
		where: { slug },
		select: { id: true, slug: true },
	});
}
