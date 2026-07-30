/**
 * Integration tests for `countOrgsWithPopulatedRoster` (T20).
 *
 * Uses real Postgres. Requires DATABASE_URL. Run with: pnpm test:integration
 *
 * WHY THESE MUST BE INTEGRATION TESTS
 * -----------------------------------
 * This is the only hand-written SQL the roster launch adds, and every property
 * it depends on belongs to the database engine, not to Prisma:
 *
 *   1. The NULL-checked optional filters (`${x}::type IS NULL OR …`) have to
 *      actually short-circuit. A mocked client would happily "pass" a query that
 *      Postgres rejects for an untyped parameter, which is precisely the failure
 *      the repo's raw-SQL rule exists to prevent — and one that reproduces only
 *      at runtime.
 *   2. `OrgVolunteerSource` is a Postgres enum. Comparing it as text is a
 *      deliberate choice (a bare parameter cannot be inferred as an enum), and
 *      it either matches rows or silently matches none.
 *   3. `HAVING COUNT(*) >= n` over a GROUP BY joined to `Organization` is the
 *      whole reason this is not `prisma.groupBy` — the 7-day window compares two
 *      tables' `createdAt`, which Prisma's grouping API cannot express.
 *
 * The metric these back is the roster launch's primary success measure. A query
 * that silently returns 0 forever would read as "the concierge motion is not
 * working" rather than as a bug.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import { countOrgsWithPopulatedRoster } from './rosterMetricsRepo';

const PREFIX = '__rostermetrics_integration__';

const createdOrgIds: string[] = [];
const createdUserIds: string[] = [];

/**
 * Monotonic, so two `addVolunteers` calls against the same org cannot collide on
 * `User.email`. Deriving the address from the call's arguments looked unique and
 * was not — a test that adds STAFF_ADDED rows twice reuses every one.
 */
let userSeq = 0;

async function makeOrg(suffix: string, createdAt?: Date) {
	const org = await prisma.organization.create({
		data: {
			name: `${PREFIX}${suffix}`,
			slug: `${PREFIX}${suffix}`,
			...(createdAt ? { createdAt } : {}),
		},
	});
	createdOrgIds.push(org.id);
	return org;
}

/** Put `count` roster rows on `orgId`, all with the given source and date. */
async function addVolunteers(
	orgId: string,
	count: number,
	options: {
		source?: 'STAFF_ADDED' | 'APPLIED';
		createdAt?: Date;
		deleted?: boolean;
	} = {},
) {
	for (let i = 0; i < count; i++) {
		const user = await prisma.user.create({
			data: {
				email: `${PREFIX}${userSeq++}@example.test`,
				accountState: 'UNCLAIMED',
			},
		});
		createdUserIds.push(user.id);
		await prisma.orgVolunteer.create({
			data: {
				orgId,
				userId: user.id,
				displayName: `Volunteer ${i}`,
				source: options.source ?? 'STAFF_ADDED',
				...(options.createdAt ? { createdAt: options.createdAt } : {}),
				...(options.deleted ? { deletedAt: new Date() } : {}),
			},
		});
	}
}

/** Only this file's ids — never an unscoped prefix sweep (CLAUDE.md). */
afterEach(async () => {
	if (createdOrgIds.length > 0) {
		await prisma.orgVolunteer.deleteMany({
			where: { orgId: { in: createdOrgIds } },
		});
		await prisma.organization.deleteMany({
			where: { id: { in: createdOrgIds } },
		});
		createdOrgIds.length = 0;
	}
	if (createdUserIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
		createdUserIds.length = 0;
	}
});

/**
 * Counts are global, so every assertion is a DELTA against a baseline taken in
 * the same test. A worker running beside this one has its own orgs.
 */
async function delta(
	options: Parameters<typeof countOrgsWithPopulatedRoster>[0],
	act: () => Promise<void>,
) {
	const before = await countOrgsWithPopulatedRoster(options);
	await act();
	const after = await countOrgsWithPopulatedRoster(options);
	return after - before;
}

describe('threshold', () => {
	it('counts an org at exactly the threshold', async () => {
		const org = await makeOrg('at-threshold');
		expect(await delta({ threshold: 3 }, () => addVolunteers(org.id, 3))).toBe(
			1,
		);
	});

	it('does not count an org one row short', async () => {
		const org = await makeOrg('below');
		expect(await delta({ threshold: 3 }, () => addVolunteers(org.id, 2))).toBe(
			0,
		);
	});

	it('counts an org once, not once per row', async () => {
		// The GROUP BY is what makes this a count of ORGS. Without it the outer
		// COUNT(*) would report rows and the metric would read wildly high.
		const org = await makeOrg('many');
		expect(await delta({ threshold: 3 }, () => addVolunteers(org.id, 25))).toBe(
			1,
		);
	});
});

