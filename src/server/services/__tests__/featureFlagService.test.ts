import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockListOrgFlags,
	mockGetFlag,
	mockUpsertFlagTx,
	mockGetFlagWithPriorTx,
	mockOrgFindUnique,
	mockTransaction,
	mockWriteAuditLogTx,
} = vi.hoisted(() => {
	const mockOrgFindUnique = vi.fn();
	const mockUpsertFlagTx = vi.fn();
	const mockGetFlagWithPriorTx = vi.fn();
	return {
		mockListOrgFlags: vi.fn(),
		mockGetFlag: vi.fn(),
		mockUpsertFlagTx,
		mockGetFlagWithPriorTx,
		mockOrgFindUnique,
		mockTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({ organization: { findUnique: mockOrgFindUnique } }),
		),
		mockWriteAuditLogTx: vi.fn().mockResolvedValue({ id: 'audit-1' }),
	};
});

vi.mock('@/server/repositories/featureFlagRepo', () => ({
	listOrgFlags: mockListOrgFlags,
	getFlag: mockGetFlag,
	upsertFlagTx: mockUpsertFlagTx,
	getFlagWithPriorTx: mockGetFlagWithPriorTx,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: { $transaction: mockTransaction },
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mockWriteAuditLogTx,
}));

import { FEATURE_FLAG_REGISTRY } from '@/server/domain/feature-flags';
import {
	isFeatureEnabled,
	listOrgFeatureFlags,
	setFeatureFlag,
} from '../featureFlagService';

const KNOWN_KEY = FEATURE_FLAG_REGISTRY[0].key;

describe('featureFlagService.listOrgFeatureFlags', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns registry defaults when no overrides exist', async () => {
		mockListOrgFlags.mockResolvedValueOnce([]);

		const result = await listOrgFeatureFlags('org-1');

		expect(result).toHaveLength(FEATURE_FLAG_REGISTRY.length);
		for (const row of result) {
			expect(row.hasOverride).toBe(false);
			expect(row.updatedAt).toBeNull();
			const def = FEATURE_FLAG_REGISTRY.find((d) => d.key === row.key);
			expect(row.enabled).toBe(def?.defaultEnabled);
		}
	});

	it('merges overrides on top of registry defaults', async () => {
		const updatedAt = new Date();
		mockListOrgFlags.mockResolvedValueOnce([
			{
				key: KNOWN_KEY,
				enabled: true,
				updatedAt,
				updatedById: 'admin-1',
				updatedBy: { id: 'admin-1', email: 'admin@example.com', name: 'A' },
			},
		]);

		const result = await listOrgFeatureFlags('org-1');
		const row = result.find((r) => r.key === KNOWN_KEY);

		expect(row?.hasOverride).toBe(true);
		expect(row?.enabled).toBe(true);
		expect(row?.updatedBy?.email).toBe('admin@example.com');
	});
});

describe('featureFlagService.setFeatureFlag', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOrgFindUnique.mockReset();
		mockUpsertFlagTx.mockReset();
		mockGetFlagWithPriorTx.mockReset();
	});

	it('throws BAD_REQUEST for unknown flag keys', async () => {
		await expect(
			setFeatureFlag({
				orgId: 'org-1',
				key: 'totally_made_up_flag',
				enabled: true,
				reason: 'test reason',
				actorId: 'admin-1',
			}),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mockUpsertFlagTx).not.toHaveBeenCalled();
	});

	it('throws NOT_FOUND when org does not exist', async () => {
		mockOrgFindUnique.mockResolvedValueOnce(null);

		await expect(
			setFeatureFlag({
				orgId: 'org-1',
				key: KNOWN_KEY,
				enabled: true,
				reason: 'test reason',
				actorId: 'admin-1',
			}),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect(mockUpsertFlagTx).not.toHaveBeenCalled();
	});

	it('upserts flag and writes audit row in same transaction', async () => {
		mockOrgFindUnique.mockResolvedValueOnce({ id: 'org-1', slug: 'helping' });
		mockGetFlagWithPriorTx.mockResolvedValueOnce(null);
		mockUpsertFlagTx.mockResolvedValueOnce({
			id: 'flag-1',
			orgId: 'org-1',
			key: KNOWN_KEY,
			enabled: true,
			updatedAt: new Date(),
			updatedById: 'admin-1',
		});

		await setFeatureFlag({
			orgId: 'org-1',
			key: KNOWN_KEY,
			enabled: true,
			reason: 'enabling for pilot',
			actorId: 'admin-1',
		});

		expect(mockUpsertFlagTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				orgId: 'org-1',
				key: KNOWN_KEY,
				enabled: true,
				updatedById: 'admin-1',
			}),
		);
		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				actorId: 'admin-1',
				orgId: 'org-1',
				action: 'FEATURE_FLAG_SET',
				entityType: 'FeatureFlag',
				entityId: 'flag-1',
				metadata: expect.objectContaining({
					key: KNOWN_KEY,
					enabled: true,
					hadOverride: false,
					reason: 'enabling for pilot',
					slug: 'helping',
				}),
			}),
		);
	});

	it('records prior override state in audit metadata', async () => {
		mockOrgFindUnique.mockResolvedValueOnce({ id: 'org-1', slug: 'helping' });
		mockGetFlagWithPriorTx.mockResolvedValueOnce({ enabled: true });
		mockUpsertFlagTx.mockResolvedValueOnce({
			id: 'flag-1',
			orgId: 'org-1',
			key: KNOWN_KEY,
			enabled: false,
			updatedAt: new Date(),
			updatedById: 'admin-1',
		});

		await setFeatureFlag({
			orgId: 'org-1',
			key: KNOWN_KEY,
			enabled: false,
			reason: 'disabling after issue',
			actorId: 'admin-1',
		});

		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				metadata: expect.objectContaining({
					enabled: false,
					priorEnabled: true,
					hadOverride: true,
				}),
			}),
		);
	});
});

describe('featureFlagService.isFeatureEnabled', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns false for unknown keys without a DB call', async () => {
		const result = await isFeatureEnabled('org-1', 'totally_unknown');
		expect(result).toBe(false);
		expect(mockGetFlag).not.toHaveBeenCalled();
	});

	it('returns the override value when set', async () => {
		mockGetFlag.mockResolvedValueOnce({ enabled: true });
		const result = await isFeatureEnabled('org-1', KNOWN_KEY);
		expect(result).toBe(true);
	});

	it('falls back to registry default when no override', async () => {
		mockGetFlag.mockResolvedValueOnce(null);
		const result = await isFeatureEnabled('org-1', KNOWN_KEY);
		const def = FEATURE_FLAG_REGISTRY.find((d) => d.key === KNOWN_KEY);
		expect(result).toBe(def?.defaultEnabled);
	});
});
