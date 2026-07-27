import { prisma } from './prisma';

/** Org ids for a user, oldest membership first. */
export async function listMembershipOrgIds(userId: string): Promise<string[]> {
	const memberships = await prisma.organizationMember.findMany({
		where: { userId },
		select: { organizationId: true },
		orderBy: { createdAt: 'asc' },
	});
	return memberships.map((m) => m.organizationId);
}
