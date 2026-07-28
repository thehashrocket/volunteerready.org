/**
 * Pins the `.transform(normalizeEmail)` on `screener.submit`'s
 * `submittedByEmail`.
 *
 * This is load bearing for the whole claim flow. `listClaimableApplicationsByEmail`
 * and `claimApplicationForUser` match `submittedByEmail` by PLAIN EQUALITY
 * against `normalizeEmail(caller)` — the unsafe `mode: 'insensitive'` form was
 * removed precisely because Prisma compiles it to an unescaped `ILIKE`, making
 * `_` and `%` wildcards on an authorization predicate. Equality is only correct
 * while every writer stores the canonical form. T1's migration backfilled this
 * column and installed its trigger on `User` only, so this public procedure is
 * the one remaining writer that could re-dirty it. If the transform is dropped,
 * nothing throws: a volunteer who typed `Bob@Shelter.ORG` simply never sees
 * their own application offered for claiming, forever.
 *
 * Router level rather than schema level because the schema is declared inline in
 * the procedure — the value the SERVICE receives is the contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	submitVolunteerApplication: vi.fn(),
	checkRateLimit: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));
vi.mock('@/server/auth', () => ({ authOptions: {} }));
vi.mock('@/server/lib/rate-limit', () => ({
	checkRateLimit: mocks.checkRateLimit,
}));

vi.mock('@/server/services/volunteer-screening', () => ({
	submitVolunteerApplication: mocks.submitVolunteerApplication,
}));

import { normalizeEmail } from '@/server/domain/org-volunteer';
import { t } from '@/server/trpc/init';
import { screenerRouter } from './screener';

const callerFactory = t.createCallerFactory(screenerRouter);

function caller() {
	return callerFactory({
		session: null,
		realSession: null,
		realUserId: null,
		impersonation: null,
		orgId: null,
		role: null,
		companyId: null,
		companyRole: null,
		prisma: {} as never,
		sessionToken: null,
		ip: '203.0.113.1',
	} as Parameters<typeof callerFactory>[0]);
}

function submitInput(submittedByEmail: string) {
	return {
		orgId: 'org-1',
		submittedByEmail,
		profile: {
			name: 'Bob Volunteer',
			email: submittedByEmail,
			phone: '555-0100',
			county: 'Fresno',
			availability: 'Weekends',
			experienceLevel: 'Some',
		},
		responses: [],
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.checkRateLimit.mockResolvedValue({
		success: true,
		limit: 3,
		remaining: 3,
		reset: 0,
	});
	mocks.submitVolunteerApplication.mockResolvedValue({
		applicationId: 'app-1',
		status: 'SUBMITTED',
		screeningStatus: 'REVIEW',
		screeningReasons: [],
	});
});

describe('screener.submit — submittedByEmail canonicalization', () => {
	it('SECURITY: stores a mixed-case address in canonical form', async () => {
		await caller().submit(submitInput('Bob@Shelter.ORG'));

		expect(mocks.submitVolunteerApplication).toHaveBeenCalledWith(
			'org-1',
			expect.objectContaining({ submittedByEmail: 'bob@shelter.org' }),
		);
	});

	// The stored value must land on exactly the string the claim-side predicate
	// computes, for every shape a volunteer can type. Anything else is a row that
	// exists but can never be claimed — the equality match has no second chance.
	//
	// NOTE: only `submittedByEmail` is canonicalized. `profile.email` is carried
	// through verbatim into audit metadata; it is a recorded contact detail, not
	// an identity key, and nothing matches on it.
	it.each([
		'Bob@Shelter.ORG',
		'ALLCAPS@EXAMPLE.COM',
		'already@lower.com',
		'Mixed.Case+tag@Example.Co.UK',
	])('forwards %s exactly as normalizeEmail() would compute it', async (raw) => {
		await caller().submit(submitInput(raw));

		expect(mocks.submitVolunteerApplication.mock.calls[0][1]).toMatchObject({
			submittedByEmail: normalizeEmail(raw),
		});
	});
});
