/**
 * Tenure Badge Service — idempotent, fire-and-forget safe.
 *
 * Checks whether a user has reached a tenure milestone (1yr/3yr/5yr)
 * and issues the corresponding system credential if not already held.
 *
 * Call this AFTER the parent operation succeeds (signUpForShift,
 * submitApplication, issueCredential). Use `void` — never await.
 * Errors are caught and logged; they MUST NOT propagate to the caller.
 *
 * Architecture:
 *
 *   Trigger (service)
 *     └─→ checkAndIssueTenureBadges(userId)
 *           ├─→ early exit: user.createdAt < 1yr → return
 *           ├─→ fetch applications + attended signups for earliest activity
 *           ├─→ computeTenure(activities) → { level, years }
 *           ├─→ for each milestone reached:
 *           │     check existing credential (upsert is idempotent via @@unique)
 *           │     issue with orgId = platform org
 *           └─→ P2002 on concurrent issue → catch + continue
 */

import { PLATFORM_ORG_SLUG } from '@/server/domain/reference-data';
import { computeTenure, MS_PER_YEAR } from '@/server/domain/volunteer-profile';
import { prisma } from '@/server/repositories/prisma';
import { getAttendedShiftsForUser } from '@/server/repositories/shiftSignupRepo';
import { listUserApplications } from '@/server/repositories/volunteer-applications';
import { upsertCredential } from '@/server/repositories/volunteerCredentialRepo';
import { ensureReferenceData } from '@/server/services/referenceDataService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Milestone levels in ascending order — used for sequential badge issuance. */
const TENURE_MILESTONES = [
	{ level: '1YR', type: 'TENURE_1YR' as const },
	{ level: '3YR', type: 'TENURE_3YR' as const },
	{ level: '5YR', type: 'TENURE_5YR' as const },
] as const;

// ---------------------------------------------------------------------------
// Platform org lookup
// ---------------------------------------------------------------------------

async function getPlatformOrgId(): Promise<string | null> {
	const org = await prisma.organization.findUnique({
		where: { slug: PLATFORM_ORG_SLUG },
		select: { id: true },
	});
	return org?.id ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the user has reached a tenure milestone and issue the
 * corresponding badge if not already held.
 *
 * Idempotent: `upsertCredential` uses `@@unique(userId, orgId, type)` —
 * calling twice issues at most one credential per type.
 *
 * Fire-and-forget safe: all errors are caught and logged.
 */
export async function checkAndIssueTenureBadges(userId: string): Promise<void> {
	try {
		// Early exit: don't query history for users who joined less than 1yr ago.
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { createdAt: true },
		});
		if (!user) return;
		if (Date.now() - user.createdAt.getTime() < MS_PER_YEAR) return;

		await ensureReferenceData();

		const platformOrgId = await getPlatformOrgId();
		if (!platformOrgId) {
			console.warn(
				'[tenureBadgeService] Platform org not found — skipping tenure check',
			);
			return;
		}

		// Gather all activity records in parallel.
		const [applications, attendedSignups] = await Promise.all([
			listUserApplications(userId),
			getAttendedShiftsForUser(userId),
		]);

		const activityRecords = [
			...applications.map((a) => ({ recordedAt: a.submittedAt })),
			...attendedSignups.map((s) => ({ recordedAt: s.createdAt })),
		];

		const { level } = computeTenure(activityRecords);
		if (level === 'NONE') return;

		// Determine which milestones have been reached.
		const reachedLevels = new Set<string>();
		if (level === '1YR' || level === '3YR' || level === '5YR')
			reachedLevels.add('1YR');
		if (level === '3YR' || level === '5YR') reachedLevels.add('3YR');
		if (level === '5YR') reachedLevels.add('5YR');

		for (const milestone of TENURE_MILESTONES) {
			if (!reachedLevels.has(milestone.level)) continue;

			try {
				// upsert is idempotent — if badge already exists, this is a no-op.
				await prisma.$transaction(async (tx) => {
					await upsertCredential(tx, {
						userId,
						orgId: platformOrgId,
						type: milestone.type,
						status: 'VERIFIED',
						issuedById: null,
					});
				});
			} catch (err: unknown) {
				// P2002 = unique constraint violation — badge already issued concurrently.
				// Not an error — log and continue to next milestone.
				const code = (err as { code?: string })?.code;
				if (code !== 'P2002') {
					console.error(
						`[tenureBadgeService] Failed to issue ${milestone.type} for user ${userId}:`,
						err,
					);
				}
			}
		}
	} catch (err) {
		// Never propagate — parent operation must not fail due to badge issuance.
		console.error(
			'[tenureBadgeService] Unexpected error in checkAndIssueTenureBadges:',
			err,
		);
	}
}
