import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrgUpdate = vi.fn();

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			update: (...args: unknown[]) => mockOrgUpdate(...args),
		},
	},
}));

import { updateMarketplaceSettings } from './orgMarketplaceService';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateMarketplaceSettings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOrgUpdate.mockResolvedValue({});
	});

	it('passes marketplaceVisible when provided', async () => {
		await updateMarketplaceSettings('org-1', { marketplaceVisible: true });

		expect(mockOrgUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'org-1' },
				data: expect.objectContaining({ marketplaceVisible: true }),
			}),
		);
	});

	it('omits marketplaceVisible from data when not provided', async () => {
		await updateMarketplaceSettings('org-1', { description: 'Hello' });

		const data = mockOrgUpdate.mock.calls[0][0].data;
		expect(data).not.toHaveProperty('marketplaceVisible');
		expect(data).toHaveProperty('description', 'Hello');
	});

	it('passes description (including null to clear it)', async () => {
		await updateMarketplaceSettings('org-1', { description: null });

		const data = mockOrgUpdate.mock.calls[0][0].data;
		expect(data).toHaveProperty('description', null);
	});

	it('passes location when provided', async () => {
		await updateMarketplaceSettings('org-1', { location: 'Fresno, CA' });

		const data = mockOrgUpdate.mock.calls[0][0].data;
		expect(data).toHaveProperty('location', 'Fresno, CA');
	});

	it('passes causeAreaTags when provided', async () => {
		await updateMarketplaceSettings('org-1', {
			causeAreaTags: ['animals', 'environment'],
		});

		const data = mockOrgUpdate.mock.calls[0][0].data;
		expect(data).toHaveProperty('causeAreaTags', ['animals', 'environment']);
	});

	it('sends empty data object when no fields are provided', async () => {
		await updateMarketplaceSettings('org-1', {});

		const data = mockOrgUpdate.mock.calls[0][0].data;
		expect(data).toEqual({});
	});
});
