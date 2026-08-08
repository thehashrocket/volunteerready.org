/**
 * Unit tests for volunteerDashboardService.
 *
 * Prisma is mocked — tests verify query orchestration, DB-side aggregation
 * result mapping, and edge cases (zero shifts, no applications, null expiresAt).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
	shiftSignup: { findMany: vi.fn() },
	volunteerApplication: { findMany: vi.fn() },
	volunteerCredential: { findMany: vi.fn(), count: vi.fn() },
	volunteerOpportunity: { findMany: vi.fn() },
	$queryRaw: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: mockPrisma,
}));

import { CREDENTIAL_EXPIRY_WARNING_DAYS } from '@/server/domain/credential-expiry';
import { getVolunteerDashboard } from './volunteerDashboardService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-vol-123';

const SHIFT_SIGNUP = {
	id: 'signup-1',
	shift: {
		id: 'shift-1',
		title: 'Park Cleanup',
		startTime: new Date('2026-04-01T09:00:00Z'),
		endTime: new Date('2026-04-01T12:00:00Z'),
		location: 'Central Park',
		organization: { id: 'org-1', name: 'Green Org', slug: 'green-org' },
	},
};

const APPLICATION = {
	id: 'app-1',
	status: 'SUBMITTED',
	submittedAt: new Date('2026-03-15'),
	opportunity: { id: 'opp-1', title: 'Tutor' },
	organization: { id: 'org-1', name: 'Green Org', slug: 'green-org' },
};

const CREDENTIAL = {
	id: 'cred-1',
	type: 'BACKGROUND_CHECK',
	expiresAt: new Date('2026-04-10'),
	organization: { id: 'org-1', name: 'Green Org' },
};

const OPPORTUNITY = {
	id: 'opp-1',
	title: 'Tutor',
	isRemote: false,
	location: 'Library',
	organization: { id: 'org-1', name: 'Green Org', slug: 'green-org' },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();

	// Default: empty results
	mockPrisma.shiftSignup.findMany.mockResolvedValue([]);
	mockPrisma.volunteerApplication.findMany.mockResolvedValue([]);
	mockPrisma.volunteerCredential.findMany.mockResolvedValue([]);
	mockPrisma.volunteerCredential.count.mockResolvedValue(0);
	mockPrisma.$queryRaw.mockResolvedValue([
		{ total_minutes: 0n, orgs_served: 0n, shifts_attended: 0n },
	]);
	mockPrisma.volunteerOpportunity.findMany.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getVolunteerDashboard', () => {
	it('returns empty dashboard for user with no activity', async () => {
		const result = await getVolunteerDashboard(USER_ID);

		expect(result.upcomingShifts).toEqual([]);
		expect(result.pendingApplications).toEqual([]);
		expect(result.expiringCredentials).toEqual([]);
		expect(result.impact).toEqual({
			totalHours: 0,
			orgsServed: 0,
			shiftsAttended: 0,
			verifiedCredentials: 0,
		});
		expect(result.recommendedOpportunities).toEqual([]);
	});

	it('returns upcoming shifts when present', async () => {
		mockPrisma.shiftSignup.findMany.mockResolvedValue([SHIFT_SIGNUP]);

		const result = await getVolunteerDashboard(USER_ID);

		expect(result.upcomingShifts).toHaveLength(1);
		expect(result.upcomingShifts[0].shift.title).toBe('Park Cleanup');
	});

	it('returns pending applications when present', async () => {
		mockPrisma.volunteerApplication.findMany.mockResolvedValue([APPLICATION]);

		const result = await getVolunteerDashboard(USER_ID);

		expect(result.pendingApplications).toHaveLength(1);
		expect(result.pendingApplications[0].status).toBe('SUBMITTED');
	});

	it('returns expiring credentials when present', async () => {
		mockPrisma.volunteerCredential.findMany.mockResolvedValue([CREDENTIAL]);

		const result = await getVolunteerDashboard(USER_ID);

		expect(result.expiringCredentials).toHaveLength(1);
		expect(result.expiringCredentials[0].type).toBe('BACKGROUND_CHECK');
	});

	it('maps DB-side aggregation for impact stats correctly', async () => {
		mockPrisma.$queryRaw.mockResolvedValue([
			{ total_minutes: 360n, orgs_served: 2n, shifts_attended: 5n },
		]);
		mockPrisma.volunteerCredential.count.mockResolvedValue(3);

		const result = await getVolunteerDashboard(USER_ID);

		expect(result.impact).toEqual({
			totalHours: 6, // 360 minutes = 6 hours
			orgsServed: 2,
			shiftsAttended: 5,
			verifiedCredentials: 3,
		});
	});

	it('rounds total hours correctly', async () => {
		// 100 minutes = 1.67 hours → rounds to 2
		mockPrisma.$queryRaw.mockResolvedValue([
			{ total_minutes: 100n, orgs_served: 1n, shifts_attended: 1n },
		]);

		const result = await getVolunteerDashboard(USER_ID);

		expect(result.impact.totalHours).toBe(2);
	});

	it('handles null total_minutes from DB', async () => {
		mockPrisma.$queryRaw.mockResolvedValue([
			{ total_minutes: null, orgs_served: 0n, shifts_attended: 0n },
		]);

		const result = await getVolunteerDashboard(USER_ID);

		expect(result.impact.totalHours).toBe(0);
	});

	it('returns recommended opportunities from interacted orgs', async () => {
		// First call: upcoming shifts. Second call: applications for recommendations
		mockPrisma.volunteerApplication.findMany
			.mockResolvedValueOnce([]) // pending applications query
			.mockResolvedValueOnce([{ orgId: 'org-1' }]); // distinct orgIds query

		mockPrisma.volunteerOpportunity.findMany.mockResolvedValue([OPPORTUNITY]);

		const result = await getVolunteerDashboard(USER_ID);

		expect(result.recommendedOpportunities).toHaveLength(1);
		expect(result.recommendedOpportunities[0].title).toBe('Tutor');
	});

	it('returns empty recommendations when no prior applications', async () => {
		// Both application queries return empty
		mockPrisma.volunteerApplication.findMany.mockResolvedValue([]);

		const result = await getVolunteerDashboard(USER_ID);

		expect(result.recommendedOpportunities).toEqual([]);
	});

	// -----------------------------------------------------------------------
	// The shared expiry window
	// -----------------------------------------------------------------------

	describe('expiring-credential window', () => {
		// This query and the staff notifier's must name the same number of days,
		// and so must the copy on this page and on /screening. That is the entire
		// reason CREDENTIAL_EXPIRY_WARNING_DAYS exists — before it, the literal
		// `30` here was unbound from everything else. Nothing asserted the window
		// at all: the existing "returns expiring credentials when present" test
		// mocks the result, so the `where` it was selected by is invisible and the
		// constant could be narrowed to 14 with the whole suite still green while
		// /screening kept promising 30.

		it('queries exactly the shared warning window ahead of now', async () => {
			const before = Date.now();
			await getVolunteerDashboard(USER_ID);
			const after = Date.now();

			const [args] = mockPrisma.volunteerCredential.findMany.mock.calls[0];
			const { gte, lte } = args.where.expiresAt;

			expect(lte.getTime() - gte.getTime()).toBe(
				CREDENTIAL_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000,
			);
			expect(gte.getTime()).toBeGreaterThanOrEqual(before);
			expect(gte.getTime()).toBeLessThanOrEqual(after);
		});

		it('bounds the window below at now, so a lapsed credential is not "expiring soon"', async () => {
			// The lower bound is what keeps this disjoint from the already-expired
			// set the cron sweeps. Dropping `gte` would surface years of dead
			// credentials on a volunteer's dashboard as upcoming expiries.
			await getVolunteerDashboard(USER_ID);

			const [args] = mockPrisma.volunteerCredential.findMany.mock.calls[0];
			expect(args.where.expiresAt.gte).toBeInstanceOf(Date);
			expect(args.where.status).toBe('VERIFIED');
			expect(args.where.userId).toBe(USER_ID);
		});
	});

	// -----------------------------------------------------------------------
	// The orphan-application leak
	// -----------------------------------------------------------------------

	describe('SECURITY: orphan applications are never matched by email', () => {
		// Both application queries used to OR in
		// `{ submittedByEmail: email, submittedByUserId: null }`. That was wrong
		// twice: `screener.submit` is public, so anyone could plant an orphan row
		// bearing a victim's address and have it render on the victim's dashboard and
		// steer their recommendations toward the planting org; and the address came
		// from `session.user.email`, which under impersonation is the REAL ADMIN'S
		// while the id is the target's.
		//
		// An unlinked application becomes visible by exactly one route now: the user
		// claiming it.

		it('scopes both application queries to submittedByUserId alone', async () => {
			await getVolunteerDashboard(USER_ID);

			expect(mockPrisma.volunteerApplication.findMany).toHaveBeenCalledTimes(2);

			for (const [args] of mockPrisma.volunteerApplication.findMany.mock
				.calls) {
				expect(args.where.submittedByUserId).toBe(USER_ID);
				// No OR branch at all — its mere presence is the bug.
				expect(args.where).not.toHaveProperty('OR');
				expect(JSON.stringify(args.where)).not.toContain('submittedByEmail');
			}
		});

		it('accepts no email argument, so no caller can reintroduce the pairing', async () => {
			// The signature is the real fix. While the parameter existed, every call
			// site was one `session.user.email` away from restoring the leak.
			expect(getVolunteerDashboard).toHaveLength(1);
		});
	});
});
