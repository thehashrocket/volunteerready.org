import { BASE_URL } from '@/lib/constants';
import { DigestFrequency, OpportunityStatus } from '@/prisma/generated/client';
import { generateUnsubscribeTokenFromEnv } from '../lib/digest-unsubscribe-token';
import { sendEmail } from '../lib/email';
import { escapeHtml } from '../lib/html';
import { prisma } from '../repositories/prisma';

const BATCH_SIZE = 100;
// 2-hour grace period so users stamped anywhere in the Monday 8–9am window
// are still eligible at 8:00am the following Monday (exactly 7 days later
// would require millisecond precision; 6h55m leeway is acceptable for a newsletter).
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000;
const OPPORTUNITIES_PER_DIGEST = 5;

/**
 * Send weekly marketplace opportunity digests.
 *
 * Runs on Monday 8am UTC (enforced by the cron schedule). The service checks
 * the UTC day/hour as an additional guard so it can be called safely in tests
 * without the schedule constraint.
 *
 * Uses cursor-based pagination (100 users per run) following the same pattern
 * as digest-service.ts. Resumes from the last successful CronJobRun cursor.
 *
 * Per-user: fetches top-5 PUBLISHED + marketplaceVisible opportunities,
 * excluding ones the user has already applied to or expressed interest in.
 * Sends a branded email. Updates lastDigestSentAt for idempotency.
 */
