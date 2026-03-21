import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so they're available in vi.mock factories
// ---------------------------------------------------------------------------

const { mockTransaction, mockCreate } = vi.hoisted(() => {
	const mockCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });
	const mockTransaction = vi.fn(
		async (fn: (tx: unknown) => Promise<unknown>) => {
			const tx = {
				organizationInvitation: {
					create: vi.fn().mockResolvedValue({ id: 'inv-1' }),
				},
				organizationMember: {
					findFirst: vi.fn().mockResolvedValue({
						userId: 'target-user',
						role: 'STAFF',
					}),
					update: vi.fn().mockResolvedValue({ id: 'mem-1', role: 'STAFF' }),
					delete: vi.fn().mockResolvedValue({ id: 'mem-1' }),
				},
				auditLog: { create: mockCreate },
			};
			return fn(tx);
		},
	);
	return { mockTransaction, mockCreate };
});

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findUnique: vi.fn().mockResolvedValue({ name: 'Test Org' }),
		},
		user: {
			findFirst: vi.fn().mockResolvedValue(null),
		},
		organizationMember: {
			findFirst: vi.fn().mockResolvedValue({
				userId: 'target-user',
				role: 'STAFF',
			}),
			delete: vi.fn(),
			update: vi.fn(),
		},
		$transaction: mockTransaction,
	},
}));

vi.mock('@/server/lib/tokens', () => ({
	generateToken: () => 'raw-token-123',
	hashToken: () => 'hashed-token-123',
}));

vi.mock('@/server/repositories/inviteRepo', () => ({
	findInvitationByHash: vi.fn(),
	findValidInvitationByHash: vi.fn(),
	markInvitationUsed: vi.fn(),
}));

vi.mock('@/server/repositories/sendInviteEmail', () => ({
	sendInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn().mockResolvedValue({ id: 'audit-1' }),
}));

import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	inviteMember,
	removeOrgMember,
	updateOrgMemberRole,
} from '../memberService';

describe('memberService audit logging', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('T10: inviteMember writes MEMBER_INVITED audit log transactionally', async () => {
		await inviteMember(
			'org-1',
			'test@example.com',
			'STAFF',
			'http://localhost:3000',
			'actor-1',
			'OWNER',
		);

		expect(mockTransaction).toHaveBeenCalledOnce();
		expect(writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				orgId: 'org-1',
				actorId: 'actor-1',
				action: 'MEMBER_INVITED',
				entityType: 'OrganizationInvitation',
				metadata: { email: 'test@example.com', role: 'STAFF' },
			}),
		);
	});

	it('T11: updateOrgMemberRole writes ROLE_CHANGED audit log transactionally', async () => {
		await updateOrgMemberRole('org-1', 'actor-1', 'mem-1', 'ADMIN');

		expect(mockTransaction).toHaveBeenCalledOnce();
		expect(writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				orgId: 'org-1',
				actorId: 'actor-1',
				action: 'ROLE_CHANGED',
				entityType: 'OrganizationMember',
				entityId: 'mem-1',
				metadata: expect.objectContaining({
					previousRole: 'STAFF',
					newRole: 'ADMIN',
				}),
			}),
		);
	});

	it('T12: removeOrgMember writes MEMBER_REMOVED audit log transactionally', async () => {
		await removeOrgMember('org-1', 'actor-1', 'mem-1');

		expect(mockTransaction).toHaveBeenCalledOnce();
		expect(writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				orgId: 'org-1',
				actorId: 'actor-1',
				action: 'MEMBER_REMOVED',
				entityType: 'OrganizationMember',
				entityId: 'mem-1',
			}),
		);
	});

	it('inviteMember enforces ADMIN-cannot-invite-ADMIN business rule', async () => {
		await expect(
			inviteMember(
				'org-1',
				'test@example.com',
				'ADMIN',
				'http://localhost:3000',
				'actor-1',
				'ADMIN',
			),
		).rejects.toThrow('Admins can only invite Staff or Read-only members.');
	});
});
