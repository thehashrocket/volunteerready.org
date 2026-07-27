/**
 * Access-guard coverage for initiateBackgroundCheck.
 *
 * This is the highest-stakes of the three unscoped-userId fixes: the mutation
 * ships a candidate's SSN and date of birth to a paid third-party API, and its
 * only UI is a free-text "Volunteer User ID" field. So the assertion that
 * matters is not merely that the call is refused — it is that the adapter is
 * never reached, i.e. the guard sits in front of the remote side effect rather
 * than behind it.
 *
 * The guard lives in the shared private `initiateProviderCheck`, so Sterling
 * gets it too; `initiateBackgroundCheck` is the Checkr entry point exercised
 * here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireOrgVolunteerRelationship: vi.fn(),
	initiateCheck: vi.fn(),
	findActiveCheckForUserInOrg: vi.fn(),
	findCredentialByUserOrgType: vi.fn(),
	orgFindUnique: vi.fn(),
	tryDecrypt: vi.fn(),
	createBackgroundCheckRequestTx: vi.fn(),
	writeAuditLogTx: vi.fn(),
}));

vi.mock('@/server/services/orgVolunteerAccessService', () => ({
	requireOrgVolunteerRelationship: mocks.requireOrgVolunteerRelationship,
}));

vi.mock('@/server/lib/adapters/background-check/checkr', () => ({
	checkrAdapter: { initiateCheck: mocks.initiateCheck },
	CheckrApiError: class CheckrApiError extends Error {},
	CheckrSignatureError: class CheckrSignatureError extends Error {},
	CheckrBadPayloadError: class CheckrBadPayloadError extends Error {},
}));

vi.mock('@/server/lib/adapters/background-check/sterling', () => ({
	sterlingAdapter: { initiateCheck: vi.fn() },
	SterlingApiError: class SterlingApiError extends Error {},
	SterlingSignatureError: class SterlingSignatureError extends Error {},
	SterlingBadPayloadError: class SterlingBadPayloadError extends Error {},
}));

vi.mock('@/server/repositories/backgroundCheckRepo', () => ({
	findActiveCheckForUserInOrg: mocks.findActiveCheckForUserInOrg,
	createBackgroundCheckRequestTx: mocks.createBackgroundCheckRequestTx,
	findBackgroundCheckById: vi.fn(),
	listBackgroundChecksByOrg: vi.fn(),
}));

vi.mock('@/server/repositories/volunteerCredentialRepo', () => ({
	findCredentialByUserOrgType: mocks.findCredentialByUserOrgType,
	upsertCredential: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/lib/crypto', () => ({
	encrypt: vi.fn(),
	tryDecrypt: mocks.tryDecrypt,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: { findUnique: mocks.orgFindUnique },
		$transaction: async (fn: (tx: unknown) => unknown) => fn({}),
	},
}));

vi.mock('@/server/repositories/sendFcraEmails', () => ({
	sendAdverseActionEmail: vi.fn(),
	sendPreAdverseActionEmail: vi.fn(),
}));
vi.mock('@/server/repositories/sendBackgroundCheckEmail', () => ({
	sendBackgroundCheckConsiderEmail: vi.fn(),
}));
vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));

import { TRPCError } from '@trpc/server';
import { initiateBackgroundCheck } from '../backgroundCheckService';

const input = {
	orgId: 'org-1',
	userId: 'user-1',
	actorId: 'actor-1',
	pii: {
		firstName: 'Jane',
		lastName: 'Doe',
		email: 'jane@example.com',
		dob: '1990-01-01',
		ssn: '123456789',
	},
};

beforeEach(() => {
	vi.resetAllMocks();
	mocks.orgFindUnique.mockResolvedValue({ checkrAccessToken: 'enc' });
	mocks.tryDecrypt.mockReturnValue('token');
	mocks.findActiveCheckForUserInOrg.mockResolvedValue(null);
	mocks.findCredentialByUserOrgType.mockResolvedValue(null);
	mocks.initiateCheck.mockResolvedValue({ reportId: 'rpt-1' });
	mocks.createBackgroundCheckRequestTx.mockResolvedValue({ id: 'req-1' });
});

describe('initiateBackgroundCheck access guard', () => {
	it('runs the check for a volunteer of the org', async () => {
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('ORG_VOLUNTEER');

		await expect(initiateBackgroundCheck(input)).resolves.toEqual({
			requestId: 'req-1',
		});
		expect(mocks.initiateCheck).toHaveBeenCalledOnce();
	});

	it('SECURITY: checks the target against the initiating org', async () => {
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('APPLICATION');

		await initiateBackgroundCheck(input);

		expect(mocks.requireOrgVolunteerRelationship).toHaveBeenCalledWith(
			'org-1',
			'user-1',
		);
	});

	it('SECURITY: refuses a userId with no relationship to the org', async () => {
		mocks.requireOrgVolunteerRelationship.mockRejectedValue(
			new TRPCError({ code: 'NOT_FOUND' }),
		);

		await expect(initiateBackgroundCheck(input)).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('SECURITY: never sends PII to the provider when the guard rejects', async () => {
		// The whole point of guarding before the adapter call: a check placed
		// after it would already have disclosed SSN and DOB to a third party
		// and incurred the charge.
		mocks.requireOrgVolunteerRelationship.mockRejectedValue(
			new TRPCError({ code: 'NOT_FOUND' }),
		);

		await expect(initiateBackgroundCheck(input)).rejects.toThrow();

		expect(mocks.initiateCheck).not.toHaveBeenCalled();
		expect(mocks.createBackgroundCheckRequestTx).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});
});
