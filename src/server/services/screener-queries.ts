import type { ApplicationStatus } from '@/prisma/generated/client';
import { sendEmail } from '@/server/lib/email';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { countOpportunitiesByStatus } from '@/server/repositories/opportunityRepo';
import { prisma } from '@/server/repositories/prisma';
import { getPublicFormByOrgSlug } from '@/server/repositories/publicApplyRepo';
import {
	countApplicationsByStatus,
	findActiveApplicationByUserAndOpportunity,
	getApplicationDetail,
	getRecentApplications,
	getScreenerQuestionsByIds,
	listApplications,
	listUserAppliedOpportunities,
	listUserAppliedOpportunitiesCrossOrg,
	updateApplicationStatusTx,
} from '@/server/repositories/volunteer-applications';

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

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
	const result = await prisma.$transaction(async (tx) => {
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

		return { updated, previousStatus };
	});

	// Fire-and-forget: send status change notification email
	void notifyApplicationStatusChange(
		result.updated,
		result.previousStatus,
		status,
	);

	return result.updated;
}

const STATUS_EMAIL_CONFIG: Partial<
	Record<
		ApplicationStatus,
		{
			subject: (oppTitle: string) => string;
			heading: string;
			body: (oppTitle: string) => string;
		}
	>
> = {
	REVIEW: {
		subject: (opp) => `Your application for ${opp} is being reviewed`,
		heading: 'Application update',
		body: (opp) =>
			`Good news — your application for <strong>${opp}</strong> is now being reviewed by the team. We'll let you know when there's an update.`,
	},
	APPROVED: {
		subject: (opp) => `Great news! You've been approved for ${opp}`,
		heading: "You're approved!",
		body: (opp) =>
			`Congratulations! Your application for <strong>${opp}</strong> has been approved. The organization will follow up with next steps.`,
	},
	REJECTED: {
		subject: (opp) => `Update on your application for ${opp}`,
		heading: 'Application update',
		body: (opp) =>
			`Thank you for your interest in <strong>${opp}</strong>. Unfortunately, the organization has decided not to move forward with your application at this time. You're welcome to apply for other opportunities.`,
	},
};

async function notifyApplicationStatusChange(
	application: {
		id: string;
		submittedByEmail: string;
		opportunityId: string | null;
	},
	previousStatus: ApplicationStatus,
	newStatus: ApplicationStatus,
) {
	try {
		if (previousStatus === newStatus) return;

		const config = STATUS_EMAIL_CONFIG[newStatus];
		if (!config) return;

		// Look up opportunity title for the email
		let oppTitle = 'this opportunity';
		if (application.opportunityId) {
			const opp = await prisma.volunteerOpportunity.findUnique({
				where: { id: application.opportunityId },
				select: { title: true },
			});
			if (opp) oppTitle = escapeHtml(opp.title);
		}

		const content = `
			<h2 style="font-size: 20px; margin-bottom: 12px;">${config.heading}</h2>
			<p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">${config.body(oppTitle)}</p>
			<a href="${process.env.NEXTAUTH_URL}/app/my-applications/${application.id}"
				style="display: inline-block; padding: 12px 24px; background-color: #1B3C2A; color: #FAFAF8; text-decoration: none; border-radius: 6px; font-weight: 600;">
				View My Application
			</a>
		`;

		await sendEmail(
			application.submittedByEmail,
			config.subject(oppTitle),
			content,
		);
	} catch (err) {
		console.error(
			'[screener-queries] notifyApplicationStatusChange failed:',
			err,
		);
	}
}

export async function checkExistingApplicationForUser(
	orgId: string,
	userId: string,
	opportunityId: string,
) {
	// Validate the opportunity exists and belongs to this org (prevents cross-org probing)
	const opp = await prisma.volunteerOpportunity.findFirst({
		where: { id: opportunityId, orgId },
		select: { id: true },
	});
	if (!opp) return null;

	return findActiveApplicationByUserAndOpportunity(
		orgId,
		userId,
		opportunityId,
	);
}

export async function getAppliedOpportunitiesForUser(
	orgId: string,
	userId: string,
	opportunityIds: string[],
) {
	const apps = await listUserAppliedOpportunities(
		orgId,
		userId,
		opportunityIds,
	);
	return Object.fromEntries(
		apps
			.filter((a) => a.opportunityId != null)
			.map((a) => [
				a.opportunityId,
				{
					applicationId: a.id,
					status: a.status,
					submittedAt: a.submittedAt,
				},
			]),
	);
}

/**
 * Cross-org version: returns which opportunities the user has applied to
 * across any org. Used by /app/browse which shows all orgs' opportunities.
 * Safe because it only returns the authenticated user's own data.
 */