export async function sendOpportunityDigestEmails(opts?: {
	skipWindowCheck?: boolean;
	cursor?: string | null;
}): Promise<{
	emailsSent: number;
	usersProcessed: number;
	nextCursor: string | null;
}> {
	const now = new Date();

	// Validate unsubscribe secret early — fail fast rather than per-user log spam
	try {
		generateUnsubscribeTokenFromEnv('__check__');
	} catch {
		throw new Error(
			'[opportunity-digest] DIGEST_UNSUBSCRIBE_SECRET not configured — aborting',
		);
	}

	// Guard: only run on Monday 8am UTC (unless skipped for testing)
	if (!opts?.skipWindowCheck) {
		const isMonday = now.getUTCDay() === 1;
		const hour = now.getUTCHours();
		const isDeliveryWindow = hour >= 8 && hour <= 9;
		if (!isMonday || !isDeliveryWindow) {
			return { emailsSent: 0, usersProcessed: 0, nextCursor: null };
		}
	}

	const oneWeekAgo = new Date(now.getTime() - ONE_WEEK_MS);
	const resumeCursor = opts?.cursor ?? null;

	// Fetch users eligible for the weekly digest
	const preferences = await prisma.userMarketplacePreference.findMany({
		where: {
			digestFrequency: DigestFrequency.WEEKLY,
			OR: [
				{ lastDigestSentAt: null },
				{ lastDigestSentAt: { lt: oneWeekAgo } },
			],
		},
		include: {
			user: { select: { id: true, email: true, name: true } },
		},
		orderBy: { id: 'asc' },
		...(resumeCursor ? { cursor: { id: resumeCursor }, skip: 1 } : {}),
		take: BATCH_SIZE,
	});

	let emailsSent = 0;
	let usersProcessed = 0;

	for (const pref of preferences) {
		usersProcessed++;

		try {
			const { email, id: userId, name } = pref.user;
			if (!email) {
				// Stamp to avoid re-fetching email-less users on every cron run
				await prisma.userMarketplacePreference.update({
					where: { id: pref.id },
					data: { lastDigestSentAt: now },
				});
				continue;
			}

			// Find opportunities the user has already applied to or expressed interest in
			const [appliedIds, interestedIds] = await Promise.all([
				getAppliedOpportunityIds(userId),
				getInterestedOpportunityIds(userId),
			]);
			const excludeIds = [...new Set([...appliedIds, ...interestedIds])];

			// Fetch top-5 newest PUBLISHED + marketplaceVisible opportunities
			const opportunities = await prisma.volunteerOpportunity.findMany({
				where: {
					status: OpportunityStatus.PUBLISHED,
					organization: { marketplaceVisible: true, suspendedAt: null },
					...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
				},
				orderBy: { createdAt: 'desc' },
				take: OPPORTUNITIES_PER_DIGEST,
				select: {
					id: true,
					title: true,
					location: true,
					isRemote: true,
					startDate: true,
					organization: { select: { name: true, slug: true } },
				},
			});

			if (opportunities.length === 0) {
				// Stamp to avoid re-checking users with no relevant opportunities
				await prisma.userMarketplacePreference.update({
					where: { id: pref.id },
					data: { lastDigestSentAt: now },
				});
				continue;
			}

			const unsubscribeToken = generateUnsubscribeTokenFromEnv(userId);
			const baseUrl = process.env.NEXTAUTH_URL ?? BASE_URL;
			const unsubscribeUrl = `${baseUrl}/api/unsubscribe/digest?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(unsubscribeToken)}`;
			const browseUrl = `${baseUrl}/opportunities`;

			const opportunitiesHtml = opportunities
				.map(
					(opp) => `
				<div style="background-color: #F5F1EB; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
					<p style="margin: 0 0 4px; font-size: 17px; font-weight: 600; color: #1B3C2A;">
						${escapeHtml(opp.title)}
					</p>
					<p style="margin: 0 0 10px; font-size: 13px; color: #6B5E4F;">
						${escapeHtml(opp.organization.name)}
						${opp.location ? ` · ${escapeHtml(opp.location)}` : ''}
						${opp.isRemote ? ' · Remote' : ''}
						${opp.startDate ? ` · ${new Date(opp.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
					</p>
					<a href="${baseUrl}/opportunities/${escapeHtml(opp.organization.slug)}?opportunityId=${escapeHtml(opp.id)}"
					   style="background-color: #1B3C2A; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 13px; display: inline-block;">
						View Opportunity →
					</a>
				</div>`,
				)
				.join('');

			const html = `
				<h2 style="font-size: 22px; color: #1B3C2A; margin: 0 0 4px;">New opportunities this week</h2>
				<p style="color: #6B5E4F; margin: 0 0 24px;">Fresh volunteer opportunities you haven't seen yet${name ? `, ${escapeHtml(name)}` : ''}.</p>

				${opportunitiesHtml}

				<div style="margin-top: 24px; text-align: center;">
					<a href="${browseUrl}"
					   style="background-color: #C4A882; color: #1B3C2A; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
						Browse all opportunities →
					</a>
				</div>

				<p style="margin-top: 32px; font-size: 12px; color: #9B9189; text-align: center;">
					<a href="${unsubscribeUrl}" style="color: #9B9189;">Unsubscribe from opportunity emails</a>
				</p>
			`;

			// Unrequested bulk mail — opts into the unclaimed guard. The WEEKLY
			// preference this iterates is auto-created on a marketplace heart,
			// an action a never-authenticated user cannot have taken.
			const sent = await sendEmail(
				email,
				'Your weekly volunteer opportunities',
				html,
				{ suppressUnclaimed: true },
			);

			if (sent) {
				await prisma.userMarketplacePreference.update({
					where: { id: pref.id },
					data: { lastDigestSentAt: now },
				});
				emailsSent++;
			}
		} catch (e) {
			if ((e as { code?: string }).code === 'P2025') {
				console.warn(
					`[opportunity-digest] Preference ${pref.id} already modified — skipping`,
				);
			} else {
				console.error(
					`[opportunity-digest] Failed to send digest for user ${pref.userId}`,
					e,
				);
			}
		}
	}

	const nextCursor =
		preferences.length < BATCH_SIZE
			? null
			: preferences[preferences.length - 1].id;

	return { emailsSent, usersProcessed, nextCursor };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAppliedOpportunityIds(userId: string): Promise<string[]> {
	const apps = await prisma.volunteerApplication.findMany({
		where: { submittedByUserId: userId },
		select: { opportunityId: true },
	});
	return apps.flatMap((a) => (a.opportunityId ? [a.opportunityId] : []));
}

async function getInterestedOpportunityIds(userId: string): Promise<string[]> {
	const interests = await prisma.opportunityInterest.findMany({
		where: { userId },
		select: { opportunityId: true },
	});
	return interests.map((i) => i.opportunityId);
}
