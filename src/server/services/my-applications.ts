import { TRPCError } from '@trpc/server';
import type { Prisma } from '@/prisma/generated/client';
import { isUniqueViolationOn } from '@/server/lib/prisma-errors';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import { findEmailByUserId } from '@/server/repositories/userAccountStateRepo';
import {
	claimApplicationForUser,
	declineApplicationForUser,
	getApplicationStatusTimeline,
	getScreenerQuestionsByIds,
	getUserApplicationDetail,
	listClaimableApplicationsByEmail,
	listUserApplications,
} from '@/server/repositories/volunteer-applications';
import { ensureAppliedRosterRow } from '@/server/services/appliedRosterService';

export async function listMyApplications(userId: string) {
	const applications = await listUserApplications(userId);

	return applications.map((application) => {
		const reasons = normalizeReasons(application.screeningReasons);

		return {
			id: application.id,
			submittedAt: application.submittedAt,
			status: application.status,
			screeningStatus: application.screeningStatus,
			screeningReasonsCount: reasons.length,
			organization: application.organization,
		};
	});
}

export async function getMyApplicationDetail(
	userId: string,
	applicationId: string,
) {
	const application = await getUserApplicationDetail(userId, applicationId);

	if (!application) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Application not found.',
		});
	}

	const reasons = normalizeReasons(application.screeningReasons);
	const questionIds = application.answers.map((answer) => answer.questionId);
	const questions = await getScreenerQuestionsByIds(
		application.orgId,
		questionIds,
	);
	const questionMap = new Map(
		questions.map((question) => [question.id, question]),
	);

	const answers = application.answers.map((answer) => ({
		id: answer.id,
		questionId: answer.questionId,
		prompt: questionMap.get(answer.questionId)?.prompt ?? 'Question removed',
		value: normalizeAnswerValue(answer.answerJson),
		displayValue: formatAnswerValue(normalizeAnswerValue(answer.answerJson)),
	}));

	return {
		id: application.id,
		submittedAt: application.submittedAt,
		status: application.status,
		screeningStatus: application.screeningStatus,
		screeningReasons: reasons,
		organization: application.organization,
		answers,
	};
}

export async function getMyApplicationStatusTimeline(
	userId: string,
	applicationId: string,
) {
	// Verify ownership before returning timeline
	const application = await prisma.volunteerApplication.findFirst({
		where: { id: applicationId, submittedByUserId: userId },
		select: { id: true },
	});

	if (!application) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Application not found.',
		});
	}

	return getApplicationStatusTimeline(applicationId);
}

/**
 * Applications submitted anonymously under the signed-in user's address that
 * they have not yet claimed.
 *
 * This replaces the previous `linkApplicationsToUser()`, which ran an unscoped
 * `updateMany({ submittedByUserId: null, submittedByEmail: email })` on every
 * page load and silently bound *any* matching orphan. Because `screener.submit`
 * is a publicProcedure taking an arbitrary `submittedByEmail`, that let an
 * unauthenticated party plant an application carrying a victim's address
 * against an org of their choosing and have it auto-attach on the victim's next
 * sign-in — minting an `APPLICATION` relationship that
 * `requireOrgVolunteerRelationship()` accepts as authorization for
 * `profile.getOrgVisibleProfile` and `credentials.issue`.
 *
 * Takes only a user id. The address is resolved from that id rather than passed
 * in from `ctx.session.user.email`, which under impersonation is the real
 * admin's address while `id` is the target's — pairing the two would list the
 * admin's own orphan applications inside the target's card.
 */
export async function listClaimableApplications(userId: string) {
	const email = await findEmailByUserId(userId);

	if (!email) {
		return [];
	}

	return listClaimableApplicationsByEmail(email);
}

/**
 * Bind one orphan application to the signed-in user after they confirm it is
 * theirs. The repository enforces the email match in its `where` clause, so an
 * id belonging to someone else simply matches nothing.
 *
 * Resolves the address from `userId` for the same reason as the listing above:
 * the id and the email must describe one person.
 */
