import type {
	OpportunityStatus,
	RequirementLevel,
} from '@/prisma/generated/client';
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
	requirements: { select: requirementSelect },
} as const;

export async function listOpportunities(
	orgId: string,
	opts?: { cursor?: string; limit?: number },
) {
	const limit = Math.min(opts?.limit ?? 50, 100);

	const items = await prisma.volunteerOpportunity.findMany({
		where: { orgId },
		select: opportunitySelect,
		orderBy: { createdAt: 'desc' },
		take: limit + 1, // fetch one extra to detect next page
		...(opts?.cursor && {
			cursor: { id: opts.cursor },
			skip: 1, // skip the cursor item itself
		}),
	});

	const hasMore = items.length > limit;
	if (hasMore) items.pop();

	return {
		items,
		nextCursor: hasMore ? items[items.length - 1]?.id : null,
	};
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
	requirements: {
		skillId?: string;
		familyId?: string;
		level: RequirementLevel;
	}[];
}) {
	const { tags, requirements, ...data } = input;
	return prisma.volunteerOpportunity.create({
		data: {
			...data,
			tags: { create: tags.map((name) => ({ name })) },
			requirements: {
				create: requirements.map((r) => ({
					skillId: r.skillId ?? null,
					familyId: r.familyId ?? null,
					level: r.level,
				})),
			},
		},
		select: opportunitySelect,
	});
}

/** Composite key for deduplicating requirements in diff logic. */
function reqKey(r: { skillId?: string | null; familyId?: string | null }) {
	if (r.skillId) return `skill:${r.skillId}`;
	if (r.familyId) return `family:${r.familyId}`;
	return 'unknown';
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
		requirements?: {
			skillId?: string;
			familyId?: string;
			level: RequirementLevel;
		}[];
	},
) {
	const { tags, requirements, ...data } = input;

	return prisma.$transaction(async (tx) => {
		// --- Diff-and-upsert tags ---
		if (tags !== undefined) {
			const existing = await tx.opportunityTag.findMany({
				where: { opportunityId: id },
				select: { id: true, name: true },
			});
			const existingNames = new Set(existing.map((t) => t.name));
			const desiredNames = new Set(tags);

			// Delete removed tags
			const toDelete = existing.filter((t) => !desiredNames.has(t.name));
			if (toDelete.length > 0) {
				await tx.opportunityTag.deleteMany({
					where: { id: { in: toDelete.map((t) => t.id) } },
				});
			}

			// Create new tags
			const toCreate = tags.filter((name) => !existingNames.has(name));
			if (toCreate.length > 0) {
				await tx.opportunityTag.createMany({
					data: toCreate.map((name) => ({ opportunityId: id, name })),
				});
			}
		}

		// --- Diff-and-upsert requirements ---
		if (requirements !== undefined) {
			const existing = await tx.opportunityRequirement.findMany({
				where: { opportunityId: id },
				select: { id: true, skillId: true, familyId: true, level: true },
			});
			const existingByKey = new Map(existing.map((r) => [reqKey(r), r]));
			const desiredKeys = new Set(requirements.map(reqKey));

			// Delete removed requirements
			const toDelete = existing.filter((r) => !desiredKeys.has(reqKey(r)));
			if (toDelete.length > 0) {
				await tx.opportunityRequirement.deleteMany({
					where: { id: { in: toDelete.map((r) => r.id) } },
				});
			}

			// Upsert: update changed levels, create new requirements
			for (const req of requirements) {
				const key = reqKey(req);
				const prev = existingByKey.get(key);
				if (!prev) {
					await tx.opportunityRequirement.create({
						data: {
							opportunityId: id,
							skillId: req.skillId ?? null,
							familyId: req.familyId ?? null,
							level: req.level,
						},
					});
				} else if (prev.level !== req.level) {
					await tx.opportunityRequirement.update({
						where: { id: prev.id },
						data: { level: req.level },
					});
				}
			}
		}

		// --- Update scalar fields ---
		return tx.volunteerOpportunity.update({
			where: { id, orgId },
			data,
			select: opportunitySelect,
		});
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
		prisma.volunteerOpportunity.count({
			where: { orgId, status: 'PUBLISHED' },
		}),
		prisma.volunteerOpportunity.count({ where: { orgId, status: 'CLOSED' } }),
	]);
	return { draft, published, closed };
}
