import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetOrgDetail,
	mockListOrgMembers,
	mockListOrgOpportunities,
	mockListOrgApplications,
	mockListOrgsPage,
	mockSetOrgSuspendedTx,
	mockOrgFindUnique,
	mockTransaction,
	mockWriteAuditLogTx,
} = vi.hoisted(() => {
	const mockOrgFindUnique = vi.fn();
	return {
		mockGetOrgDetail: vi.fn(),
		mockListOrgMembers: vi.fn(),
		mockListOrgOpportunities: vi.fn(),
		mockListOrgApplications: vi.fn(),
		mockListOrgsPage: vi.fn(),
		mockSetOrgSuspendedTx: vi.fn(),
		mockOrgFindUnique,
		mockTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({ organization: { findUnique: mockOrgFindUnique } }),
		),
		mockWriteAuditLogTx: vi.fn().mockResolvedValue({ id: 'audit-1' }),
	};
});

vi.mock('@/server/repositories/platformOrgRepo', () => ({
	getOrgDetail: mockGetOrgDetail,
	listOrgMembers: mockListOrgMembers,
	listOrgOpportunities: mockListOrgOpportunities,
	listOrgApplications: mockListOrgApplications,
	listOrgsPage: mockListOrgsPage,
	setOrgSuspendedTx: mockSetOrgSuspendedTx,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: { $transaction: mockTransaction },
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mockWriteAuditLogTx,
}));

import {
	getOrg,
	listOrgs,
	suspendOrg,
	unsuspendOrg,
} from '../platformOrgService';

describe('platformOrgService.getOrg', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws NOT_FOUND when the org does not exist', async () => {
		mockGetOrgDetail.mockResolvedValueOnce(null);

		await expect(getOrg('missing')).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
		expect(mockListOrgMembers).not.toHaveBeenCalled();
		expect(mockListOrgOpportunities).not.toHaveBeenCalled();
		expect(mockListOrgApplications).not.toHaveBeenCalled();
	});

	it('returns org with members, opportunities, applications loaded in parallel', async () => {
		const org = { id: 'org-1', slug: 'helping', name: 'Helping Hands' };
		const members = [{ id: 'm1' }];
		const opportunities = [{ id: 'opp-1' }];
		const applications = [{ id: 'app-1' }];

		mockGetOrgDetail.mockResolvedValueOnce(org);
		mockListOrgMembers.mockResolvedValueOnce(members);
		mockListOrgOpportunities.mockResolvedValueOnce(opportunities);
		mockListOrgApplications.mockResolvedValueOnce(applications);

		const result = await getOrg('org-1');

		expect(result).toEqual({ org, members, opportunities, applications });
		expect(mockListOrgMembers).toHaveBeenCalledWith('org-1');
		expect(mockListOrgOpportunities).toHaveBeenCalledWith('org-1');
		expect(mockListOrgApplications).toHaveBeenCalledWith('org-1');
	});
});

describe('platformOrgService.listOrgs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('forwards pagination and search input verbatim to the repo', async () => {
		mockListOrgsPage.mockResolvedValueOnce({ orgs: [], nextCursor: null });

		await listOrgs({ search: 'hope', cursor: 'c-1', limit: 10 });

		expect(mockListOrgsPage).toHaveBeenCalledWith({
			search: 'hope',
			cursor: 'c-1',
			limit: 10,
		});
	});
});

describe('platformOrgService.suspendOrg', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOrgFindUnique.mockReset();
		mockSetOrgSuspendedTx.mockReset();
	});

	it('throws NOT_FOUND when org does not exist', async () => {
		mockOrgFindUnique.mockResolvedValueOnce(null);

		await expect(
			suspendOrg({
				id: 'org-1',
				reason: 'payment failed',
				actorId: 'admin-1',
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect(mockSetOrgSuspendedTx).not.toHaveBeenCalled();
	});

	it('throws BAD_REQUEST when already suspended (idempotent guard)', async () => {
		mockOrgFindUnique.mockResolvedValueOnce({
			id: 'org-1',
			suspendedAt: new Date(),
		});

		await expect(
			suspendOrg({
				id: 'org-1',
				reason: 'payment failed',
				actorId: 'admin-1',
			}),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('writes update + audit row in same transaction on happy path', async () => {
		mockOrgFindUnique.mockResolvedValueOnce({
			id: 'org-1',
			suspendedAt: null,
		});
		mockSetOrgSuspendedTx.mockResolvedValueOnce({
			id: 'org-1',
			slug: 'helping',
			suspendedAt: new Date(),
			suspendedReason: 'payment failed 3x',
			suspendedById: 'admin-1',
		});

		await suspendOrg({
			id: 'org-1',
			reason: 'payment failed 3x',
			actorId: 'admin-1',
		});

		expect(mockSetOrgSuspendedTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				id: 'org-1',
				suspendedAt: expect.any(Date),
				suspendedReason: 'payment failed 3x',
				suspendedById: 'admin-1',
			}),
		);
		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				actorId: 'admin-1',
				orgId: 'org-1',
				action: 'ORG_SUSPENDED',
				entityType: 'Organization',
				entityId: 'org-1',
				metadata: expect.objectContaining({
					reason: 'payment failed 3x',
					slug: 'helping',
				}),
			}),
		);
	});
});

describe('platformOrgService.unsuspendOrg', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOrgFindUnique.mockReset();
		mockSetOrgSuspendedTx.mockReset();
	});

	it('throws BAD_REQUEST when org is not suspended', async () => {
		mockOrgFindUnique.mockResolvedValueOnce({
			id: 'org-1',
			suspendedAt: null,
			suspendedReason: null,
		});

		await expect(
			unsuspendOrg({ id: 'org-1', reason: 'fixed', actorId: 'admin-1' }),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('clears suspension and writes audit on happy path', async () => {
		const priorSuspendedAt = new Date(Date.now() - 60_000);
		mockOrgFindUnique.mockResolvedValueOnce({
			id: 'org-1',
			suspendedAt: priorSuspendedAt,
			suspendedReason: 'payment failed',
		});
		mockSetOrgSuspendedTx.mockResolvedValueOnce({
			id: 'org-1',
			slug: 'helping',
			suspendedAt: null,
			suspendedReason: null,
			suspendedById: null,
		});

		await unsuspendOrg({
			id: 'org-1',
			reason: 'payment cleared',
			actorId: 'admin-1',
		});

		expect(mockSetOrgSuspendedTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				id: 'org-1',
				suspendedAt: null,
				suspendedReason: null,
				suspendedById: null,
			}),
		);
		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'ORG_UNSUSPENDED',
				metadata: expect.objectContaining({
					reason: 'payment cleared',
					priorSuspendedReason: 'payment failed',
					priorSuspendedAt: priorSuspendedAt.toISOString(),
				}),
			}),
		);
	});
});
