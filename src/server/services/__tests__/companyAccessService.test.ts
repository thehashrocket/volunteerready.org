import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCompanyMembership, getCompanyPlanTier } = vi.hoisted(() => ({
	getCompanyMembership: vi.fn(),
	getCompanyPlanTier: vi.fn(),
}));

vi.mock('@/server/repositories/companyRepo', () => ({
	getCompanyMembership,
	getCompanyPlanTier,
}));

import {
	CompanyAccessDeniedError,
	requireCompanyAccess,
} from '../companyAccessService';

describe('requireCompanyAccess', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws when the user has no membership in the given company', async () => {
		getCompanyMembership.mockResolvedValue(null);

		await expect(
			requireCompanyAccess({ userId: 'user-1', companyId: 'company-A' }),
		).rejects.toThrow(CompanyAccessDeniedError);

		// Always checks membership against the companyId passed in, never a
		// session-derived one — this is the whole point of the function.
		expect(getCompanyMembership).toHaveBeenCalledWith('user-1', 'company-A');
	});

	it('throws when the member role is below minRole', async () => {
		getCompanyMembership.mockResolvedValue({ role: 'MEMBER' });

		await expect(
			requireCompanyAccess({
				userId: 'user-1',
				companyId: 'company-A',
				minRole: 'ADMIN',
			}),
		).rejects.toThrow(CompanyAccessDeniedError);
	});

	it('throws when the company plan tier is below minPlanTier', async () => {
		getCompanyMembership.mockResolvedValue({ role: 'ADMIN' });
		getCompanyPlanTier.mockResolvedValue('FREE');

		await expect(
			requireCompanyAccess({
				userId: 'user-1',
				companyId: 'company-A',
				minRole: 'ADMIN',
				minPlanTier: 'PRO',
			}),
		).rejects.toThrow(CompanyAccessDeniedError);
	});

	it('does not look up plan tier when minPlanTier is not requested', async () => {
		getCompanyMembership.mockResolvedValue({ role: 'MEMBER' });

		await requireCompanyAccess({ userId: 'user-1', companyId: 'company-A' });

		expect(getCompanyPlanTier).not.toHaveBeenCalled();
	});

	it('defaults minRole to MEMBER when not specified', async () => {
		getCompanyMembership.mockResolvedValue({ role: 'MEMBER' });

		await expect(
			requireCompanyAccess({ userId: 'user-1', companyId: 'company-A' }),
		).resolves.toEqual({ role: 'MEMBER' });
	});

	it('resolves with the caller role on the happy path', async () => {
		getCompanyMembership.mockResolvedValue({ role: 'OWNER' });
		getCompanyPlanTier.mockResolvedValue('PRO');

		await expect(
			requireCompanyAccess({
				userId: 'user-1',
				companyId: 'company-A',
				minRole: 'ADMIN',
				minPlanTier: 'PRO',
			}),
		).resolves.toEqual({ role: 'OWNER' });
	});

	it('is checked against the caller-supplied companyId, regardless of which company that user might otherwise have active', async () => {
		// Same user, membership in company-A only. Requesting access to
		// company-B (a different, unrelated company) must be denied even
		// though the user is a legitimate member elsewhere.
		getCompanyMembership.mockImplementation(
			async (_userId: string, companyId: string) =>
				companyId === 'company-A' ? { role: 'OWNER' } : null,
		);

		await expect(
			requireCompanyAccess({ userId: 'user-1', companyId: 'company-B' }),
		).rejects.toThrow(CompanyAccessDeniedError);
		await expect(
			requireCompanyAccess({ userId: 'user-1', companyId: 'company-A' }),
		).resolves.toEqual({ role: 'OWNER' });
	});
});
