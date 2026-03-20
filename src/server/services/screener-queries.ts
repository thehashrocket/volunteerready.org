import type { ApplicationStatus } from '@/prisma/generated/client';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { countOpportunitiesByStatus } from '@/server/repositories/opportunityRepo';
import { prisma } from '@/server/repositories/prisma';
import { getPublicFormByOrgSlug } from '@/server/repositories/publicApplyRepo';
import {
	countApplicationsByStatus,
	getApplicationDetail,
	getRecentApplications,
	getScreenerQuestionsByIds,
	listApplications,
	updateApplicationStatusTx,
} from '@/server/repositories/volunteer-applications';
import {
	formatAnswerValue,
	normalizeAnswerValue,
	normalizeReasons,
} from '@/server/services/my-applications';

export async function listOrgApplications(
	orgId: string,
	input: {
		status?: string;
		page?: number;
		pageSize?: number;
		opportunityId?: string;
	},
) {
	return listApplications(
		orgId,
		input.status as ApplicationStatus | undefined,
		{ page: input.page, pageSize: input.pageSize },
		input.opportunityId,
	);
}

export async function getOrgApplicationDetail(orgId: string, id: string) {
	return getApplicationDetail(orgId, id);
}

export async function getOrgApplicationDetailEnriched(
	orgId: string,
	id: string,
) {
	const application = await getApplicationDetail(orgId, id);
	if (!application) return null;

	const questionIds = application.answers.map((a) => a.questionId);
	const questions = await getScreenerQuestionsByIds(orgId, questionIds);
	const questionMap = new Map(questions.map((q) => [q.id, q]));

	return {
		id: application.id,
		submittedAt: application.submittedAt,
		submittedByEmail: application.submittedByEmail,
		submittedByUserId: application.submittedByUserId,
		status: application.status,
		screeningStatus: application.screeningStatus,
		screeningReasons: normalizeReasons(application.screeningReasons),
		opportunity: application.opportunity,
		answers: application.answers.map((a) => ({
			id: a.id,
			questionId: a.questionId,
			prompt: questionMap.get(a.questionId)?.prompt ?? 'Question removed',
			value: normalizeAnswerValue(a.answerJson),
			displayValue: formatAnswerValue(normalizeAnswerValue(a.answerJson)),
		})),
	};
}

export async function updateOrgApplicationStatus(
	orgId: string,
	id: string,
	status: ApplicationStatus,
	actorId?: string | null,
) {
	return prisma.$transaction(async (tx) => {
		const { updated, previousStatus } = await updateApplicationStatusTx(
			tx,
			orgId,
			id,
			status,
		);

		await writeAuditLogTx(tx, {
			orgId,
			actorId: actorId ?? null,
			action: 'STATUS_CHANGED',
			entityType: 'APPLICATION',
			entityId: id,
			metadata: { from: previousStatus, to: status },
		});

		return updated;
	});
}

export async function getPublicScreenerForm(orgSlug: string) {
	return getPublicFormByOrgSlug(orgSlug);
}

export async function getOrgDashboardStats(orgId: string) {
	const [
		appCounts,
		oppCounts,
		recentApplications,
		screenerQuestionCount,
		shiftsWithSignupsCount,
		credentialsIssuedCount,
	] = await Promise.all([
		countApplicationsByStatus(orgId),
		countOpportunitiesByStatus(orgId),
		getRecentApplications(orgId, 8),
		prisma.screenerQuestion.count({ where: { orgId, isActive: true } }),
		prisma.shift.count({
			where: {
				orgId,
				signups: {
					some: { status: { in: ['CONFIRMED', 'ATTENDED', 'NO_SHOW'] } },
				},
			},
		}),
		prisma.volunteerCredential.count({
			where: { orgId, status: 'VERIFIED' },
		}),
	]);

	return {
		opportunities: {
			draft: oppCounts.draft,
			published: oppCounts.published,
			closed: oppCounts.closed,
			total: oppCounts.draft + oppCounts.published + oppCounts.closed,
		},
		applications: {
			submitted: appCounts.submitted,
			review: appCounts.review,
			approved: appCounts.approved,
			rejected: appCounts.rejected,
			total:
				appCounts.submitted +
				appCounts.review +
				appCounts.approved +
				appCounts.rejected,
		},
		recentApplications,
		health: {
			screenerQuestionCount,
			publishedOpportunityCount: oppCounts.published,
			shiftsWithSignupsCount,
			credentialsIssuedCount,
		},
	};
}

/** Curated action types shown in the admin activity feed. */
const ACTIVITY_FEED_ACTIONS = [
	'volunteer_application.submitted',
	'shift.attendance.attended',
	'CREDENTIAL_ISSUED',
	'shift.completed',
	'MEMBER_INVITED',
] as const;

export async function getOrgActivityFeed(orgId: string) {
	const events = await prisma.auditLog.findMany({
		where: {
			orgId,
			action: { in: [...ACTIVITY_FEED_ACTIONS] },
		},
		orderBy: { createdAt: 'desc' },
		take: 20,
		select: {
			id: true,
			action: true,
			metadata: true,
			createdAt: true,
			actor: { select: { name: true, email: true } },
		},
	});

	return events;
}
