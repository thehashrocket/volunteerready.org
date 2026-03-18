/**
 * Volunteer Discovery Service — org staff can search for PUBLIC volunteers
 * and invite them to apply to specific opportunities.
 *
 * ┌─────────────────────────┐     ┌───────────────────────────┐
 * │ searchPublicVolunteers  │────▶│ volunteerDiscoveryRepo     │
 * │ inviteToApply           │     │ searchPublicProfiles()     │
 * └─────────────────────────┘     └───────────────────────────┘
 *         │
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

	// 1. Rate limit + 2. Already-applied check + 3. Create invitation — all in
	// one transaction to prevent the TOCTOU race: two concurrent requests from the
	// same org could both pass the rate limit check before either creates a record.
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
	let invitation: { id: string };
	try {
		invitation = await prisma.$transaction(async (tx) => {
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

	// 4. Fetch volunteer email + name, opportunity title (parallel)
	const [volunteer, opportunity] = await Promise.all([
		prisma.user.findUnique({
			where: { id: volunteerId },
			select: { email: true, name: true },
		}),
		prisma.volunteerOpportunity.findUnique({
			where: { id: opportunityId },
			select: {
				title: true,
				organization: { select: { name: true } },
			},
		}),
	]);

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
