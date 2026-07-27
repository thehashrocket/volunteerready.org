/**
 * Coverage for removeCredential — the one credential mutation deliberately
 * left OUT of the requireOrgVolunteerRelationship guard.
 *
 * `issueCredential` and `revokeCredential` both route through `upsertCredential`,
 * whose `create` branch can mint a row on a stranger, so both are guarded.
 * `removeCredential` instead calls `deleteCredential`, which deletes on the
 * compound key `userId_orgId_type` — the caller's own `orgId` is part of the
 * match, so a foreign `userId` cannot name a row that exists, and the delete is
 * a no-op rather than a cross-tenant write.
 *
 * This file mocks `volunteerCredentialRepo`, so it proves only that
 * `removeCredential` FORWARDS `orgId` into the compound key and that the guard
 * is deliberately absent. It cannot prove `deleteCredential` still honours that
 * key — the real implementation never runs here. That half is pinned against
 * the actual query in `repositories/volunteerCredentialRepo.delete.test.ts`.
 * Both halves are required: forwarding the right org into a function that
 * ignores it would be just as broken as the reverse.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireOrgVolunteerRelationship: vi.fn(),
	deleteCredential: vi.fn(),
	writeAuditLogTx: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({}) },
}));

vi.mock('@/server/repositories/volunteerCredentialRepo', () => ({
	deleteCredential: mocks.deleteCredential,
	upsertCredential: vi.fn(),
	getCredentialsByOrg: vi.fn(),
	getCredentialsByUserAndOrg: vi.fn(),
	getCredentialsByUserId: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));

vi.mock('@/server/services/orgVolunteerAccessService', () => ({
	requireOrgVolunteerRelationship: mocks.requireOrgVolunteerRelationship,
}));

import { removeCredential } from '../volunteerCredentialService';

beforeEach(() => {
	vi.resetAllMocks();
	mocks.deleteCredential.mockResolvedValue({ id: 'cred-1' });
});

describe('removeCredential org scoping', () => {
	it('SECURITY: scopes the delete by the caller org, so a foreign userId cannot match', async () => {
		// orgId is passed positionally into the compound key. This is the
		// entire reason removeCredential is safe without the relationship
		// guard its two sibling mutations carry.
		await removeCredential('user-1', 'org-1', 'BACKGROUND_CHECK', 'actor-1');

		expect(mocks.deleteCredential).toHaveBeenCalledWith(
			expect.anything(),
			'user-1',
			'org-1',
			'BACKGROUND_CHECK',
		);
	});

	it('SECURITY: the guard omission is deliberate, not an oversight', () => {
		// Pinned so that adding or removing the guard here is a visible,
		// intentional change rather than something a reader has to infer from
		// a docstring. If someone guards this later, this test should be the
		// thing that makes them say so out loud.
		expect(mocks.requireOrgVolunteerRelationship).not.toHaveBeenCalled();
	});

	it('SECURITY: a userId outside the org deletes nothing and audits nothing', async () => {
		// The compound key finds no row, Prisma rejects (P2025), and the
		// transaction rolls back before the audit write — a no-op, not a
		// cross-tenant delete.
		mocks.deleteCredential.mockRejectedValue(
			Object.assign(new Error('Record to delete does not exist.'), {
				code: 'P2025',
			}),
		);

		await expect(
			removeCredential('stranger', 'org-1', 'BACKGROUND_CHECK', 'actor-1'),
		).rejects.toThrow();

		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});
});
