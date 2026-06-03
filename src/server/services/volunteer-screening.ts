import {
	ApplicationSource,
	ApplicationStatus,
	OpportunityStatus,
	Prisma,
	type ScreeningStatus,
} from '@/prisma/generated/client';
import { parseConfigJson } from '@/server/domain/screener/configSchema';
import {
	evaluateScreening,
	type ScreenerQuestion,
	type ScreenerResponse,
	type VolunteerProfile,
	validateResponses,
} from '@/server/domain/volunteer-screening';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import {
	findMemberByUserAndOrg,
	touchMemberActivity,
} from '@/server/repositories/reengagement-repo';
import {
	findActiveApplicationByUserAndOpportunity,
	getActiveQuestions,
} from '@/server/repositories/volunteer-applications';
import { tryNotify } from '@/server/services/notificationService';
import { checkAndIssueTenureBadges } from '@/server/services/tenureBadgeService';

interface SubmitVolunteerApplicationPayload {
	submittedByEmail: string;
	submittedByUserId?: string | null;
	opportunityId?: string | null;
	profile: VolunteerProfile;
	responses: ScreenerResponse[];
	source?: ApplicationSource | null;
}

/** Build a consistent return shape for duplicate application detection. */
function buildDuplicateResponse(existing: {
	id: string;
	status: string;
	submittedAt: Date;
}) {
	return {
		applicationId: existing.id,
		status: existing.status as ApplicationStatus,
		screeningStatus: 'REVIEW' as ScreeningStatus,
		screeningReasons: [] as string[],
		duplicate: true as const,
	};
}

export function mapQuestion(question: {
	id: string;
	prompt: string;
	type: string;
	configJson: unknown;
}): ScreenerQuestion {
	const config = parseConfigJson(question.configJson);

	const disqualifierRule = config.rules?.disqualifierRule
		? {
				operator: config.rules.disqualifierRule.operator,
				value: config.rules.disqualifierRule.value,
				reason: config.rules.reason,
			}
		: undefined;

	const reviewRule = config.rules?.reviewIf
		? {
				operator: config.rules.reviewIf.operator,
				value: config.rules.reviewIf.value,
				reason: config.rules.reason,
			}
		: undefined;

	return {
		id: question.id,
		prompt: question.prompt,
		type: question.type as ScreenerQuestion['type'],
		options: config.options,
		required: config.required,
		disqualifierRule,
		reviewRule,
	};
}

