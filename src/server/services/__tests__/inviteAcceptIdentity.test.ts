/**
 * SECURITY: invitation acceptance must resolve the caller's address from the
 * caller's user id.
 *
 * `createTRPCContext` builds the exposed session as
 * `{ ...realSession.user, id: effectiveUserId }` — under impersonation only `id`
 * is swapped, so `ctx.session.user.email` stays the REAL ADMIN'S. Both accept
 * paths used to authorize on a passed-in email while creating the membership row
 * for the passed-in id, so an admin holding an invitation addressed to
 * themselves could mint a membership for the impersonated victim. `ORG_MEMBER` is
 * one of the relationship kinds `requireOrgVolunteerRelationship()` accepts as
 * authorization over a volunteer, so that row is not inert.
 *
 * Both services now take only an id. These tests pin that, and pin that the
 * comparison is canonicalizing rather than a bare `.toLowerCase()`.
 */

const mocks = vi.hoisted(() => ({
	findEmailByUserId: vi.fn(),
	findValidInvitationByHash: vi.fn(),
	findCompanyInvitationByTokenHash: vi.fn(),
	markInvitationUsed: vi.fn(),
	markCompanyInvitationUsedTx: vi.fn(),
	writeAuditLogTx: vi.fn(),
	orgMemberFindFirst: vi.fn(),
	orgMemberCreate: vi.fn(),
	companyMemberFindUnique: vi.fn(),
	companyMemberCreate: vi.fn(),
	invitationUpdate: vi.fn(),
	companyInvitationUpdate: vi.fn(),
	transaction: vi.fn(),
}));

vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	findEmailByUserId: mocks.findEmailByUserId,
}));

vi.mock('@/server/repositories/inviteRepo', () => ({
	findInvitationByHash: vi.fn(),
	findValidInvitationByHash: mocks.findValidInvitationByHash,
	markInvitationUsed: mocks.markInvitationUsed,
}));

vi.mock('@/server/repositories/companyInviteRepo', () => ({
	createCompanyInvitationTx: vi.fn(),
	findCompanyInvitationByTokenHash: mocks.findCompanyInvitationByTokenHash,
	markCompanyInvitationUsedTx: mocks.markCompanyInvitationUsedTx,
}));

vi.mock('@/server/repositories/companyRepo', () => ({
	createCompanyWithOwnerTx: vi.fn(),
	findCompanyBySlug: vi.fn(),
	getCompanyMembership: vi.fn(),
	setNonprofitLinkStatusTx: vi.fn(),
	upsertNonprofitLinkTx: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/repositories/sendInviteEmail', () => ({
	sendInviteEmail: vi.fn(),
}));

vi.mock('@/server/lib/admin-alerts', () => ({ sendNewCompanyAlert: vi.fn() }));
vi.mock('@/server/lib/email', () => ({ sendEmail: vi.fn() }));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: mocks.transaction,
		organizationMember: {
			findFirst: mocks.orgMemberFindFirst,
			create: mocks.orgMemberCreate,
		},
		companyMember: {
			findUnique: mocks.companyMemberFindUnique,
			create: mocks.companyMemberCreate,
		},
		organizationInvitation: { update: mocks.invitationUpdate },
		companyInvitation: { update: mocks.companyInvitationUpdate },
	},
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptCompanyInvite } from '@/server/services/companyService';
import { acceptInvitation } from '@/server/services/memberService';

const TARGET_ID = 'target-1';
const TARGET_EMAIL = 'volunteer@example.test';
const ADMIN_EMAIL = 'admin@example.test';

/** Transaction stand-in exposing the tables both services write. */
const fakeTx = {
	organizationInvitation: { update: mocks.invitationUpdate },
	organizationMember: { create: mocks.orgMemberCreate },
	companyMember: { create: mocks.companyMemberCreate },
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
		fn(fakeTx),
	);
	mocks.findEmailByUserId.mockResolvedValue(TARGET_EMAIL);
	mocks.orgMemberFindFirst.mockResolvedValue(null);
	mocks.companyMemberFindUnique.mockResolvedValue(null);
	mocks.writeAuditLogTx.mockResolvedValue(undefined);
	mocks.markCompanyInvitationUsedTx.mockResolvedValue(undefined);
});

