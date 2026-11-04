/**
 * `setOrgVolunteerRoster` — an org's staff turning the volunteer roster off (or
 * back on) from Settings. It must write the same flag, override row and audit
 * entry as the platform-admin toggle, so the two never disagree.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getFlagWithPriorTx: vi.fn(),
	upsertFlagTx: vi.fn(),
	writeAuditLogTx: vi.fn(),
	orgFindUnique: vi.fn(),
}));

vi.mock('@/server/repositories/featureFlagRepo', () => ({
	getFlag: vi.fn(),
	getFlagWithPriorTx: mocks.getFlagWithPriorTx,
	listOrgFlags: vi.fn(),
	upsertFlagTx: mocks.upsertFlagTx,
}));
vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: (fn: (tx: unknown) => unknown) =>
			fn({ organization: { findUnique: mocks.orgFindUnique } }),
	},
}));

import { STAFF_CREATED_VOLUNTEERS_FLAG } from '@/server/domain/feature-flags';
import { setOrgVolunteerRoster } from '../featureFlagService';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.orgFindUnique.mockResolvedValue({ id: 'org-1', slug: 'helping-hands' });
	mocks.getFlagWithPriorTx.mockResolvedValue(null);
	mocks.upsertFlagTx.mockResolvedValue({ id: 'flag-1' });
});

describe('setOrgVolunteerRoster', () => {
	it('writes the roster flag override for the org, attributed to the actor', async () => {
		await setOrgVolunteerRoster({
			orgId: 'org-1',
			enabled: false,
			actorId: 'u-1',
		});

		expect(mocks.upsertFlagTx).toHaveBeenCalledWith(expect.anything(), {
			orgId: 'org-1',
			key: STAFF_CREATED_VOLUNTEERS_FLAG,
			enabled: false,
			updatedById: 'u-1',
		});
		const audit = mocks.writeAuditLogTx.mock.calls[0][1];
		expect(audit).toMatchObject({
			actorId: 'u-1',
			orgId: 'org-1',
			action: 'FEATURE_FLAG_SET',
		});
		// No override existed, so the prior effective value is the new default: on.
		expect(audit.metadata).toMatchObject({
			key: STAFF_CREATED_VOLUNTEERS_FLAG,
			enabled: false,
			priorEnabled: true,
			reason: 'Changed in organization settings',
		});
	});

	it('records the real admin when the change was made under impersonation', async () => {
		await setOrgVolunteerRoster({
			orgId: 'org-1',
			enabled: true,
			actorId: 'target-user',
			impersonatedBy: 'platform-admin',
		});
		const audit = mocks.writeAuditLogTx.mock.calls[0][1];
		expect(audit.actorId).toBe('target-user');
		expect(audit.metadata.reason).toContain('platform-admin');
	});
});
