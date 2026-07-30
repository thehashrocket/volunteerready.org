/**
 * `requireOrgAccess` — the raw-Route-Handler counterpart to `staffProcedure`.
 *
 * Every assertion here exists because this guard is the ONLY thing standing
 * between a typed URL and another tenant's roster. tRPC's `staffProcedure` gets
 * membership, role and suspension for free from `ctx`; a Route Handler gets
 * none of them, and each one omitted here is a hole.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	userIsMemberOfOrg: vi.fn(),
	getOrgSuspension: vi.fn(),
}));

vi.mock('@/server/repositories/orgRepo', () => ({
	userIsMemberOfOrg: mocks.userIsMemberOfOrg,
	getOrgSuspension: mocks.getOrgSuspension,
}));

const { OrgAccessDeniedError, requireOrgAccess } = await import(
	'../orgAccessService'
);

const USER = 'user_1';
const ORG = 'org_1';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.userIsMemberOfOrg.mockResolvedValue({ role: 'STAFF' });
	mocks.getOrgSuspension.mockResolvedValue({ suspendedAt: null });
});

describe('requireOrgAccess', () => {
	it('returns the role for a member who clears the bar', async () => {
		await expect(
			requireOrgAccess({ userId: USER, orgId: ORG }),
		).resolves.toEqual({ role: 'STAFF' });
	});

	it('looks membership up by the orgId it was passed', async () => {
		await requireOrgAccess({ userId: USER, orgId: ORG });
		expect(mocks.userIsMemberOfOrg).toHaveBeenCalledWith(USER, ORG);
	});

	it('refuses a non-member', async () => {
		mocks.userIsMemberOfOrg.mockResolvedValue(null);
		await expect(
			requireOrgAccess({ userId: USER, orgId: ORG }),
		).rejects.toThrow(OrgAccessDeniedError);
	});

	it('refuses a role below the bar', async () => {
		mocks.userIsMemberOfOrg.mockResolvedValue({ role: 'READONLY' });
		await expect(
			requireOrgAccess({ userId: USER, orgId: ORG, minRole: 'STAFF' }),
		).rejects.toThrow(/STAFF/);
	});

	it('accepts a role above the bar', async () => {
		mocks.userIsMemberOfOrg.mockResolvedValue({ role: 'OWNER' });
		await expect(
			requireOrgAccess({ userId: USER, orgId: ORG, minRole: 'STAFF' }),
		).resolves.toEqual({ role: 'OWNER' });
	});

	it('defaults to STAFF, not to "any member"', async () => {
		mocks.userIsMemberOfOrg.mockResolvedValue({ role: 'READONLY' });
		await expect(
			requireOrgAccess({ userId: USER, orgId: ORG }),
		).rejects.toThrow();
	});

	it('refuses a suspended org, matching orgProcedure', async () => {
		// Without this, a suspended org could bulk-export its roster through a
		// route that skipped tRPC — the suspension would apply everywhere except
		// the one endpoint that returns everything at once.
		mocks.getOrgSuspension.mockResolvedValue({ suspendedAt: new Date() });
		await expect(
			requireOrgAccess({ userId: USER, orgId: ORG }),
		).rejects.toThrow(/suspended/);
	});

	it('checks membership before suspension', async () => {
		// A stranger must not learn that an org is suspended, which is a fact
		// about an org they have no relationship with.
		mocks.userIsMemberOfOrg.mockResolvedValue(null);
		await expect(
			requireOrgAccess({ userId: USER, orgId: ORG }),
		).rejects.toThrow();
		expect(mocks.getOrgSuspension).not.toHaveBeenCalled();
	});
});
