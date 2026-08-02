import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so they're available in vi.mock factories
// ---------------------------------------------------------------------------

/**
 * The acting member's role is now read from the database (see
 * `resolveActingRole`), so `organizationMember.findFirst` serves TWO different
 * lookups: the ACTOR, keyed `{ organizationId, userId }`, and the TARGET, keyed
 * `{ id, organizationId }`. A single `mockResolvedValue` would answer both with
 * the same row, which is the shared-mock defect this suite's own TODO entry
 * describes — it would silently make the actor whatever the target is and every
 * role rule below would test itself.
 *
 * `actingRole` is per-test state so a suite can put the caller at OWNER or ADMIN
 * without restating the whole mock.
 */
const {
	mockTransaction,
	findMember,
	setActingRole,
	setActingMemberMissing,
	setTargetRole,
} = vi.hoisted(() => {
	const mockCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });
	const state = {
		actingRole: 'OWNER' as string | null,
		targetRole: 'STAFF' as string,
	};
	const setActingRole = (role: string) => {
		state.actingRole = role;
	};
	const setActingMemberMissing = () => {
		state.actingRole = null;
	};
	const setTargetRole = (role: string) => {
		state.targetRole = role;
	};

	// ONE resolver, shared by the top-level client and the transaction client,
	// because `inviteMember` resolves the actor through `prisma` while
	// `updateOrgMemberRole` resolves it through `tx`. Two copies would let the
	// two paths disagree about who the caller is.
	const findMember = vi.fn(
		async (args: { where: { userId?: string; id?: string } }) =>
			args.where.id === undefined
				? // ACTOR lookup — keyed { organizationId, userId }
					state.actingRole === null
					? null
					: { role: state.actingRole }
				: // TARGET lookup — keyed { id, organizationId }
					{ userId: 'target-user', role: state.targetRole },
	);

	const mockTransaction = vi.fn(
		async (fn: (tx: unknown) => Promise<unknown>) => {
			const tx = {
				organizationInvitation: {
					create: vi.fn().mockResolvedValue({ id: 'inv-1' }),
				},
				organizationMember: {
					findFirst: findMember,
					update: vi.fn().mockResolvedValue({ id: 'mem-1', role: 'STAFF' }),
					delete: vi.fn().mockResolvedValue({ id: 'mem-1' }),
				},
				auditLog: { create: mockCreate },
			};
			return fn(tx);
		},
	);
	return {
		mockTransaction,
		findMember,
		setActingRole,
		setActingMemberMissing,
		setTargetRole,
	};
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
			findFirst: findMember,
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

import { isClientSafeErrorCode } from '@/server/domain/error-disclosure';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	inviteMember,
	removeOrgMember,
	updateOrgMemberRole,
} from '../memberService';

describe('memberService audit logging', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setActingRole('OWNER');
	});

	it('T10: inviteMember writes MEMBER_INVITED audit log transactionally', async () => {
		await inviteMember(
			'org-1',
			'test@example.com',
			'STAFF',
			'http://localhost:3000',
			'actor-1',
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
		setActingRole('ADMIN');
		await expect(
			inviteMember(
				'org-1',
				'test@example.com',
				'ADMIN',
				'http://localhost:3000',
				'actor-1',
			),
		).rejects.toThrow('Only the organization owner can invite an Admin.');
	});
});

/**
 * The ADMIN tier is OWNER-granted only, and it is granted through TWO doors —
 * an invitation and a role change. `inviteMember` guarded its door from the
 * start; `updateOrgMemberRole` never did, while the client rendered
 * `{isOwner && <SelectItem value="ADMIN">}` on both, which is what made the gap
 * look closed. These tests exist to keep both doors shut.
 */
