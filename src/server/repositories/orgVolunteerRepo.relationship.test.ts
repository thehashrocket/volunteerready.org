/**
 * Tests for findOrgVolunteerRelationship — the read behind
 * requireOrgVolunteerRelationship.
 *
 * This file exists to pin down the *membership of the relationship set*, which
 * is the whole security decision. The exclusions matter more than the
 * inclusions, and they all follow one rule: a relationship staff can mint
 * unilaterally against a stranger cannot authorize a sensitive action, or the
 * guard is a speed bump rather than a boundary.
 *
 * Mocks Prisma directly rather than a repository, because the module under test
 * IS the repository.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	applicationFindFirst: vi.fn(),
	orgVolunteerFindFirst: vi.fn(),
	shiftSignupFindFirst: vi.fn(),
	orgMemberFindUnique: vi.fn(),
	invitationFindFirst: vi.fn(),
	credentialFindFirst: vi.fn(),
	backgroundCheckFindFirst: vi.fn(),
	interestFindFirst: vi.fn(),
	blockFindUnique: vi.fn(),
}));

vi.mock('./prisma', () => ({
	prisma: {
		volunteerApplication: { findFirst: mocks.applicationFindFirst },
		orgVolunteer: { findFirst: mocks.orgVolunteerFindFirst },
		shiftSignup: { findFirst: mocks.shiftSignupFindFirst },
		organizationMember: { findUnique: mocks.orgMemberFindUnique },
		orgVolunteerBlock: { findUnique: mocks.blockFindUnique },
		// Present so a query against them would succeed rather than throw — the
		// exclusion tests below prove they are never consulted.
		volunteerInvitation: { findFirst: mocks.invitationFindFirst },
		volunteerCredential: { findFirst: mocks.credentialFindFirst },
		backgroundCheckRequest: { findFirst: mocks.backgroundCheckFindFirst },
		opportunityInterest: { findFirst: mocks.interestFindFirst },
	},
}));

import { findOrgVolunteerRelationship } from './orgVolunteerRepo';

const ORG = 'org-1';
const USER = 'user-1';

/**
 * Every ACCEPTED relation misses; every EXCLUDED relation is present.
 *
 * The excluded mocks resolving truthy is not leftover setup — it IS the
 * assertion. Under this arrangement the function must still return null, so
 * wiring up any excluded probe turns the exclusion tests red. Do not "tidy"
 * these into nulls.
 */
function onlyExcludedRelationsPresent() {
	mocks.applicationFindFirst.mockResolvedValue(null);
	mocks.orgVolunteerFindFirst.mockResolvedValue(null);
	mocks.shiftSignupFindFirst.mockResolvedValue(null);
	mocks.orgMemberFindUnique.mockResolvedValue(null);

	mocks.invitationFindFirst.mockResolvedValue({ id: 'vi-1' });
	mocks.credentialFindFirst.mockResolvedValue({ id: 'cred-1' });
	mocks.backgroundCheckFindFirst.mockResolvedValue({ id: 'bg-1' });
	mocks.interestFindFirst.mockResolvedValue({ id: 'int-1' });

	// Unblocked is the default for every pre-existing case in this file. The
	// block-specific describe below overrides it.
	mocks.blockFindUnique.mockResolvedValue(null);
}

beforeEach(() => {
	vi.resetAllMocks();
	onlyExcludedRelationsPresent();
});

describe('findOrgVolunteerRelationship — accepted relations', () => {
	it('matches a VolunteerApplication linked to the user', async () => {
		mocks.applicationFindFirst.mockResolvedValue({ id: 'app-1' });
		expect(await findOrgVolunteerRelationship(ORG, USER)).toBe('APPLICATION');
	});

	it('matches a live OrgVolunteer roster row', async () => {
		mocks.orgVolunteerFindFirst.mockResolvedValue({ id: 'ov-1' });
		expect(await findOrgVolunteerRelationship(ORG, USER)).toBe('ORG_VOLUNTEER');
	});

	it('matches a ShiftSignup joined through the shift org', async () => {
		mocks.shiftSignupFindFirst.mockResolvedValue({ id: 'ss-1' });
		expect(await findOrgVolunteerRelationship(ORG, USER)).toBe('SHIFT_SIGNUP');
	});

	it('matches an OrganizationMember (staff are org people too)', async () => {
		mocks.orgMemberFindUnique.mockResolvedValue({ id: 'om-1' });
		expect(await findOrgVolunteerRelationship(ORG, USER)).toBe('ORG_MEMBER');
	});

	it('returns null when nothing in the accepted set matches', async () => {
		expect(await findOrgVolunteerRelationship(ORG, USER)).toBeNull();
	});
});

