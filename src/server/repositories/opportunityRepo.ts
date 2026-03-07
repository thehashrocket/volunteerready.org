import { OpportunityStatus } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

const opportunitySelect = {
	id: true,
	title: true,
	description: true,
	status: true,
	location: true,
	isRemote: true,
	startDate: true,
	endDate: true,
	commitmentHours: true,
	capacity: true,
	createdAt: true,
	updatedAt: true,
	tags: { select: { id: true, name: true } },
} as const;

export async function listOpportunities(orgId: string) {
	return prisma.volunteerOpportunity.findMany({
		where: { orgId },
		select: opportunitySelect,
		orderBy: { createdAt: 'desc' },
	});
}

export async function getOpportunity(id: string, orgId: string) {
	return prisma.volunteerOpportunity.findFirst({
		where: { id, orgId },
		select: opportunitySelect,
	});
}

export async function createOpportunity(input: {
	orgId: string;
	title: string;
	description: string;
	location?: string | null;
	isRemote: boolean;
	startDate?: Date | null;
	endDate?: Date | null;
	commitmentHours?: number | null;
	capacity?: number | null;
	tags: string[];
}) {
	const { tags, ...data } = input;
	return prisma.volunteerOpportunity.create({
		data: {
			...data,
			tags: { create: tags.map((name) => ({ name })) },
		},
		select: opportunitySelect,
	});
}

export async function updateOpportunity(
	id: string,
	orgId: string,
	input: {
		title?: string;
		description?: string;
		location?: string | null;
		isRemote?: boolean;
		startDate?: Date | null;
		endDate?: Date | null;
		commitmentHours?: number | null;
		capacity?: number | null;
		tags?: string[];
	},
) {
	const { tags, ...data } = input;
	return prisma.volunteerOpportunity.update({
		where: { id, orgId },
		data: {
			...data,
			...(tags !== undefined && {
				tags: {
					deleteMany: {},
					create: tags.map((name) => ({ name })),
				},
			}),
		},
		select: opportunitySelect,
	});
}

export async function updateOpportunityStatus(
	id: string,
	orgId: string,
	status: OpportunityStatus,
) {
	return prisma.volunteerOpportunity.update({
		where: { id, orgId },
		data: { status },
		select: { id: true, status: true },
	});
}

export async function deleteOpportunity(id: string, orgId: string) {
	await prisma.volunteerOpportunity.delete({ where: { id, orgId } });
	return { deleted: true };
}

export async function countOpportunitiesByStatus(orgId: string) {
	const [draft, published, closed] = await Promise.all([
		prisma.volunteerOpportunity.count({ where: { orgId, status: 'DRAFT' } }),
		prisma.volunteerOpportunity.count({ where: { orgId, status: 'PUBLISHED' } }),
		prisma.volunteerOpportunity.count({ where: { orgId, status: 'CLOSED' } }),
	]);
	return { draft, published, closed };
}
