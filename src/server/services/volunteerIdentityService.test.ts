/**
 * Tests for volunteerIdentityService — public profile assembly.
 *
 * Covers: visibility gate, PII exclusion, hours/orgCount calculation,
 * VERIFIED-only credentials, null for not-found.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/volunteerProfileRepo', () => ({
	getProfileWithUser: vi.fn(),
}));
vi.mock('@/server/repositories/volunteerCredentialRepo', () => ({
	getCredentialsByUserId: vi.fn(),
}));
vi.mock('@/server/repositories/shiftSignupRepo', () => ({
	getAttendedShiftsForUser: vi.fn(),
	getSignupsForReliability: vi.fn(),
	getConfirmedShiftsForUser: vi.fn(),
	getUpcomingSignupsForUser: vi.fn(),
}));
vi.mock('@/server/services/orgVolunteerAccessService', () => ({
	getOrgVolunteerRelationship: vi.fn(),
}));

import {
	getAttendedShiftsForUser,
	getSignupsForReliability,
} from '@/server/repositories/shiftSignupRepo';
import { getCredentialsByUserId } from '@/server/repositories/volunteerCredentialRepo';
import { getProfileWithUser } from '@/server/repositories/volunteerProfileRepo';
import { getOrgVolunteerRelationship } from '@/server/services/orgVolunteerAccessService';
import {
	getOrgVisibleProfile,
	getPublicProfile,
} from './volunteerIdentityService';

const mockGetProfileWithUser = vi.mocked(getProfileWithUser);
const mockGetCredentialsByUserId = vi.mocked(getCredentialsByUserId);
const mockGetAttendedShifts = vi.mocked(getAttendedShiftsForUser);
const mockGetSignups = vi.mocked(getSignupsForReliability);
const mockGetRelationship = vi.mocked(getOrgVolunteerRelationship);

const ORG_ID = 'org-1';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_DATE = new Date('2025-01-01T00:00:00Z');
const MEMBER_SINCE = new Date('2023-06-01T00:00:00Z');

function makeProfile(visibility: string) {
	const profile = {
		userId: 'user-1',
		bio: 'Loves volunteering',
		city: 'Austin',
		state: 'TX',
		country: 'US',
		availability: 'WEEKENDS',
		interests: [],
		visibility,
		createdAt: BASE_DATE,
		updatedAt: BASE_DATE,
		phone: '555-secret', // PII — should never appear in public profile
		user: {
			name: 'Jane Doe',
			email: 'jane@secret.com', // PII
			image: null,
			createdAt: MEMBER_SINCE,
		},
	};
	// biome-ignore lint/suspicious/noExplicitAny: test fixture
	return profile as any;
}

function makeShift(orgId: string, hours: number, createdAt = BASE_DATE) {
	const startTime = new Date('2024-10-01T09:00:00Z');
	const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);
	const shift = {
		userId: 'user-1',
		status: 'ATTENDED',
		createdAt,
		shift: { startTime, endTime, orgId },
	};
	// biome-ignore lint/suspicious/noExplicitAny: test fixture
	return shift as any;
}

function makeCredential(status: string, type = 'BACKGROUND_CHECK') {
	const cred = {
		type,
		status,
		issuedAt: BASE_DATE,
		organization: { name: 'Helping Hands' },
	};
	// biome-ignore lint/suspicious/noExplicitAny: test fixture
	return cred as any;
}

function makeSignup(status: string) {
	const signup = { status, createdAt: BASE_DATE };
	// biome-ignore lint/suspicious/noExplicitAny: test fixture
	return signup as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getPublicProfile', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		// Default: empty arrays for the parallel queries
		mockGetCredentialsByUserId.mockResolvedValue([]);
		mockGetAttendedShifts.mockResolvedValue([]);
		mockGetSignups.mockResolvedValue([]);
	});

	it('returns null when profile is not found', async () => {
		mockGetProfileWithUser.mockResolvedValue(null);
		expect(await getPublicProfile('user-1')).toBeNull();
	});

	it('returns null for PRIVATE visibility (no leakage)', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PRIVATE'));
		expect(await getPublicProfile('user-1')).toBeNull();
	});

	it('returns null for ORGS_ONLY visibility (no leakage)', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('ORGS_ONLY'));
		expect(await getPublicProfile('user-1')).toBeNull();
	});

	it('returns null and skips parallel queries for non-PUBLIC profiles', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PRIVATE'));
		await getPublicProfile('user-1');
		expect(mockGetCredentialsByUserId).not.toHaveBeenCalled();
		expect(mockGetAttendedShifts).not.toHaveBeenCalled();
		expect(mockGetSignups).not.toHaveBeenCalled();
	});

	it('returns profile for PUBLIC visibility', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));
		const result = await getPublicProfile('user-1');
		expect(result).not.toBeNull();
		expect(result?.displayName).toBe('Jane Doe');
		expect(result?.memberSince).toEqual(MEMBER_SINCE);
	});

	it('does NOT expose email or phone on the public profile', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));
		const result = await getPublicProfile('user-1');
		expect(result).not.toHaveProperty('email');
		expect(result).not.toHaveProperty('phone');
	});

	it('calculates totalHours correctly from attended shifts', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));
		mockGetAttendedShifts.mockResolvedValue([
			makeShift('org-1', 3),
			makeShift('org-2', 4.5),
		]);
		const result = await getPublicProfile('user-1');
		expect(result?.totalHours).toBe(8); // Math.round(7.5)
	});

	it('skips shifts with missing startTime or endTime', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));
		const nullShift = {
			userId: 'user-1',
			status: 'ATTENDED',
			createdAt: BASE_DATE,
			shift: { startTime: null, endTime: null, orgId: 'org-1' },
		};
		mockGetAttendedShifts.mockResolvedValue([
			// biome-ignore lint/suspicious/noExplicitAny: test fixture with null times
			nullShift as any,
			makeShift('org-2', 2),
		]);
		const result = await getPublicProfile('user-1');
		expect(result?.totalHours).toBe(2);
	});

	it('counts distinct orgs from attended shifts', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));
		mockGetAttendedShifts.mockResolvedValue([
			makeShift('org-1', 1),
			makeShift('org-1', 2), // same org — should not double-count
			makeShift('org-2', 1),
		]);
		const result = await getPublicProfile('user-1');
		expect(result?.orgCount).toBe(2);
	});

	it('only exposes VERIFIED credentials', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));
		mockGetCredentialsByUserId.mockResolvedValue([
			makeCredential('VERIFIED', 'BACKGROUND_CHECK'),
			makeCredential('PENDING', 'ID_VERIFIED'),
			makeCredential('EXPIRED', 'TRAINING_COMPLETE'),
		]);
		const result = await getPublicProfile('user-1');
		expect(result?.credentials).toHaveLength(1);
		expect(result?.credentials[0].type).toBe('BACKGROUND_CHECK');
	});

	it('returns reliabilityScore null when no signups', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));
		mockGetSignups.mockResolvedValue([]);
		const result = await getPublicProfile('user-1');
		expect(result?.reliabilityScore).toBeNull();
	});

	it('computes reliabilityScore from signups', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));
		mockGetSignups.mockResolvedValue([
			makeSignup('ATTENDED'),
			makeSignup('ATTENDED'),
		]);
		const result = await getPublicProfile('user-1');
		expect(result?.reliabilityScore).not.toBeNull();
		expect(result?.reliabilityScore).toBeGreaterThan(0);
	});

	it('falls back displayName to "Volunteer" when user.name is null', async () => {
		const profile = makeProfile('PUBLIC');
		profile.user.name = null;
		mockGetProfileWithUser.mockResolvedValue(profile);
		const result = await getPublicProfile('user-1');
		expect(result?.displayName).toBe('Volunteer');
	});
});

describe('getOrgVisibleProfile', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockGetCredentialsByUserId.mockResolvedValue([]);
		mockGetAttendedShifts.mockResolvedValue([]);
		mockGetSignups.mockResolvedValue([]);
		// Default: the volunteer belongs to the calling org. Tests that care
		// about the relationship gate override this.
		mockGetRelationship.mockResolvedValue('APPLICATION');
	});

	it('returns null when profile is not found', async () => {
		mockGetProfileWithUser.mockResolvedValue(null);
		expect(await getOrgVisibleProfile('user-1', ORG_ID)).toBeNull();
	});

	it('returns null for PRIVATE visibility (no leakage)', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PRIVATE'));
		expect(await getOrgVisibleProfile('user-1', ORG_ID)).toBeNull();
	});

	it('returns profile for PUBLIC visibility', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));
		expect(await getOrgVisibleProfile('user-1', ORG_ID)).not.toBeNull();
	});

	it('returns profile for ORGS_ONLY visibility (screeners can see it)', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('ORGS_ONLY'));
		const result = await getOrgVisibleProfile('user-1', ORG_ID);
		expect(result).not.toBeNull();
		expect(result?.displayName).toBe('Jane Doe');
	});

	it('does NOT expose email or phone on the org-visible profile', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('ORGS_ONLY'));
		const result = await getOrgVisibleProfile('user-1', ORG_ID);
		expect(result).not.toHaveProperty('email');
		expect(result).not.toHaveProperty('phone');
	});

	it('SECURITY: returns null for a volunteer with no relationship to the org', async () => {
		mockGetRelationship.mockResolvedValue(null);
		mockGetProfileWithUser.mockResolvedValue(makeProfile('PUBLIC'));

		expect(await getOrgVisibleProfile('user-1', ORG_ID)).toBeNull();
	});

	it('SECURITY: scopes the relationship check to the caller org', async () => {
		mockGetProfileWithUser.mockResolvedValue(makeProfile('ORGS_ONLY'));

		await getOrgVisibleProfile('user-1', ORG_ID);

		expect(mockGetRelationship).toHaveBeenCalledWith(ORG_ID, 'user-1');
	});

	it('SECURITY: does not read the profile at all when unrelated', async () => {
		// The response must be indistinguishable from "no profile", and the
		// profile row should never be fetched for a stranger in the first place.
		mockGetRelationship.mockResolvedValue(null);

		expect(await getOrgVisibleProfile('user-1', ORG_ID)).toBeNull();
		expect(mockGetProfileWithUser).not.toHaveBeenCalled();
	});
});