export async function submitVolunteerApplication(
	orgId: string,
	payload: SubmitVolunteerApplicationPayload,
) {
	const questionRecords = await getActiveQuestions(orgId);
	const questions = questionRecords.map(mapQuestion);

	const validation = validateResponses(questions, payload.responses);

	let screeningStatus: ScreeningStatus = 'REVIEW';
	let screeningReasons: string[] = [];

	if (!validation.success) {
		screeningReasons = validation.error.issues.map((issue) => issue.message);
	} else {
		const result = evaluateScreening(questions, payload.responses);
		screeningStatus = result.status;
		screeningReasons = result.reasons;
	}

	let validatedOpportunityId: string | null = null;
	if (payload.opportunityId) {
		const opp = await prisma.volunteerOpportunity.findFirst({
			where: {
				id: payload.opportunityId,
				orgId,
				status: OpportunityStatus.PUBLISHED,
			},
			select: { id: true },
		});
		validatedOpportunityId = opp?.id ?? null;
	}

	// Validate source: downgrade MARKETPLACE to DIRECT if org is not marketplace-visible
	let validatedSource: ApplicationSource = ApplicationSource.DIRECT;
	if (payload.source === ApplicationSource.MARKETPLACE) {
		const org = await prisma.organization.findUnique({
			where: { id: orgId },
			select: { marketplaceVisible: true },
		});
		validatedSource = org?.marketplaceVisible
			? ApplicationSource.MARKETPLACE
			: ApplicationSource.DIRECT;
	} else if (payload.source) {
		validatedSource = payload.source;
	}

	// Dedup guard: prevent duplicate applications for authenticated users
	if (payload.submittedByUserId && validatedOpportunityId) {
		const existing = await findActiveApplicationByUserAndOpportunity(
			orgId,
			payload.submittedByUserId,
			validatedOpportunityId,
		);
		if (existing) {
			return buildDuplicateResponse(existing);
		}
	}

	// Application + answers + audit all committed atomically
	let application: Awaited<
		ReturnType<typeof prisma.volunteerApplication.create>
	>;
	try {
		application = await prisma.$transaction(async (tx) => {
			const app = await tx.volunteerApplication.create({
				data: {
					orgId,
					opportunityId: validatedOpportunityId,
					submittedByUserId: payload.submittedByUserId ?? null,
					submittedByEmail: payload.submittedByEmail,
					status: ApplicationStatus.SUBMITTED,
					screeningStatus,
					screeningReasons,
					source: validatedSource,
				},
			});

			if (payload.responses.length > 0) {
				await tx.volunteerAnswer.createMany({
					data: payload.responses.map((response) => ({
						applicationId: app.id,
						questionId: response.questionId,
						answerJson: { value: response.value } as Prisma.InputJsonValue,
					})),
				});
			}

			await writeAuditLogTx(tx, {
				orgId,
				action: 'volunteer_application.submitted',
				entityType: 'VolunteerApplication',
				entityId: app.id,
				metadata: {
					submittedByEmail: payload.submittedByEmail,
					opportunityId: validatedOpportunityId,
					screeningStatus,
					profile: payload.profile,
				},
			});

			// First-volunteer celebration — exactly-once conditional update.
			// Only sets the timestamp if it hasn't been set yet (WHERE IS NULL).
			await tx.organization.updateMany({
				where: { id: orgId, firstApplicationReceivedAt: null },
				data: { firstApplicationReceivedAt: new Date() },
			});

			return app;
		});
	} catch (e) {
		// Race condition: another request created the application between our
		// dedup check and the INSERT. The partial unique index caught it.
		if (
			e instanceof Prisma.PrismaClientKnownRequestError &&
			e.code === 'P2002' &&
			payload.submittedByUserId &&
			validatedOpportunityId
		) {
			const existing = await findActiveApplicationByUserAndOpportunity(
				orgId,
				payload.submittedByUserId,
				validatedOpportunityId,
			);
			if (existing) {
				return buildDuplicateResponse(existing);
			}
		}
		throw e;
	}

	// Fire-and-forget: check if this application unlocks a tenure badge.
	// Only runs for authenticated users (anonymous submissions have no userId).
	if (payload.submittedByUserId) {
		void checkAndIssueTenureBadges(payload.submittedByUserId);
		// Update activity timestamp for re-engagement tracking.
		void findMemberByUserAndOrg(payload.submittedByUserId, orgId).then(
			(memberId) => {
				if (memberId) void touchMemberActivity(memberId);
			},
		);
	}

	// First-volunteer celebration — notify org admins/owners once.
	// Check if the timestamp was just set (it's within 5 seconds of now).
	void notifyFirstApplicationIfNew(orgId);

	return {
		applicationId: application.id,
		screeningStatus,
		screeningReasons,
	};
}

/**
 * If the org just received its first application (timestamp set within last 5s),
 * send a celebration notification to all org admins and owners.
 */
async function notifyFirstApplicationIfNew(orgId: string) {
	try {
		const org = await prisma.organization.findUnique({
			where: { id: orgId },
			select: {
				firstApplicationReceivedAt: true,
				name: true,
				members: {
					where: { role: { in: ['ADMIN', 'OWNER'] } },
					select: { userId: true },
				},
			},
		});

		if (!org?.firstApplicationReceivedAt) return;

		// Only send if the timestamp was just set (within 5 seconds)
		const elapsed = Date.now() - org.firstApplicationReceivedAt.getTime();
		if (elapsed > 5000) return;

		for (const member of org.members) {
			void tryNotify({
				userId: member.userId,
				orgId,
				type: 'FIRST_APPLICATION',
				title: 'Your first volunteer applied!',
				body: `Congratulations! ${org.name} just received its first volunteer application. Head to Applications to review it.`,
				href: '/app/applications',
			});
		}
	} catch (err) {
		console.error(
			'[volunteer-screening] notifyFirstApplicationIfNew failed:',
			err,
		);
	}
}
