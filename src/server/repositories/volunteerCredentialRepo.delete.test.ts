/**
 * Repository-level test for deleteCredential's org scoping.
 *
 * `removeCredential` is the one credential mutation deliberately left OUT of the
 * `requireOrgVolunteerRelationship` guard, and the entire justification is this
 * function's shape: a single-row `delete` on the compound key
 * `userId_orgId_type`, which includes the caller's own `orgId`. A foreign
 * `userId` therefore cannot name a row that exists, and the call is a no-op
 * rather than a cross-tenant delete.
 *
 * That property has to be pinned HERE, against the real implementation. The
 * service-level test mocks this module, so it can only prove `removeCredential`
 * forwards `orgId` — it cannot prove `deleteCredential` still uses it. Relaxing
 * this to a `deleteMany` on `{ userId, type }`, or dropping `orgId` from the
 * key, would turn an unguarded procedure into a cross-tenant delete, and only
 * this file would notice.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./prisma', () => ({ prisma: {} }));

import { deleteCredential } from './volunteerCredentialRepo';

describe('deleteCredential org scoping', () => {
	it('SECURITY: deletes on the org-scoped compound key, never a bare userId match', () => {
		const del = vi.fn().mockResolvedValue({ id: 'cred-1' });
		const tx = { volunteerCredential: { delete: del } };

		deleteCredential(tx as never, 'user-1', 'org-1', 'BACKGROUND_CHECK');

		expect(del).toHaveBeenCalledWith({
			where: {
				userId_orgId_type: {
					userId: 'user-1',
					orgId: 'org-1',
					type: 'BACKGROUND_CHECK',
				},
			},
		});
	});

	it('SECURITY: uses single-row delete, not deleteMany', () => {
		// `deleteMany` would silently succeed with count 0 on a foreign id
		// instead of throwing P2025 — and, worse, would delete every matching
		// row if the org clause were ever dropped from the filter.
		const del = vi.fn().mockResolvedValue({ id: 'cred-1' });
		const deleteMany = vi.fn();
		const tx = { volunteerCredential: { delete: del, deleteMany } };

		deleteCredential(tx as never, 'user-1', 'org-1', 'BACKGROUND_CHECK');

		expect(del).toHaveBeenCalledOnce();
		expect(deleteMany).not.toHaveBeenCalled();
	});
});
