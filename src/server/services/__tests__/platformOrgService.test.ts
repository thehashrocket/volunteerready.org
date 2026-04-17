import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetOrgDetail,
	mockListOrgMembers,
	mockListOrgOpportunities,
	mockListOrgApplications,
	mockListOrgsPage,
} = vi.hoisted(() => ({
	mockGetOrgDetail: vi.fn(),
	mockListOrgMembers: vi.fn(),
	mockListOrgOpportunities: vi.fn(),
	mockListOrgApplications: vi.fn(),
	mockListOrgsPage: vi.fn(),
}));

vi.mock('@/server/repositories/platformOrgRepo', () => ({
	getOrgDetail: mockGetOrgDetail,
	listOrgMembers: mockListOrgMembers,
	listOrgOpportunities: mockListOrgOpportunities,
	listOrgApplications: mockListOrgApplications,
	listOrgsPage: mockListOrgsPage,
}));

import { getOrg, listOrgs } from '../platformOrgService';

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