export async function getAppliedOpportunitiesCrossOrg(
	userId: string,
	opportunityIds: string[],
) {
	const apps = await listUserAppliedOpportunitiesCrossOrg(
		userId,
		opportunityIds,
	);
	return Object.fromEntries(
		apps
			.filter((a) => a.opportunityId != null)
			.map((a) => [
				a.opportunityId,
				{
					applicationId: a.id,
					status: a.status,
					submittedAt: a.submittedAt,
				},
			]),
	);
}

/**
 * Check if an anonymous email has already been used to apply to a specific opportunity.
 * Returns a soft-block message; does NOT prevent submission.
 */
export async function checkAnonymousEmailApplication(
	orgId: string,
	email: string,
	opportunityId: string,
) {
	// Validate opportunity belongs to org
	const opp = await prisma.volunteerOpportunity.findFirst({
		where: { id: opportunityId, orgId },
		select: { id: true },
	});
	if (!opp) return null;

	const existing = await prisma.volunteerApplication.findFirst({
		where: {
			orgId,
			submittedByEmail: email,
			opportunityId,
			status: { not: 'REJECTED' },
		},
		select: { id: true },
	});

	return existing ? { exists: true } : null;
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
		teamMemberCount,
		completedBackgroundCheckCount,
		org,
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
		prisma.organizationMember.count({ where: { organizationId: orgId } }),
		prisma.backgroundCheckRequest.count({
			where: { orgId, status: { in: ['COMPLETE', 'CONSIDER'] } },
		}),
		prisma.organization.findUnique({
			where: { id: orgId },
			select: { onboardingComplete: true, slug: true },
		}),
	]);

	const appTotal =
		appCounts.submitted +
		appCounts.review +
		appCounts.approved +
		appCounts.rejected;
	const oppTotal = oppCounts.draft + oppCounts.published + oppCounts.closed;

	return {
		opportunities: {
			draft: oppCounts.draft,
			published: oppCounts.published,
			closed: oppCounts.closed,
			total: oppTotal,
		},
		applications: {
			submitted: appCounts.submitted,
			review: appCounts.review,
			approved: appCounts.approved,
			rejected: appCounts.rejected,
			total: appTotal,
		},
		recentApplications,
		health: {
			screenerQuestionCount,
			publishedOpportunityCount: oppCounts.published,
			shiftsWithSignupsCount,
			credentialsIssuedCount,
		},
		onboarding: {
			complete: org?.onboardingComplete ?? false,
			orgSlug: org?.slug ?? '',
			teamMemberCount,
			opportunityCount: oppTotal,
			applicationCount: appTotal,
			backgroundCheckCompleteCount: completedBackgroundCheckCount,
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
	'MEMBER_REMOVED',
	'ROLE_CHANGED',
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

export async function dismissOnboardingChecklist(orgId: string) {
	await prisma.organization.update({
		where: { id: orgId },
		data: { onboardingComplete: true },
	});
	return { success: true };
}

export async function getOnboardingBaseline(orgId: string) {
	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { onboardingBaseline: true },
	});
	return (org?.onboardingBaseline as Record<string, unknown>) ?? null;
}

export async function saveOnboardingBaseline(
	orgId: string,
	data: {
		volunteerCount: number;
		hoursPerWeek: number;
		currentProcess: string;
	},
) {
	await prisma.organization.update({
		where: { id: orgId },
		data: { onboardingBaseline: data },
	});
	return { success: true };
}

export async function getImpactReport(orgId: string) {
	const [org, summary] = await Promise.all([
		prisma.organization.findUnique({
			where: { id: orgId },
			select: {
				name: true,
				createdAt: true,
				onboardingBaseline: true,
			},
		}),
		getOrgLifetimeSummary(orgId),
	]);

	if (!org) return null;

	return {
		orgName: org.name,
		createdAt: org.createdAt,
		baseline: (org.onboardingBaseline as Record<string, unknown>) ?? null,
		summary,
	};
}

async function getOrgLifetimeSummary(orgId: string) {
	const [
		totalVolunteers,
		backgroundChecksCompleted,
		shiftsCreated,
		credentialsIssued,
		applicationsSubmitted,
		applicationsApproved,
	] = await Promise.all([
		prisma.volunteerApplication.count({
			where: { orgId, status: 'APPROVED' },
		}),
		prisma.backgroundCheckRequest.count({
			where: { orgId, status: { in: ['COMPLETE', 'CONSIDER'] } },
		}),
		prisma.shift.count({ where: { orgId } }),
		prisma.volunteerCredential.count({
			where: { orgId, status: 'VERIFIED' },
		}),
		prisma.volunteerApplication.count({ where: { orgId } }),
		prisma.volunteerApplication.count({
			where: { orgId, status: 'APPROVED' },
		}),
	]);

	return {
		totalVolunteers,
		backgroundChecksCompleted,
		shiftsCreated,
		credentialsIssued,
		applicationsSubmitted,
		applicationsApproved,
	};
}