export async function claimApplication(userId: string, applicationId: string) {
	const email = await findEmailByUserId(userId);

	if (!email) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Your account has no email address on file.',
		});
	}

	// The bind, its audit row, and any roster edge it implies commit together.
	// Writing the audit after the transaction would let a claim succeed with no
	// trail of who acquired the relationship edge — the exact blind spot this fix
	// exists to close.
	let claimed: { id: string; orgId: string } | null;
	try {
		claimed = await prisma.$transaction(async (tx) => {
			const row = await claimApplicationForUser(
				applicationId,
				userId,
				email,
				tx,
			);

			if (!row) {
				return null;
			}

			await writeAuditLogTx(tx, {
				orgId: row.orgId,
				actorId: userId,
				action: 'APPLICATION_CLAIMED',
				entityType: 'VolunteerApplication',
				entityId: row.id,
				metadata: { claimedByEmail: email },
			});

			// E1a, second entry point. An application approved BEFORE the
			// applicant ever signed in gains `submittedByUserId` only now, so the
			// roster edge has to be created here too — otherwise an APPROVED,
			// linked application sits with no roster row and nothing ever
			// reconciles it.
			//
			// `addedByUserId` is null on purpose: nobody added this volunteer, they
			// added themselves.
			if (row.status === 'APPROVED') {
				await ensureAppliedRosterRow(tx, {
					orgId: row.orgId,
					userId,
					applicationId: row.id,
					actorId: userId,
					addedByUserId: null,
					fallbackDisplayName: email,
				});
			}

			return row;
		});
	} catch (err) {
		// The partial unique index on (submittedByUserId, opportunityId) WHERE the
		// status is not REJECTED/WITHDRAWN. Setting the previously-null
		// `submittedByUserId` collides when the caller already has an active
		// application for the SAME opportunity — reachable because
		// `submitVolunteerApplication` only dedupes once `submittedByUserId` is
		// set, so an anonymous submission and a signed-in one can coexist.
		//
		// Deliberately NOT collapsed into the NOT_FOUND below. That code exists so
		// "already claimed", "not yours" and "does not exist" are indistinguishable
		// to someone probing ids — but reaching this line means the email predicate
		// in the repository's `where` already matched, so the row IS the caller's
		// and the collision is with their OWN other application. Nothing about a
		// third party is disclosed, and NOT_FOUND here would be a dead end the user
		// cannot act on.
		if (
			isUniqueViolationOn(
				err,
				'VolunteerApplication_userId_opportunityId_active',
			)
		) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: "You've already applied to this opportunity.",
			});
		}
		throw err;
	}

	if (!claimed) {
		// Indistinguishable outcomes on purpose: "already claimed", "not yours",
		// and "does not exist" all land here, so an id probe learns nothing.
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Application not found.',
		});
	}

	return { id: claimed.id };
}

/**
 * Record that an orphan application offered to this user is not theirs.
 *
 * The claim card previously had one control — "Add to my account" — and hid only
 * when the claimable list emptied, which it could do only by claiming. In the
 * abuse case the card exists to stop (a third party planting an application
 * under someone's address), the victim therefore saw a permanent card whose sole
 * button granted the planting org an authorization edge over them. That is
 * nag-until-yes on a security decision.
 *
 * The audit row is the point as much as the suppression is: a decline is
 * EVIDENCE of a planted application, and a cluster of them against one org is a
 * platform-admin signal.
 */
export async function declineApplication(
	userId: string,
	applicationId: string,
) {
	const email = await findEmailByUserId(userId);

	if (!email) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Your account has no email address on file.',
		});
	}

	const declined = await prisma.$transaction(async (tx) => {
		const row = await declineApplicationForUser(
			applicationId,
			userId,
			email,
			tx,
		);

		if (!row) {
			return null;
		}

		await writeAuditLogTx(tx, {
			orgId: row.orgId,
			actorId: userId,
			action: 'APPLICATION_CLAIM_DECLINED',
			entityType: 'VolunteerApplication',
			entityId: row.id,
			metadata: { declinedByEmail: email },
		});

		return row;
	});

	if (!declined) {
		// Same indistinguishability as the claim path: "already declined", "not
		// yours" and "does not exist" are one outcome, so an id probe learns
		// nothing from declining either.
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Application not found.',
		});
	}

	return { id: declined.id };
}

export function normalizeReasons(
	value: Prisma.JsonValue | null | undefined,
): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((item) => {
		if (typeof item === 'string') {
			return item;
		}
		if (item && typeof item === 'object') {
			const message = (item as { message?: string }).message;
			if (typeof message === 'string') {
				return message;
			}
		}
		return JSON.stringify(item);
	});
}

export function normalizeAnswerValue(
	value: Prisma.JsonValue | null | undefined,
) {
	if (!value || typeof value !== 'object') {
		return value;
	}
	if ('value' in value) {
		return (value as { value: unknown }).value;
	}
	return value;
}

export function formatAnswerValue(value: unknown) {
	if (value === null || value === undefined) {
		return '—';
	}
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.length > 0 ? value.join(', ') : '—';
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