describe('memberService: only an OWNER may grant the ADMIN tier', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setActingRole('OWNER');
		setTargetRole('STAFF');
	});

	it('SECURITY: an ADMIN cannot promote a member to ADMIN', async () => {
		setActingRole('ADMIN');
		await expect(
			updateOrgMemberRole('org-1', 'actor-1', 'mem-1', 'ADMIN'),
		).rejects.toThrow('Only the organization owner can grant the Admin role.');
		expect(writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('SECURITY: the acting role is read from the DB, not taken on trust', async () => {
		// The actor lookup is keyed on the ACTING user id, in the same org. If this
		// ever regresses to a caller-supplied role the query disappears and this
		// assertion goes red — which is the only thing standing between the rule
		// and a parameter that fails open when omitted.
		setActingRole('ADMIN');
		await expect(
			updateOrgMemberRole('org-1', 'actor-1', 'mem-1', 'ADMIN'),
		).rejects.toThrow();
		expect(findMember).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { organizationId: 'org-1', userId: 'actor-1' },
			}),
		);
	});

	it('an OWNER can promote a member to ADMIN', async () => {
		await expect(
			updateOrgMemberRole('org-1', 'actor-1', 'mem-1', 'ADMIN'),
		).resolves.toBeDefined();
		expect(writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'ROLE_CHANGED',
				metadata: expect.objectContaining({ newRole: 'ADMIN' }),
			}),
		);
	});

	// Contrast case: without this, the refusal above could be an ADMIN being
	// unable to change ANY role, and the test would pass just as green.
	it.each([
		'STAFF',
		'READONLY',
	] as const)('an ADMIN can still set a member to %s', async (role) => {
		setActingRole('ADMIN');
		await expect(
			updateOrgMemberRole('org-1', 'actor-1', 'mem-1', role),
		).resolves.toBeDefined();
	});

	it('SECURITY: a non-member acting id is refused outright', async () => {
		setActingMemberMissing();
		await expect(
			updateOrgMemberRole('org-1', 'stranger', 'mem-1', 'STAFF'),
		).rejects.toThrow('You are not a member of this organization.');
	});

	it('SECURITY: an ADMIN cannot invite at the ADMIN tier either', async () => {
		setActingRole('ADMIN');
		await expect(
			inviteMember(
				'org-1',
				'new@example.com',
				'ADMIN',
				'http://localhost:3000',
				'actor-1',
			),
		).rejects.toThrow('Only the organization owner can invite an Admin.');
	});

	it('an OWNER can invite at the ADMIN tier', async () => {
		await expect(
			inviteMember(
				'org-1',
				'new@example.com',
				'ADMIN',
				'http://localhost:3000',
				'actor-1',
			),
		).resolves.toEqual({ sent: true });
	});
});

/**
 * Branches the rule's own tests do not reach, found by the /ship coverage audit.
 */
describe('memberService: actor-resolution edge cases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setActingRole('OWNER');
		setTargetRole('STAFF');
	});

	it('SECURITY: an empty acting id is refused without querying for it', async () => {
		// `inviteMember`'s `actorId` is optional and the router coalesces a missing
		// session id to ''. The short-circuit means '' never reaches Prisma as a
		// `userId` filter — the refusal does not depend on how the database happens
		// to treat an empty string.
		await expect(
			inviteMember('org-1', 'test@example.com', 'STAFF', 'http://x', null),
		).rejects.toThrow('You are not a member of this organization.');
		expect(findMember).not.toHaveBeenCalled();
	});

	it.each([
		'STAFF',
		'READONLY',
	] as const)('SECURITY: a %s caller is refused even for a non-ADMIN target', async (callerRole) => {
		// Found by the /ship Codex adversarial pass. `assertMayGrantRole` returns
		// early below the ADMIN tier, so without the floor in `resolveActingRole`
		// the role we just paid a query for would gate ADMIN targets ONLY — and a
		// caller demoted between context-build and service-call could still flip
		// members between STAFF and READONLY. `adminProcedure` is checked once per
		// request against a role resolved earlier; this reads the row as it stands.
		setActingRole(callerRole);
		await expect(
			updateOrgMemberRole('org-1', 'actor-1', 'mem-1', 'READONLY'),
		).rejects.toThrow('You do not have permission to manage members.');
		await expect(
			inviteMember('org-1', 'x@example.com', 'STAFF', 'http://x', 'actor-1'),
		).rejects.toThrow('You do not have permission to manage members.');
	});

	it('refuses an ADMIN re-submitting ADMIN for a member who already has it', async () => {
		// The documented trade-off of checking the tier BEFORE the target lookup:
		// this would otherwise have fallen through to the no-op branch and quietly
		// succeeded. Pinning it means the ordering cannot be "simplified" back
		// without a red test explaining what it costs.
		setActingRole('ADMIN');
		setTargetRole('ADMIN');
		await expect(
			updateOrgMemberRole('org-1', 'actor-1', 'mem-1', 'ADMIN'),
		).rejects.toThrow('Only the organization owner can grant the Admin role.');
	});

	it('an OWNER re-submitting the current role is still a no-op', async () => {
		// Contrast: the no-op branch itself is intact, so the test above is about
		// the tier rule and not about no-ops having been broken generally.
		setTargetRole('STAFF');
		await expect(
			updateOrgMemberRole('org-1', 'actor-1', 'mem-1', 'STAFF'),
		).resolves.toBeDefined();
		expect(writeAuditLogTx).not.toHaveBeenCalled();
	});
});