describe('findOrgVolunteerRelationship — scoping', () => {
	it('SECURITY: ignores soft-deleted roster rows', async () => {
		await findOrgVolunteerRelationship(ORG, USER);

		expect(mocks.orgVolunteerFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { orgId: ORG, userId: USER, deletedAt: null },
			}),
		);
	});

	it('SECURITY: joins shift signups through shift.orgId, not the signup alone', async () => {
		// A User row is shared across orgs by email, so an unscoped ShiftSignup
		// lookup would let org A authorize on work done for org B.
		await findOrgVolunteerRelationship(ORG, USER);

		expect(mocks.shiftSignupFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: USER, shift: { orgId: ORG } },
			}),
		);
	});

	it('SECURITY: scopes the membership probe to the org', async () => {
		await findOrgVolunteerRelationship(ORG, USER);

		expect(mocks.orgMemberFindUnique).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { organizationId_userId: { organizationId: ORG, userId: USER } },
			}),
		);
	});

	it('SECURITY: scopes the application probe to the org', async () => {
		await findOrgVolunteerRelationship(ORG, USER);

		expect(mocks.applicationFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { orgId: ORG, submittedByUserId: USER },
			}),
		);
	});

	it('counts applications of any status, including REJECTED', async () => {
		// Deliberate: staff still open rejected records, and gating a security
		// primitive on a status matrix invites drift as the enum grows.
		await findOrgVolunteerRelationship(ORG, USER);

		const where = mocks.applicationFindFirst.mock.calls[0][0].where;
		expect(where).not.toHaveProperty('status');
	});
});

describe('findOrgVolunteerRelationship — excluded relations', () => {
	// Each of these is present-and-truthy via onlyExcludedRelationsPresent();
	// the function must still refuse, and must not even ask.
	it.each([
		[
			'an invitation (staff-mintable against any volunteer in the directory)',
			() => mocks.invitationFindFirst,
		],
		['a credential (anti-circularity)', () => mocks.credentialFindFirst],
		[
			'a background check (anti-circularity)',
			() => mocks.backgroundCheckFindFirst,
		],
		[
			'marketplace interest (a public heart-click)',
			() => mocks.interestFindFirst,
		],
	])('SECURITY: %s is NOT a relationship', async (_label, getMock) => {
		expect(await findOrgVolunteerRelationship(ORG, USER)).toBeNull();
		expect(getMock()).not.toHaveBeenCalled();
	});
});

describe('findOrgVolunteerRelationship — acceptExistingCredential opt-in', () => {
	it('SECURITY: a credential is NOT consulted by default', async () => {
		// Restating the exclusion above against the new option: the default
		// call signature must not silently gain the credential probe.
		expect(await findOrgVolunteerRelationship(ORG, USER)).toBeNull();
		expect(mocks.credentialFindFirst).not.toHaveBeenCalled();
	});

	it('accepts an existing credential when explicitly opted in', async () => {
		const result = await findOrgVolunteerRelationship(ORG, USER, {
			acceptExistingCredential: true,
		});

		expect(result).toBe('EXISTING_CREDENTIAL');
	});

	it('SECURITY: the opt-in probe is still org-scoped', async () => {
		await findOrgVolunteerRelationship(ORG, USER, {
			acceptExistingCredential: true,
		});

		expect(mocks.credentialFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({ where: { orgId: ORG, userId: USER } }),
		);
	});

	it('SECURITY: opting in does not resurrect the other excluded relations', async () => {
		await findOrgVolunteerRelationship(ORG, USER, {
			acceptExistingCredential: true,
		});

		expect(mocks.invitationFindFirst).not.toHaveBeenCalled();
		expect(mocks.backgroundCheckFindFirst).not.toHaveBeenCalled();
		expect(mocks.interestFindFirst).not.toHaveBeenCalled();
	});

	it('probes the credential last, after every real relationship misses', async () => {
		mocks.applicationFindFirst.mockResolvedValue({ id: 'app-1' });

		const result = await findOrgVolunteerRelationship(ORG, USER, {
			acceptExistingCredential: true,
		});

		expect(result).toBe('APPLICATION');
		expect(mocks.credentialFindFirst).not.toHaveBeenCalled();
	});
});

describe('findOrgVolunteerRelationship — short-circuiting', () => {
	it('stops at the first match', async () => {
		mocks.applicationFindFirst.mockResolvedValue({ id: 'app-1' });

		await findOrgVolunteerRelationship(ORG, USER);

		expect(mocks.orgVolunteerFindFirst).not.toHaveBeenCalled();
		expect(mocks.shiftSignupFindFirst).not.toHaveBeenCalled();
		expect(mocks.orgMemberFindUnique).not.toHaveBeenCalled();
	});

	it('only the rejection path pays for all four probes', async () => {
		await findOrgVolunteerRelationship(ORG, USER);

		expect(mocks.applicationFindFirst).toHaveBeenCalledOnce();
		expect(mocks.orgVolunteerFindFirst).toHaveBeenCalledOnce();
		expect(mocks.shiftSignupFindFirst).toHaveBeenCalledOnce();
		expect(mocks.orgMemberFindUnique).toHaveBeenCalledOnce();
	});
});

