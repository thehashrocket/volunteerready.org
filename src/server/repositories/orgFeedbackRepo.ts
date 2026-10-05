import type { OrgFeedbackType, Prisma } from '@/prisma/generated/client';
import { prisma } from './prisma';

/** The org a survey link names by its current slug. */
export function findSurveyOrgBySlug(slug: string) {
	return prisma.organization.findUnique({
		where: { slug },
		select: { id: true, suspendedAt: true },
	});
}

/** Records an org's survey answers, replacing earlier answers to that survey. */
export function upsertOrgFeedbackResponses(
	orgId: string,
	type: OrgFeedbackType,
	responses: Prisma.InputJsonObject,
) {
	return prisma.orgFeedback.upsert({
		where: { orgId_type: { orgId, type } },
		update: { responses },
		create: { orgId, type, responses },
	});
}