describe('acceptInvitation (org)', () => {
	beforeEach(() => {
		mocks.findValidInvitationByHash.mockResolvedValue({
			id: 'inv-1',
			orgId: 'org-1',
			email: TARGET_EMAIL,
			role: 'STAFF',
		});
	});

	it('resolves the address from the accepting user id', async () => {
		await acceptInvitation('raw-token', TARGET_ID);

		expect(mocks.findEmailByUserId).toHaveBeenCalledWith(TARGET_ID);
	});

	it('creates the membership for the same id the address was resolved from', async () => {
		await acceptInvitation('raw-token', TARGET_ID);

		expect(mocks.orgMemberCreate).toHaveBeenCalledWith({
			data: { organizationId: 'org-1', userId: TARGET_ID, role: 'STAFF' },
		});
	});

	it('SECURITY: refuses when the invitation was addressed to someone else', async () => {
		// The impersonation case: an admin whose OWN address matches the invitation
		// acting as a target whose address does not. Authorization now reads the
		// target's address, so this is refused instead of minting a row for them.
		mocks.findValidInvitationByHash.mockResolvedValue({
			id: 'inv-1',
			orgId: 'org-1',
			email: ADMIN_EMAIL,
			role: 'STAFF',
		});

		await expect(acceptInvitation('raw-token', TARGET_ID)).rejects.toThrow(
			/different email address/i,
		);
		expect(mocks.orgMemberCreate).not.toHaveBeenCalled();
	});

	it('SECURITY: refuses when the accepting user has no address on file', async () => {
		// Must not fall through to a comparison against an empty string, which an
		// invitation row with an empty email would satisfy.
		mocks.findEmailByUserId.mockResolvedValue(null);

		await expect(acceptInvitation('raw-token', TARGET_ID)).rejects.toThrow(
			/no email address/i,
		);
		expect(mocks.orgMemberCreate).not.toHaveBeenCalled();
	});

	it('matches case-insensitively and tolerates stored whitespace', async () => {
		// `normalizeEmail` is lower(btrim(...)) — the same canonicalization the T1
		// database trigger applies to `User.email` — so a legacy invitation row that
		// was never canonicalized still matches.
		mocks.findValidInvitationByHash.mockResolvedValue({
			id: 'inv-1',
			orgId: 'org-1',
			email: `  ${TARGET_EMAIL.toUpperCase()} `,
			role: 'STAFF',
		});

		await expect(
			acceptInvitation('raw-token', TARGET_ID),
		).resolves.toMatchObject({ orgId: 'org-1' });
	});
});

describe('acceptCompanyInvite', () => {
	beforeEach(() => {
		mocks.findCompanyInvitationByTokenHash.mockResolvedValue({
			id: 'cinv-1',
			companyId: 'co-1',
			email: TARGET_EMAIL,
			role: 'MEMBER',
			usedAt: null,
			expiresAt: new Date('2099-01-01'),
		});
	});

	it('resolves the address from the accepting user id', async () => {
		await acceptCompanyInvite({ tokenHash: 'hash', userId: TARGET_ID });

		expect(mocks.findEmailByUserId).toHaveBeenCalledWith(TARGET_ID);
	});

	it('creates the membership for the same id the address was resolved from', async () => {
		await acceptCompanyInvite({ tokenHash: 'hash', userId: TARGET_ID });

		expect(mocks.companyMemberCreate).toHaveBeenCalledWith({
			data: { companyId: 'co-1', userId: TARGET_ID, role: 'MEMBER' },
		});
	});

	it('SECURITY: refuses when the invitation was addressed to someone else', async () => {
		mocks.findCompanyInvitationByTokenHash.mockResolvedValue({
			id: 'cinv-1',
			companyId: 'co-1',
			email: ADMIN_EMAIL,
			role: 'MEMBER',
			usedAt: null,
			expiresAt: new Date('2099-01-01'),
		});

		await expect(
			acceptCompanyInvite({ tokenHash: 'hash', userId: TARGET_ID }),
		).rejects.toThrow(/different email address/i);
		expect(mocks.companyMemberCreate).not.toHaveBeenCalled();
	});

	it('SECURITY: refuses when the accepting user has no address on file', async () => {
		mocks.findEmailByUserId.mockResolvedValue(null);

		await expect(
			acceptCompanyInvite({ tokenHash: 'hash', userId: TARGET_ID }),
		).rejects.toThrow(/no email address/i);
		expect(mocks.companyMemberCreate).not.toHaveBeenCalled();
	});

	it('audits the RESOLVED address, not one supplied by the caller', async () => {
		// The audit row is the record of who joined. Stamping a caller-supplied
		// address would attribute the join to whoever the session happened to name.
		await acceptCompanyInvite({ tokenHash: 'hash', userId: TARGET_ID });

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				action: 'COMPANY_MEMBER_ADDED',
				metadata: expect.objectContaining({ email: TARGET_EMAIL }),
			}),
		);
	});

	it('stamps impersonatedBy so the real admin behind the accept is attributable', async () => {
		// The service already supported this; the tRPC router simply never wired it
		// up for accept, unlike invite.
		await acceptCompanyInvite({
			tokenHash: 'hash',
			userId: TARGET_ID,
			impersonatedBy: 'admin-9',
		});

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				metadata: expect.objectContaining({ impersonatedBy: 'admin-9' }),
			}),
		);
	});
});
