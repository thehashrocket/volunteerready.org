import { OpportunityStatus } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

const requirementSelect = {
	id: true,
	skillId: true,
	familyId: true,
	level: true,
	skill: { select: { id: true, name: true } },
	family: {
		select: {
			id: true,
			name: true,
			skills: { select: { id: true } },
		},
	},
} as const;

export async function getPublishedOpportunityById(
	orgSlug: string,
	opportunityId: string,
) {
	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true },
	});
	if (!org) return null;

	return prisma.volunteerOpportunity.findFirst({
		where: {
			id: opportunityId,
			orgId: org.id,
			status: OpportunityStatus.PUBLISHED,
		},
		select: {
			id: true,
			title: true,
			location: true,
			isRemote: true,
			startDate: true,
			endDate: true,
			commitmentHours: true,
		},
	});
}

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
			requirements: { select: requirementSelect },
		},
		orderBy: { createdAt: 'desc' },
	});

	return { org, opportunities };
}

/**
 * List ALL published opportunities across every organization.
 * Used by the authenticated volunteer browse page.
 */
export async function listAllPublishedOpportunities() {
	return prisma.volunteerOpportunity.findMany({
		where: { status: OpportunityStatus.PUBLISHED },
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
			requirements: { select: requirementSelect },
			organization: { select: { id: true, name: true, slug: true } },
		},
		orderBy: { createdAt: 'desc' },
	});
}
