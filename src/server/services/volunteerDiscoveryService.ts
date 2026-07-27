/**
 * Volunteer Discovery Service — org staff can search for PUBLIC volunteers
 * and invite them to apply to specific opportunities.
 *
 * ┌─────────────────────────┐     ┌───────────────────────────┐
 * │ searchPublicVolunteers  │────▶│ volunteerDiscoveryRepo     │
 * │ inviteToApply           │     │ searchPublicProfiles()     │
 * └─────────────────────────┘     └───────────────────────────┘
 *         │
 *         ├── advisory lock: serialize the rate limit per org (see the repo)
 *         ├── rate limit: COUNT invitations WHERE orgId + sentAt > -24h
 *         ├── duplicate check: VolunteerInvitation @@unique guard
 *         ├── already applied: check VolunteerApplication
 *         ├── create VolunteerInvitation
 *         ├── send email (fire-and-forget)
 *         └── audit log (try/await/catch)
 */

import { TRPCError } from '@trpc/server';
import { writeAuditLog } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import { sendInviteToApplyEmail } from '@/server/repositories/sendInviteToApplyEmail';
import {
	type DiscoveryFilters,
	type SearchPage,
	searchPublicProfiles,
} from '@/server/repositories/volunteerDiscoveryRepo';
import { lockOrgForInviteRateLimit } from '@/server/repositories/volunteerInvitationRepo';

const RATE_LIMIT_PER_DAY = 10;

export async function searchPublicVolunteers(
	filters: DiscoveryFilters,
): Promise<SearchPage> {
	return searchPublicProfiles(filters);
}

export async function inviteToApply(input: {
	volunteerId: string;
	opportunityId: string;
	orgId: string;
	actorId: string;
}): Promise<{ invitationId: string }> {
	const { volunteerId, opportunityId, orgId, actorId } = input;

	// SECURITY: `opportunityId` arrives from client input while `orgId` is
	// resolved server-side from the session, so without this check staff at org A
	// could send an invitation naming org B's opportunity — an email carrying org
	// B's name (see step 4, which reads `opportunity.organization.name`) and an
	// audit row filed under org A. NOT_FOUND rather than FORBIDDEN so a foreign
	// id is indistinguishable from a missing one.
	//
	// `volunteerId` is deliberately NOT scoped here: discovery is a cross-org
	// recruiting directory over PUBLIC profiles, so an arbitrary volunteer is the
	// feature, not a bug. That is also why `VolunteerInvitation` is excluded from
	// the accepted set in `findOrgVolunteerRelationship` — an outbound
	// solicitation must not mint a relationship that authorizes acting on the
	// person it was sent to.
	//
	// This selects the same fields step 4 needs, so the guard replaces that fetch
	// rather than adding one — net zero queries.
	const opportunity = await prisma.volunteerOpportunity.findFirst({
		where: { id: opportunityId, orgId },
		select: { title: true, organization: { select: { name: true } } },
	});
	if (!opportunity) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Opportunity not found.',
		});
	}

	// 1. Rate limit + 2. Already-applied check + 3. Create invitation.
	//
	// SECURITY: the advisory lock, NOT the transaction, is what makes the rate
	// limit hold. A previous comment here claimed the `$transaction` prevented
	// the TOCTOU race; it did not, and asserting a guarantee that is not there is
	// worse than documenting the gap. Postgres defaults to READ COMMITTED, under
	// which two concurrent calls can both COUNT 9, both pass the check below, and
	// both COMMIT — 11 invitations out of a 10/day limit. The lock serializes the
	// count-then-create pair per org; see lockOrgForInviteRateLimit for why this
	// rather than SERIALIZABLE or a counter table.
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
	let invitation: { id: string };
	try {
		invitation = await prisma.$transaction(async (tx) => {
			await lockOrgForInviteRateLimit(tx, orgId);

			const recentCount = await tx.volunteerInvitation.count({
				where: { orgId, sentAt: { gte: since } },
			});
			if (recentCount >= RATE_LIMIT_PER_DAY) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Rate limit: maximum 10 invitations per day',
				});
			}

			const existingApplication = await tx.volunteerApplication.findFirst({
				where: { orgId, submittedByUserId: volunteerId, opportunityId },
			});
			if (existingApplication) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Volunteer has already applied to this opportunity',
				});
			}

			return tx.volunteerInvitation.create({
				data: { orgId, volunteerId, opportunityId },
				select: { id: true },
			});
		});
	} catch (err) {
		if ((err as { code?: string }).code === 'P2002') {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Volunteer has already been invited to this opportunity',
			});
		}
		throw err;
	}

	// 4. Fetch volunteer email + name. The opportunity was already loaded by the
	// org-scope guard above, so it is not re-fetched here.
	const volunteer = await prisma.user.findUnique({
		where: { id: volunteerId },
		select: { email: true, name: true },
	});

	// 5. Send email (fire-and-forget — log error, don't throw)
	if (volunteer?.email && opportunity) {
		try {
			await sendInviteToApplyEmail({
				to: volunteer.email,
				volunteerName: volunteer.name ?? 'Volunteer',
				orgName: opportunity.organization.name,
				opportunityTitle: opportunity.title,
				opportunityLink: `${process.env.NEXTAUTH_URL ?? ''}/app/browse`,
			});
		} catch (emailErr) {
			console.error(
				'[volunteerDiscoveryService] sendInviteToApplyEmail failed',
				emailErr,
			);
		}
	}

	// 6. Audit log (fire-and-forget — try/await/catch outside any tx)
	try {
		await writeAuditLog({
			orgId,
			actorId,
			action: 'INVITE_TO_APPLY',
			entityType: 'VolunteerInvitation',
			entityId: invitation.id,
			metadata: { volunteerId, opportunityId },
		});
	} catch (auditErr) {
		console.error('[volunteerDiscoveryService] writeAuditLog failed', auditErr);
	}

	return { invitationId: invitation.id };
}
