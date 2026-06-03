import {
	DigestFrequency,
	OpportunityStatus,
	Prisma,
} from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

/**
 * Toggle "I'm interested" on a marketplace opportunity for the given user.
 *
 * On first toggle-on, upserts UserMarketplacePreference with WEEKLY digest
 * so the user automatically receives the weekly opportunity digest.
 *
 * P2002 (concurrent create) and P2025 (concurrent delete) are caught to make
 * toggling idempotent under race conditions.
 */
export async function toggleInterest(
	userId: string,
	opportunityId: string,
): Promise<{ interested: boolean }> {
	const opportunity = await prisma.volunteerOpportunity.findFirst({
		where: {
			id: opportunityId,
			status: OpportunityStatus.PUBLISHED,
			organization: { marketplaceVisible: true },
		},
		select: { id: true },
	});

	if (!opportunity) {
		return { interested: false };
	}

	const existing = await prisma.opportunityInterest.findUnique({
		where: { userId_opportunityId: { userId, opportunityId } },
	});

	if (existing) {
		try {
			await prisma.opportunityInterest.delete({
				where: { userId_opportunityId: { userId, opportunityId } },
			});
		} catch (e) {
			// P2025: concurrent request already deleted it — idempotently "not interested"
			if (
				!(
					e instanceof Prisma.PrismaClientKnownRequestError &&
					e.code === 'P2025'
				)
			)
				throw e;
		}
		return { interested: false };
	}

	try {
		await prisma.opportunityInterest.create({
			data: { userId, opportunityId },
		});
	} catch (e) {
		// P2002: concurrent request already created it — idempotently "interested"
		if (
			!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
		)
			throw e;
	}

	// Upsert marketplace preference with WEEKLY digest on first interest toggle
	await prisma.userMarketplacePreference.upsert({
		where: { userId },
		create: { userId, digestFrequency: DigestFrequency.WEEKLY },
		update: {},
	});

	return { interested: true };
}

/** Return opportunityIds where the user has expressed interest on the marketplace. */
export async function getMyInterests(userId: string): Promise<string[]> {
	const rows = await prisma.opportunityInterest.findMany({
		where: {
			userId,
			opportunity: {
				status: OpportunityStatus.PUBLISHED,
				organization: { marketplaceVisible: true },
			},
		},
		select: { opportunityId: true },
	});
	return rows.map((r) => r.opportunityId);
}
