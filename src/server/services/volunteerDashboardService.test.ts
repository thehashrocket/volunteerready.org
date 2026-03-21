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
});
