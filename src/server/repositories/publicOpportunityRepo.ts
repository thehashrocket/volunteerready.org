import { OpportunityStatus } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

export async function listPublishedOpportunities(orgSlug: string) {
	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true, name: true, slug: true },
	});

	if (!org) return null;

	const opportunities = await prisma.volunteerOpportunity.findMany({
		where: { orgId: org.id, status: OpportunityStatus.PUBLISHED },
		select: {
			id: true,
			title: true,
			description: true,
			location: true,
			isRemote: true,
			startDate: true,
			endDate: true,
			commitmentHours: true,
			capacity: true,
			tags: { select: { id: true, name: true } },
		},
		orderBy: { createdAt: 'desc' },
	});

	return { org, opportunities };
}