/**
 * Every refusal below is hand-authored copy the user must READ to know what to
 * do differently — "you can't remove the owner" is the whole answer. They were
 * plain `Error`s until T37, and tRPC maps a plain Error to
 * INTERNAL_SERVER_ERROR, which `errorFormatter` redacts to "Something went
 * wrong. Please try again." before it is serialized.
 *
 * These assert the CODE, not the text, and that distinction is the entire point:
 * `rejects.toThrow('Cannot remove yourself.')` passes for a plain Error just as
 * happily, so a message-based test cannot see this regression at all. Note the
 * nine `rejects.toThrow` assertions in the suite above target
 * `assertMayGrantRole`/`resolveActingRole`, which were ALREADY TRPCErrors — they
 * look like coverage of these refusals and are not.
 */
describe('memberService refusals carry an allowlisted code', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setActingRole('OWNER');
		setTargetRole('STAFF');
	});

	it('removeOrgMember: owner target -> FORBIDDEN', async () => {
		setTargetRole('OWNER');
		await expect(
			removeOrgMember('org-1', 'actor-1', 'mem-1'),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('removeOrgMember: removing yourself -> BAD_REQUEST', async () => {
		// The target lookup resolves to userId 'target-user'.
		await expect(
			removeOrgMember('org-1', 'target-user', 'mem-1'),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('removeOrgMember: missing target -> NOT_FOUND', async () => {
		findMember.mockImplementationOnce(async () => null);
		await expect(
			removeOrgMember('org-1', 'actor-1', 'gone'),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('updateOrgMemberRole: promoting to OWNER -> BAD_REQUEST', async () => {
		await expect(
			updateOrgMemberRole('org-1', 'actor-1', 'mem-1', 'OWNER'),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it("updateOrgMemberRole: owner's role -> FORBIDDEN", async () => {
		setTargetRole('OWNER');
		await expect(
			updateOrgMemberRole('org-1', 'actor-1', 'mem-1', 'STAFF'),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('updateOrgMemberRole: your own role -> BAD_REQUEST', async () => {
		await expect(
			updateOrgMemberRole('org-1', 'target-user', 'mem-1', 'STAFF'),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('inviteMember: unknown org -> NOT_FOUND', async () => {
		const { prisma } = await import('@/server/repositories/prisma');
		vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(
			null as never,
		);

		await expect(
			inviteMember('org-gone', 'a@example.org', 'STAFF', 'http://x', 'actor-1'),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});

	it('inviteMember: already a member -> CONFLICT', async () => {
		const { prisma } = await import('@/server/repositories/prisma');
		vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
			id: 'u-existing',
		} as never);

		await expect(
			inviteMember(
				'org-1',
				'taken@example.org',
				'STAFF',
				'http://x',
				'actor-1',
			),
		).rejects.toMatchObject({ code: 'CONFLICT' });
	});

	it('every refusal code above is in the shared allowlist', () => {
		// The codes are only useful because the formatter lets them through. If
		// the allowlist ever narrows, this is what says so.
		for (const code of ['FORBIDDEN', 'BAD_REQUEST', 'NOT_FOUND', 'CONFLICT']) {
			expect(isClientSafeErrorCode(code)).toBe(true);
		}
	});
});
