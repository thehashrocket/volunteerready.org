/**
 * Integration tests for the inviteToApply per-org rate limit. Real Postgres.
 * Run with: pnpm test:integration
 *
 * WHY THIS MUST BE AN INTEGRATION TEST
 * ------------------------------------
 * The bug is a genuine Postgres concurrency phenomenon: under READ COMMITTED,
 * two transactions can both COUNT the same N rows before either COMMITs an
 * INSERT, so both pass a `>= 10` check and 11 invitations escape a 10/day cap.
 *
 * A unit test cannot reproduce that, in principle rather than by omission. A
 * mocked `$transaction` invokes its callback once with nothing else in flight,
 * so there is no second transaction to race and no lock contention to observe —
 * the mocked version passes identically with or without the fix. The unit suite
 * therefore pins only that the lock is CALLED, and first; that it WORKS is
 * provable only here.
 *
 * The `pg.Pool` backing the Prisma adapter hands out genuinely separate
 * connections for concurrent `$transaction` calls, so `Promise.all` over
 * several `inviteToApply` calls produces real overlapping transactions rather
 * than a simulated race.
 *
 * The setup pre-seeds an org to 9 of 10 directly and then races five callers
 * for the single remaining slot. That is deliberate: racing 5 callers from 0
 * would usually pass even unfixed, because the limit is not reached. Contending
 * for the LAST slot makes the race the whole point of the test, and makes the
 * assertion exact — exactly one winner, never zero, never two.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import { inviteToApply } from '@/server/services/volunteerDiscoveryService';

const PREFIX = '__invite_ratelimit_integration__';
const RATE_LIMIT_PER_DAY = 10;

async function makeOrg() {
	return prisma.organization.create({
		data: { name: `${PREFIX}org`, slug: `${PREFIX}org` },
	});
}

async function makeUser(suffix: string) {
	return prisma.user.create({
		data: { email: `${PREFIX}${suffix}@example.test`, name: `User ${suffix}` },
	});
}

async function makeOpportunity(orgId: string) {
	return prisma.volunteerOpportunity.create({
		data: { orgId, title: `${PREFIX}opp`, description: 'integration fixture' },
	});
}

/**
 * Cleanup is scoped to this file's own PREFIX. Invitations and opportunities
 * cascade from Organization, so deleting orgs and users covers everything.
 */
afterEach(async () => {
	await prisma.organization.deleteMany({
		where: { slug: { startsWith: PREFIX } },
	});
	await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('inviteToApply rate limit under concurrency', () => {
	it('SECURITY: never exceeds the daily cap when callers race for the last slot', async () => {
		const org = await makeOrg();
		const opportunity = await makeOpportunity(org.id);
		const staff = await makeUser('staff');

		// 9 of 10 slots already used. Seeded directly — not through the service
		// under test — so the fixture cannot mask a bug in it.
		const fillers = await Promise.all(
			Array.from({ length: RATE_LIMIT_PER_DAY - 1 }, (_, i) =>
				makeUser(`filler${i}`),
			),
		);
		await prisma.volunteerInvitation.createMany({
			data: fillers.map((v) => ({
				orgId: org.id,
				volunteerId: v.id,
				opportunityId: opportunity.id,
				sentAt: new Date(),
			})),
		});

		// Five distinct volunteers, so the @@unique([orgId, volunteerId,
		// opportunityId]) constraint cannot be what limits them — the rate limit
		// has to be doing the work.
		const racers = await Promise.all(
			Array.from({ length: 5 }, (_, i) => makeUser(`racer${i}`)),
		);

		const results = await Promise.allSettled(
			racers.map((v) =>
				inviteToApply({
					volunteerId: v.id,
					opportunityId: opportunity.id,
					orgId: org.id,
					actorId: staff.id,
				}),
			),
		);

		const fulfilled = results.filter((r) => r.status === 'fulfilled');
		const rejected = results.filter(
			(r): r is PromiseRejectedResult => r.status === 'rejected',
		);

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(4);
		for (const r of rejected) {
			expect(r.reason).toMatchObject({ code: 'FORBIDDEN' });
		}

		// The assertion that fails on the pre-fix code: without the lock, several
		// racers observe 9 and all commit, landing above the cap.
		const total = await prisma.volunteerInvitation.count({
			where: { orgId: org.id },
		});
		expect(total).toBe(RATE_LIMIT_PER_DAY);
	});

	it('SECURITY: the lock is per-org — a second org is not blocked by the first', async () => {
		// A lock on a constant rather than the org id would serialize every org
		// in the platform behind one queue, and would let one org's exhausted
		// quota appear to throttle another. Both orgs start empty, so both must
		// succeed.
		const [orgA, orgB] = await Promise.all([
			prisma.organization.create({
				data: { name: `${PREFIX}a`, slug: `${PREFIX}a` },
			}),
			prisma.organization.create({
				data: { name: `${PREFIX}b`, slug: `${PREFIX}b` },
			}),
		]);
		const [oppA, oppB, volA, volB, staff] = await Promise.all([
			makeOpportunity(orgA.id),
			makeOpportunity(orgB.id),
			makeUser('vol-a'),
			makeUser('vol-b'),
			makeUser('staff2'),
		]);

		const results = await Promise.allSettled([
			inviteToApply({
				volunteerId: volA.id,
				opportunityId: oppA.id,
				orgId: orgA.id,
				actorId: staff.id,
			}),
			inviteToApply({
				volunteerId: volB.id,
				opportunityId: oppB.id,
				orgId: orgB.id,
				actorId: staff.id,
			}),
		]);

		expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
	});

	it('counts only the rolling 24h window, not all time', async () => {
		// Guards the semantics the advisory lock was chosen to PRESERVE. A counter
		// table keyed on a calendar date would pass the concurrency test above and
		// fail this one.
		const org = await makeOrg();
		const opportunity = await makeOpportunity(org.id);
		const staff = await makeUser('staff3');
		const volunteer = await makeUser('vol-old');

		const stale = await Promise.all(
			Array.from({ length: RATE_LIMIT_PER_DAY }, (_, i) =>
				makeUser(`stale${i}`),
			),
		);
		await prisma.volunteerInvitation.createMany({
			data: stale.map((v) => ({
				orgId: org.id,
				volunteerId: v.id,
				opportunityId: opportunity.id,
				// 25 hours ago — outside the window, so they must not count.
				sentAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
			})),
		});

		await expect(
			inviteToApply({
				volunteerId: volunteer.id,
				opportunityId: opportunity.id,
				orgId: org.id,
				actorId: staff.id,
			}),
		).resolves.toMatchObject({ invitationId: expect.any(String) });
	});
});