describe('soft deletes', () => {
	it('excludes soft-deleted rows from the count', async () => {
		// A roster someone emptied is not a populated roster, and a volunteer who
		// left must not keep an org counted as activated.
		const org = await makeOrg('softdel');
		expect(
			await delta({ threshold: 3 }, async () => {
				await addVolunteers(org.id, 2);
				await addVolunteers(org.id, 3, { deleted: true });
			}),
		).toBe(0);
	});
});

describe('source filter', () => {
	it('counts every source when none is given', async () => {
		const org = await makeOrg('anysource');
		expect(
			await delta({ threshold: 4 }, async () => {
				await addVolunteers(org.id, 2, { source: 'STAFF_ADDED' });
				await addVolunteers(org.id, 2, { source: 'APPLIED' });
			}),
		).toBe(1);
	});

	it('counts only the named source when one is given', async () => {
		// The same fixture that clears the unfiltered threshold must NOT clear a
		// STAFF_ADDED-only one — otherwise the filter is silently a no-op, which
		// is exactly how an enum compared as text fails.
		const org = await makeOrg('staffonly');
		expect(
			await delta({ threshold: 4, source: 'STAFF_ADDED' }, async () => {
				await addVolunteers(org.id, 2, { source: 'STAFF_ADDED' });
				await addVolunteers(org.id, 2, { source: 'APPLIED' });
			}),
		).toBe(0);
	});

	it('matches the enum value it was given', async () => {
		const org = await makeOrg('applied');
		expect(
			await delta({ threshold: 3, source: 'APPLIED' }, () =>
				addVolunteers(org.id, 3, { source: 'APPLIED' }),
			),
		).toBe(1);
	});

	it('treats an explicit null source as "any source"', async () => {
		const org = await makeOrg('nullsource');
		expect(
			await delta({ threshold: 3, source: null }, () =>
				addVolunteers(org.id, 3, { source: 'APPLIED' }),
			),
		).toBe(1);
	});
});

describe('the signup window', () => {
	it('counts rows added inside the window', async () => {
		const signup = new Date('2026-01-01T00:00:00Z');
		const org = await makeOrg('inwindow', signup);
		expect(
			await delta({ threshold: 3, withinDaysOfSignup: 7 }, () =>
				addVolunteers(org.id, 3, {
					createdAt: new Date('2026-01-04T00:00:00Z'),
				}),
			),
		).toBe(1);
	});

	it('excludes rows added after the window closes', async () => {
		// This is the axis that distinguishes "the concierge motion worked" from
		// "a roster eventually filled up". If the window silently never applied,
		// the success metric would be indistinguishable from funnel step 5.
		const signup = new Date('2026-01-01T00:00:00Z');
		const org = await makeOrg('outwindow', signup);
		expect(
			await delta({ threshold: 3, withinDaysOfSignup: 7 }, () =>
				addVolunteers(org.id, 3, {
					createdAt: new Date('2026-02-01T00:00:00Z'),
				}),
			),
		).toBe(0);
	});

	it('counts rows at any time when no window is given', async () => {
		const signup = new Date('2026-01-01T00:00:00Z');
		const org = await makeOrg('nowindow', signup);
		expect(
			await delta({ threshold: 3 }, () =>
				addVolunteers(org.id, 3, {
					createdAt: new Date('2027-06-01T00:00:00Z'),
				}),
			),
		).toBe(1);
	});

	it('needs the threshold met INSIDE the window, not overall', async () => {
		// Two in the first week and two later is not an activated org, even though
		// the roster has four rows.
		const signup = new Date('2026-01-01T00:00:00Z');
		const org = await makeOrg('partialwindow', signup);
		expect(
			await delta({ threshold: 4, withinDaysOfSignup: 7 }, async () => {
				await addVolunteers(org.id, 2, {
					createdAt: new Date('2026-01-02T00:00:00Z'),
				});
				await addVolunteers(org.id, 2, {
					createdAt: new Date('2026-03-02T00:00:00Z'),
				});
			}),
		).toBe(0);
	});
});

describe('the two filters together', () => {
	it('applies source AND window, which is the launch success metric', async () => {
		const signup = new Date('2026-01-01T00:00:00Z');
		const org = await makeOrg('both', signup);
		const metric = {
			threshold: 3,
			source: 'STAFF_ADDED' as const,
			withinDaysOfSignup: 7,
		};

		expect(
			await delta(metric, async () => {
				// Right source, wrong time.
				await addVolunteers(org.id, 3, {
					source: 'STAFF_ADDED',
					createdAt: new Date('2026-05-01T00:00:00Z'),
				});
				// Right time, wrong source.
				await addVolunteers(org.id, 3, {
					source: 'APPLIED',
					createdAt: new Date('2026-01-02T00:00:00Z'),
				});
			}),
		).toBe(0);

		expect(
			await delta(metric, () =>
				addVolunteers(org.id, 3, {
					source: 'STAFF_ADDED',
					createdAt: new Date('2026-01-03T00:00:00Z'),
				}),
			),
		).toBe(1);
	});
});
