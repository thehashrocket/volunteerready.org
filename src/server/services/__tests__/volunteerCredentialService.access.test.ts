/**
 * Access-guard coverage for issueCredential.
 *
 * The only UI for this mutation is a free-text "Volunteer User ID" field
 * (settings/background-checks/page.tsx), so the guard is the only thing
 * stopping a staff user from minting a verification badge on any account in
 * the system by pasting its id. These tests assert the guard runs and that it
 * runs BEFORE the write — a check after the upsert is not a check.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireOrgVolunteerRelationship: vi.fn(),
	upsertCredential: vi.fn(),
	writeAuditLogTx: vi.fn(),
	checkAndIssueTenureBadges: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({}) },
}));

vi.mock('@/server/repositories/volunteerCredentialRepo', () => ({
	upsertCredential: mocks.upsertCredential,
	deleteCredential: vi.fn(),
	getCredentialsByOrg: vi.fn(),
	getCredentialsByUserAndOrg: vi.fn(),
	getCredentialsByUserId: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: mocks.checkAndIssueTenureBadges,
}));

vi.mock('@/server/services/orgVolunteerAccessService', () => ({
	requireOrgVolunteerRelationship: mocks.requireOrgVolunteerRelationship,
}));

import { TRPCError } from '@trpc/server';
import {
	issueCredential,
	revokeCredential,
} from '../volunteerCredentialService';

const input = {
	userId: 'user-1',
	orgId: 'org-1',
	type: 'BACKGROUND_CHECK' as const,
	status: 'VERIFIED' as const,
};

beforeEach(() => {
	vi.resetAllMocks();
	mocks.upsertCredential.mockResolvedValue({ id: 'cred-1' });
});

describe('issueCredential access guard', () => {
	it('issues normally for a volunteer of the org', async () => {
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('ORG_VOLUNTEER');

		await issueCredential(input, 'actor-1');

		expect(mocks.upsertCredential).toHaveBeenCalledOnce();
	});

	it('SECURITY: checks the target against the issuing org', async () => {
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('APPLICATION');

		await issueCredential(input, 'actor-1');

		expect(mocks.requireOrgVolunteerRelationship).toHaveBeenCalledWith(
			'org-1',
			'user-1',
		);
	});

	it('SECURITY: does NOT accept an existing credential as its own justification', async () => {
		// The circular case. `revokeCredential` opts into
		// `acceptExistingCredential`; issue must never do so, or the first
		// illegitimate write mints the relationship justifying the next.
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('APPLICATION');

		await issueCredential(input, 'actor-1');

		expect(mocks.requireOrgVolunteerRelationship).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ acceptExistingCredential: true }),
		);
	});

	it('SECURITY: refuses a userId with no relationship to the org', async () => {
		mocks.requireOrgVolunteerRelationship.mockRejectedValue(
			new TRPCError({ code: 'NOT_FOUND' }),
		);

		await expect(issueCredential(input, 'actor-1')).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('SECURITY: writes nothing when the guard rejects', async () => {
		mocks.requireOrgVolunteerRelationship.mockRejectedValue(
			new TRPCError({ code: 'NOT_FOUND' }),
		);

		await expect(issueCredential(input, 'actor-1')).rejects.toThrow();

		expect(mocks.upsertCredential).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
		expect(mocks.checkAndIssueTenureBadges).not.toHaveBeenCalled();
	});
});

describe('revokeCredential access guard', () => {
	// "Revoke" reads like it can only narrow an existing row, but it shares
	// `upsertCredential` with issue, and that upsert has a `create` branch. So
	// this needs the same guard as issue, for a less obvious reason.
	it('revokes normally for a volunteer of the org', async () => {
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('APPLICATION');

		await revokeCredential('user-1', 'org-1', 'BACKGROUND_CHECK', 'actor-1');

		expect(mocks.upsertCredential).toHaveBeenCalledOnce();
	});

	it('SECURITY: checks the target against the revoking org', async () => {
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('APPLICATION');

		await revokeCredential('user-1', 'org-1', 'BACKGROUND_CHECK', 'actor-1');

		expect(mocks.requireOrgVolunteerRelationship).toHaveBeenCalledWith(
			'org-1',
			'user-1',
			{ acceptExistingCredential: true },
		);
	});

	it('accepts a de-rostered volunteer whose only tie is the credential itself', async () => {
		// Regression: soft-deleting the roster row used to strand the credential
		// — still listed by listOrgCredentials, but permanently unrevocable.
		// Safe here and only here, because revoking cannot mint privilege.
		mocks.requireOrgVolunteerRelationship.mockResolvedValue(
			'EXISTING_CREDENTIAL',
		);

		await revokeCredential('user-1', 'org-1', 'BACKGROUND_CHECK', 'actor-1');

		expect(mocks.upsertCredential).toHaveBeenCalledOnce();
	});

	it('SECURITY: cannot mint a REVOKED credential on a stranger', async () => {
		// Ungated this created a REVOKED row on an arbitrary account attributed
		// to the caller's org — and `getCredentialsByUserId` has no org filter,
		// so the victim would see it on their own credentials page.
		mocks.requireOrgVolunteerRelationship.mockRejectedValue(
			new TRPCError({ code: 'NOT_FOUND' }),
		);

		await expect(
			revokeCredential('stranger', 'org-1', 'BACKGROUND_CHECK', 'actor-1'),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.upsertCredential).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});
});
