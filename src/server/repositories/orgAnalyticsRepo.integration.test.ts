/**
 * Integration tests for orgAnalyticsRepo.
 *
 * Uses real Postgres (Docker: volunteer-match-postgres).
 * Requires DATABASE_URL to be set to the dev/test database.
 *
 * Run with: pnpm test:integration
 *
 * Schema coupling: if column names change, these tests will catch the drift
 * before it reaches production (unlike unit tests with mocked Prisma).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import {
	getApplicationFunnel,
	getAvgFillRate,
	getRetentionStats,
	getTopVolunteers,
} from './orgAnalyticsRepo';

// ---------------------------------------------------------------------------
// Unique prefix — isolates test data from real data
// ---------------------------------------------------------------------------

const PREFIX = '__analytics_integration__';

// ---------------------------------------------------------------------------
// Seeding helpers
// ---------------------------------------------------------------------------

async function seedOrg(suffix: string) {
	return prisma.organization.create({
		data: {
			name: `${PREFIX}${suffix}`,
			slug: `${PREFIX}${suffix}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
		},
	});
}

async function seedUser(suffix: string) {
	return prisma.user.create({
		data: { email: `${PREFIX}${suffix}@test.example`, name: `Vol ${suffix}` },
	});
}

async function seedApplication(
	orgId: string,
	opts?: { status?: string; submittedAt?: Date },
) {
	return prisma.volunteerApplication.create({
		data: {
			orgId,
			submittedByEmail: `${PREFIX}${Date.now()}@test.example`,
			status: (opts?.status as any) ?? 'SUBMITTED',
			submittedAt: opts?.submittedAt ?? new Date(),
		},
	});
}

async function seedShift(
	orgId: string,
	opts?: {
		startTime?: Date;
		endTime?: Date;
		capacity?: number;
		status?: string;
	},
) {
	const start = opts?.startTime ?? new Date('2026-01-01T09:00:00Z');
	const end = opts?.endTime ?? new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours after start
	return prisma.shift.create({
		data: {
			orgId,
			title: `${PREFIX}shift`,
			startTime: start,
			endTime: end,
			capacity: opts?.capacity ?? 10,
			status: (opts?.status as any) ?? 'OPEN',
		},
	});
}

async function seedSignup(
	shiftId: string,
	userId: string,
	opts?: { status?: string; createdAt?: Date },
) {
	return prisma.shiftSignup.create({
		data: {
			shiftId,
			userId,
			status: (opts?.status as any) ?? 'CONFIRMED',
			createdAt: opts?.createdAt ?? new Date(),
		},
	});
}

async function seedCredential(
	userId: string,
	orgId: string,
	opts?: { status?: string; issuedAt?: Date },
) {
	return prisma.volunteerCredential.create({
		data: {
			userId,
			orgId,
			type: 'BACKGROUND_CHECK',
			status: (opts?.status as any) ?? 'VERIFIED',
			issuedAt: opts?.issuedAt ?? new Date(),
		},
	});
}

// ---------------------------------------------------------------------------
// Cleanup — delete all test data by PREFIX
// ---------------------------------------------------------------------------

afterEach(async () => {
	// Find all test orgs
	const orgs = await prisma.organization.findMany({
		where: { name: { startsWith: PREFIX } },
		select: { id: true },
	});
	const orgIds = orgs.map((o) => o.id);

	// Find all test users
	const users = await prisma.user.findMany({
		where: { email: { startsWith: PREFIX } },
		select: { id: true },
	});
	const userIds = users.map((u) => u.id);

	if (orgIds.length > 0 || userIds.length > 0) {
		// Delete in FK-safe order
		if (userIds.length > 0) {
			await prisma.volunteerCredential.deleteMany({
				where: { userId: { in: userIds } },
			});
			await prisma.shiftSignup.deleteMany({
				where: { userId: { in: userIds } },
			});
		}
		if (orgIds.length > 0) {
			await prisma.shiftSignup.deleteMany({
				where: { shift: { orgId: { in: orgIds } } },
			});
			await prisma.shift.deleteMany({ where: { orgId: { in: orgIds } } });
			await prisma.volunteerApplication.deleteMany({
				where: { orgId: { in: orgIds } },
			});
			await prisma.volunteerCredential.deleteMany({
				where: { orgId: { in: orgIds } },
			});
		}
		if (orgIds.length > 0) {
			await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
		}
		if (userIds.length > 0) {
			await prisma.user.deleteMany({ where: { id: { in: userIds } } });
		}
	}
});

// ---------------------------------------------------------------------------
// getApplicationFunnel
// ---------------------------------------------------------------------------

describe('getApplicationFunnel', () => {
	it('returns zeros for an org with no data', async () => {
		const org = await seedOrg('funnel-empty');
		const epoch = new Date(0);

		const result = await getApplicationFunnel(org.id, epoch);

		expect(result).toEqual({
			submitted: 0,
			approved: 0,
			shifted: 0,
			credentialed: 0,
		});
	});

	it('counts submitted applications within the date window', async () => {
		const org = await seedOrg('funnel-submitted');
		const past = new Date('2025-01-01T00:00:00Z');
		const recentCutoff = new Date('2026-01-01T00:00:00Z');

		// Two applications after cutoff, one before
		await seedApplication(org.id, { submittedAt: new Date('2026-02-01') });
		await seedApplication(org.id, { submittedAt: new Date('2026-03-01') });
		await seedApplication(org.id, { submittedAt: past }); // before cutoff

		const result = await getApplicationFunnel(org.id, recentCutoff);

		expect(result.submitted).toBe(2);
	});

	it('counts only APPROVED applications for the approved stage', async () => {
		const org = await seedOrg('funnel-approved');
		const epoch = new Date(0);

		await seedApplication(org.id, { status: 'APPROVED' });
		await seedApplication(org.id, { status: 'APPROVED' });
		await seedApplication(org.id, { status: 'SUBMITTED' }); // not approved

		const result = await getApplicationFunnel(org.id, epoch);

		expect(result.submitted).toBe(3);
		expect(result.approved).toBe(2);
	});

	it('counts distinct users who ATTENDED at least one shift (shifted)', async () => {
		const org = await seedOrg('funnel-shifted');
		const epoch = new Date(0);
		const u1 = await seedUser('funnel-s-u1');
		const u2 = await seedUser('funnel-s-u2');
		const shift = await seedShift(org.id);

		// u1 attended twice (deduplicated), u2 attended once
		await seedSignup(shift.id, u1.id, { status: 'ATTENDED' });
		await seedSignup(shift.id, u2.id, { status: 'ATTENDED' });

		const result = await getApplicationFunnel(org.id, epoch);

		expect(result.shifted).toBe(2);
	});

	it('does not count CONFIRMED signups in the shifted stage (ATTENDED only)', async () => {
		const org = await seedOrg('funnel-confirmed-not-shifted');
		const epoch = new Date(0);
		const user = await seedUser('funnel-cns-u1');
		const shift = await seedShift(org.id);

		await seedSignup(shift.id, user.id, { status: 'CONFIRMED' }); // confirmed, not attended

		const result = await getApplicationFunnel(org.id, epoch);

		expect(result.shifted).toBe(0);
	});

	it('counts distinct users with VERIFIED credentials in the period (credentialed)', async () => {
		const org = await seedOrg('funnel-credentialed');
		const recentCutoff = new Date('2026-01-01T00:00:00Z');
		const u1 = await seedUser('funnel-cred-u1');
		const u2 = await seedUser('funnel-cred-u2');

		// u1 has a VERIFIED credential issued after cutoff
		await seedCredential(u1.id, org.id, {
			status: 'VERIFIED',
			issuedAt: new Date('2026-02-01'),
		});
		// u2 has a VERIFIED credential but issued before cutoff
		await seedCredential(u2.id, org.id, {
			status: 'VERIFIED',
			issuedAt: new Date('2025-01-01'),
		});

		const result = await getApplicationFunnel(org.id, recentCutoff);

		expect(result.credentialed).toBe(1); // only u1
	});

	it('isolates data to the specified org (other org data not counted)', async () => {
		const org1 = await seedOrg('funnel-iso-1');
		const org2 = await seedOrg('funnel-iso-2');

		await seedApplication(org1.id);
		await seedApplication(org1.id);
		await seedApplication(org2.id); // different org

		const result = await getApplicationFunnel(org1.id, new Date(0));

		expect(result.submitted).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// getRetentionStats
// ---------------------------------------------------------------------------

describe('getRetentionStats', () => {
	it('returns zeros for an org with no shift activity', async () => {
		const org = await seedOrg('retention-empty');

		const result = await getRetentionStats(org.id, new Date('2026-01-01'));

		expect(result).toEqual({ activeVolunteers: 0, returningVolunteers: 0 });
	});

	it('counts active volunteers (ATTENDED or CONFIRMED) in the current period', async () => {
		const org = await seedOrg('retention-active');
		const fromDate = new Date('2026-01-01T00:00:00Z');
		const u1 = await seedUser('ret-active-u1');
		const u2 = await seedUser('ret-active-u2');
		const shift = await seedShift(org.id);

		await seedSignup(shift.id, u1.id, {
			status: 'ATTENDED',
			createdAt: new Date('2026-02-01'),
		});
		await seedSignup(shift.id, u2.id, {
			status: 'CONFIRMED',
			createdAt: new Date('2026-02-01'),
		});

		const result = await getRetentionStats(org.id, fromDate);

		expect(result.activeVolunteers).toBe(2);
	});

	it('identifies returning volunteers (active now AND had prior activity)', async () => {
		const org = await seedOrg('retention-returning');
		const fromDate = new Date('2026-01-01T00:00:00Z');
		const returning = await seedUser('ret-returning-u1');
		const newVol = await seedUser('ret-new-u1');
		const oldShift = await seedShift(org.id);
		const newShift = await seedShift(org.id);

		// returning: active before AND after fromDate
		await seedSignup(oldShift.id, returning.id, {
			status: 'ATTENDED',
			createdAt: new Date('2025-06-01'), // before fromDate
		});
		const returnShift = await seedShift(org.id);
		await seedSignup(returnShift.id, returning.id, {
			status: 'ATTENDED',
			createdAt: new Date('2026-02-01'), // after fromDate
		});

		// new volunteer: only after fromDate
		await seedSignup(newShift.id, newVol.id, {
			status: 'ATTENDED',
			createdAt: new Date('2026-02-15'),
		});

		const result = await getRetentionStats(org.id, fromDate);

		expect(result.activeVolunteers).toBe(2);
		expect(result.returningVolunteers).toBe(1); // only `returning`
	});

	it('does not count a volunteer as returning if they only have prior activity', async () => {
		const org = await seedOrg('retention-prior-only');
		const fromDate = new Date('2026-01-01T00:00:00Z');
		const user = await seedUser('ret-prior-only-u1');
		const shift = await seedShift(org.id);

		// Activity only before fromDate
		await seedSignup(shift.id, user.id, {
			status: 'ATTENDED',
			createdAt: new Date('2025-06-01'),
		});

		const result = await getRetentionStats(org.id, fromDate);

		// Not active in current period — should not appear at all
		expect(result.activeVolunteers).toBe(0);
		expect(result.returningVolunteers).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// getAvgFillRate
// ---------------------------------------------------------------------------

describe('getAvgFillRate', () => {
	it('returns 0 for an org with no shifts', async () => {
		const org = await seedOrg('fillrate-empty');

		const result = await getAvgFillRate(org.id, new Date(0));

		expect(result).toBe(0);
	});

	it('returns 0 for an org where all shifts are CANCELLED', async () => {
		const org = await seedOrg('fillrate-cancelled');

		await seedShift(org.id, {
			status: 'CANCELLED',
			capacity: 10,
			startTime: new Date('2026-01-15'),
		});

		const result = await getAvgFillRate(org.id, new Date('2026-01-01'));

		expect(result).toBe(0);
	});

	it('computes fill rate as a 0–100 integer for fully-filled shifts', async () => {
		const org = await seedOrg('fillrate-full');
		const u1 = await seedUser('fill-u1');
		const u2 = await seedUser('fill-u2');

		const shift = await seedShift(org.id, {
			capacity: 2,
			startTime: new Date('2026-01-15T09:00:00Z'),
			endTime: new Date('2026-01-15T11:00:00Z'),
		});
		await seedSignup(shift.id, u1.id, { status: 'CONFIRMED' });
		await seedSignup(shift.id, u2.id, { status: 'ATTENDED' });

		const result = await getAvgFillRate(org.id, new Date('2026-01-01'));

		expect(result).toBe(100);
	});

	it('computes fill rate for a half-filled shift', async () => {
		const org = await seedOrg('fillrate-half');
		const user = await seedUser('fill-half-u1');

		const shift = await seedShift(org.id, {
			capacity: 4,
			startTime: new Date('2026-01-15T09:00:00Z'),
			endTime: new Date('2026-01-15T11:00:00Z'),
		});
		await seedSignup(shift.id, user.id, { status: 'CONFIRMED' });

		const result = await getAvgFillRate(org.id, new Date('2026-01-01'));

		expect(result).toBe(25); // 1/4 = 25%
	});

	it('only counts CONFIRMED and ATTENDED signups toward fill rate', async () => {
		const org = await seedOrg('fillrate-status');
		const u1 = await seedUser('fill-stat-u1');
		const u2 = await seedUser('fill-stat-u2');
		const u3 = await seedUser('fill-stat-u3');

		const shift = await seedShift(org.id, {
			capacity: 10,
			startTime: new Date('2026-01-15T09:00:00Z'),
			endTime: new Date('2026-01-15T11:00:00Z'),
		});
		await seedSignup(shift.id, u1.id, { status: 'CONFIRMED' });
		await seedSignup(shift.id, u2.id, { status: 'ATTENDED' });
		await seedSignup(shift.id, u3.id, { status: 'CANCELLED' }); // should not count

		const result = await getAvgFillRate(org.id, new Date('2026-01-01'));

		expect(result).toBe(20); // 2/10 = 20%
	});

	it('only includes shifts starting after fromDate', async () => {
		const org = await seedOrg('fillrate-date');
		const user = await seedUser('fill-date-u1');
		const fromDate = new Date('2026-02-01T00:00:00Z');

		// Old shift before fromDate (100% full)
		const oldShift = await seedShift(org.id, {
			capacity: 1,
			startTime: new Date('2025-12-01T09:00:00Z'),
			endTime: new Date('2025-12-01T11:00:00Z'),
		});
		await seedSignup(oldShift.id, user.id, { status: 'CONFIRMED' });

		// New shift after fromDate (0% full)
		await seedShift(org.id, {
			capacity: 10,
			startTime: new Date('2026-03-01T09:00:00Z'),
			endTime: new Date('2026-03-01T11:00:00Z'),
		});

		const result = await getAvgFillRate(org.id, fromDate);

		expect(result).toBe(0); // only the empty new shift counts
	});
});

// ---------------------------------------------------------------------------
// getTopVolunteers
// ---------------------------------------------------------------------------

describe('getTopVolunteers', () => {
	it('returns empty array for an org with no ATTENDED shifts', async () => {
		const org = await seedOrg('topvol-empty');

		const result = await getTopVolunteers(org.id, 10);

		expect(result).toEqual([]);
	});

	it('returns volunteers sorted by totalHours descending', async () => {
		const org = await seedOrg('topvol-sort');
		const u1 = await seedUser('topvol-sort-u1');
		const u2 = await seedUser('topvol-sort-u2');

		// u1 gets a 4-hour shift, u2 gets a 2-hour shift
		const shift1 = await seedShift(org.id, {
			startTime: new Date('2026-01-10T09:00:00Z'),
			endTime: new Date('2026-01-10T13:00:00Z'), // 4 hours
		});
		const shift2 = await seedShift(org.id, {
			startTime: new Date('2026-01-11T09:00:00Z'),
			endTime: new Date('2026-01-11T11:00:00Z'), // 2 hours
		});

		await seedSignup(shift1.id, u1.id, { status: 'ATTENDED' });
		await seedSignup(shift2.id, u2.id, { status: 'ATTENDED' });

		const result = await getTopVolunteers(org.id, 10);

		expect(result[0].userId).toBe(u1.id);
		expect(result[0].totalHours).toBeCloseTo(4.0, 1);
		expect(result[1].userId).toBe(u2.id);
		expect(result[1].totalHours).toBeCloseTo(2.0, 1);
	});

	it('respects the limit parameter', async () => {
		const org = await seedOrg('topvol-limit');
		const shift = await seedShift(org.id, {
			startTime: new Date('2026-01-10T09:00:00Z'),
			endTime: new Date('2026-01-10T11:00:00Z'),
		});

		// Create 5 volunteers, all with ATTENDED signups
		for (let i = 0; i < 5; i++) {
			const u = await seedUser(`topvol-limit-u${i}`);
			// Need separate shifts since ShiftSignup has unique(shiftId, userId)
			const s = await seedShift(org.id, {
				startTime: new Date(`2026-01-${10 + i}T09:00:00Z`),
				endTime: new Date(`2026-01-${10 + i}T11:00:00Z`),
			});
			await seedSignup(s.id, u.id, { status: 'ATTENDED' });
		}

		const result = await getTopVolunteers(org.id, 3);

		expect(result).toHaveLength(3);
	});

	it('does not count CONFIRMED (non-ATTENDED) signups toward hours', async () => {
		const org = await seedOrg('topvol-attended-only');
		const user = await seedUser('topvol-ao-u1');
		const shift = await seedShift(org.id, {
			startTime: new Date('2026-01-10T09:00:00Z'),
			endTime: new Date('2026-01-10T11:00:00Z'),
		});

		await seedSignup(shift.id, user.id, { status: 'CONFIRMED' }); // not ATTENDED

		const result = await getTopVolunteers(org.id, 10);

		expect(result).toHaveLength(0);
	});

	it('counts verified credentials for the org', async () => {
		const org = await seedOrg('topvol-creds');
		const user = await seedUser('topvol-cred-u1');
		const shift = await seedShift(org.id, {
			startTime: new Date('2026-01-10T09:00:00Z'),
			endTime: new Date('2026-01-10T11:00:00Z'),
		});

		await seedSignup(shift.id, user.id, { status: 'ATTENDED' });
		await seedCredential(user.id, org.id, { status: 'VERIFIED' });
		await seedCredential(user.id, org.id, { status: 'PENDING' }); // not verified

		const result = await getTopVolunteers(org.id, 10);

		expect(result[0].verifiedCredentialCount).toBe(1);
	});

	it('returns correct shape with displayName and lastActiveAt', async () => {
		const org = await seedOrg('topvol-shape');
		const user = await seedUser('topvol-shape-u1');
		const shift = await seedShift(org.id, {
			startTime: new Date('2026-01-10T09:00:00Z'),
			endTime: new Date('2026-01-10T11:00:00Z'),
		});

		await seedSignup(shift.id, user.id, { status: 'ATTENDED' });

		const result = await getTopVolunteers(org.id, 10);

		expect(result[0].userId).toBe(user.id);
		expect(result[0].displayName).toBe('Vol topvol-shape-u1');
		expect(result[0].totalHours).toBeCloseTo(2.0, 1);
		expect(result[0].lastActiveAt).toBeInstanceOf(Date);
	});

	it('isolates data to the specified org', async () => {
		const org1 = await seedOrg('topvol-iso-1');
		const org2 = await seedOrg('topvol-iso-2');
		const u1 = await seedUser('topvol-iso-u1');
		const u2 = await seedUser('topvol-iso-u2');

		const shift1 = await seedShift(org1.id, {
			startTime: new Date('2026-01-10T09:00:00Z'),
			endTime: new Date('2026-01-10T11:00:00Z'),
		});
		const shift2 = await seedShift(org2.id, {
			startTime: new Date('2026-01-10T09:00:00Z'),
			endTime: new Date('2026-01-10T11:00:00Z'),
		});

		await seedSignup(shift1.id, u1.id, { status: 'ATTENDED' });
		await seedSignup(shift2.id, u2.id, { status: 'ATTENDED' });

		const result = await getTopVolunteers(org1.id, 10);

		expect(result).toHaveLength(1);
		expect(result[0].userId).toBe(u1.id);
	});
});