/**
 * OrgVolunteerBlock — the volunteer's standing refusal.
 *
 * The P1 these tests exist for: leaving a roster soft-deleted the OrgVolunteer
 * row and nothing else, so an APPLICATION the volunteer had sent, or a
 * SHIFT_SIGNUP staff created unilaterally, kept satisfying this guard forever —
 * and `backgroundChecks.initiate` is gated on nothing but this function.
 */
describe('findOrgVolunteerRelationship — blocks', () => {
	/** Each volunteer-side kind, and the mock that produces it. */
	const suppressible = [
		['APPLICATION', () => mocks.applicationFindFirst],
		['ORG_VOLUNTEER', () => mocks.orgVolunteerFindFirst],
		['SHIFT_SIGNUP', () => mocks.shiftSignupFindFirst],
	] as const;

	// Table-driven on purpose. A block that suppressed only the kind someone
	// happened to test would leave the other two as live bypasses, and the probe
	// short-circuits, so whichever one is found FIRST is the one that matters.
	for (const [kind, probe] of suppressible) {
		it(`SECURITY: a block suppresses ${kind}`, async () => {
			probe().mockResolvedValue({ id: 'row-1' });
			mocks.blockFindUnique.mockResolvedValue({ id: 'block-1' });

			expect(await findOrgVolunteerRelationship(ORG, USER)).toBeNull();
		});
	}

	it('EXISTING_CREDENTIAL survives a block, so a credential stays revokable', async () => {
		mocks.credentialFindFirst.mockResolvedValue({ id: 'cred-1' });
		mocks.blockFindUnique.mockResolvedValue({ id: 'block-1' });

		const result = await findOrgVolunteerRelationship(ORG, USER, {
			acceptExistingCredential: true,
		});

		// Suppressing this looked right — a blocked org should not act on you —
		// but it recreates the exact dead end `acceptExistingCredential` exists to
		// prevent: `listOrgCredentials` filters on orgId alone, so the credential
		// stays visible and permanently unrevokable, and only the volunteer can
		// lift a block, so "later" may be never. The kind is opt-in and reached by
		// `revokeCredential` alone, which is strictly narrowing — it cannot mint
		// privilege or disclose anything, so a block has nothing to protect here.
		expect(result).toBe('EXISTING_CREDENTIAL');
	});

	it('does not pay for a block lookup when the match is EXISTING_CREDENTIAL', async () => {
		mocks.credentialFindFirst.mockResolvedValue({ id: 'cred-1' });

		await findOrgVolunteerRelationship(ORG, USER, {
			acceptExistingCredential: true,
		});

		expect(mocks.blockFindUnique).not.toHaveBeenCalled();
	});

	it('ORG_MEMBER survives a block', async () => {
		mocks.orgMemberFindUnique.mockResolvedValue({ id: 'member-1' });
		mocks.blockFindUnique.mockResolvedValue({ id: 'block-1' });

		// Staff membership is not what leaving a roster revokes. Without this a
		// coordinator who is also on their own org's volunteer roster would lock
		// themselves out of their own organization by leaving it.
		expect(await findOrgVolunteerRelationship(ORG, USER)).toBe('ORG_MEMBER');
	});

	it('ORG_MEMBER survives a block even when a suppressed kind is found first', async () => {
		mocks.applicationFindFirst.mockResolvedValue({ id: 'app-1' });
		mocks.orgMemberFindUnique.mockResolvedValue({ id: 'member-1' });
		mocks.blockFindUnique.mockResolvedValue({ id: 'block-1' });

		// The probe short-circuits at APPLICATION and never reaches the member
		// check, so suppression has to RE-probe rather than return null. Without
		// the re-probe this returns null and the same coordinator is locked out —
		// just only when they also happen to have applied.
		expect(await findOrgVolunteerRelationship(ORG, USER)).toBe('ORG_MEMBER');
	});

	it('scopes the block lookup to the pair, never the user alone', async () => {
		mocks.applicationFindFirst.mockResolvedValue({ id: 'app-1' });
		mocks.blockFindUnique.mockResolvedValue(null);

		await findOrgVolunteerRelationship(ORG, USER);

		// A block against org A must not revoke org B. Asserted on the WHERE
		// rather than by behaviour because with a single org in the fixture the
		// two are indistinguishable.
		expect(mocks.blockFindUnique).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { orgId_userId: { orgId: ORG, userId: USER } },
			}),
		);
	});

	it('does not pay for a block lookup when no relationship was found', async () => {
		await findOrgVolunteerRelationship(ORG, USER);

		// The rejection path already costs four queries and is the common one for
		// a probing caller. Nothing to suppress means nothing to look up.
		expect(mocks.blockFindUnique).not.toHaveBeenCalled();
	});

	it('does not pay for a block lookup when the match is ORG_MEMBER', async () => {
		mocks.orgMemberFindUnique.mockResolvedValue({ id: 'member-1' });

		await findOrgVolunteerRelationship(ORG, USER);

		expect(mocks.blockFindUnique).not.toHaveBeenCalled();
	});
});
