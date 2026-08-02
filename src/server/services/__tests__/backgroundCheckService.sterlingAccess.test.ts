/**
 * Access-guard coverage for initiateSterlingCheck — the SECOND provider entry
 * point.
 *
 * backgroundCheckService.access.test.ts exercises `initiateBackgroundCheck`
 * (Checkr) and asserts in prose that "the guard lives in the shared private
 * `initiateProviderCheck`, so Sterling gets it too". Prose is not a test. If
 * someone later hoists the guard up into `initiateBackgroundCheck` — a very
 * natural refactor, since that is the caller the reviewer sees — Sterling
 * silently loses it and the whole existing suite stays green.
 *
 * This file is the regression tripwire for that refactor: it drives the
 * Sterling entry point end-to-end and asserts the guard fires in front of the
 * Sterling adapter, which receives the same SSN and date of birth as Checkr.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireOrgVolunteerRelationship: vi.fn(),
	sterlingInitiateCheck: vi.fn(),
	checkrInitiateCheck: vi.fn(),
	findActiveCheckForUserInOrg: vi.fn(),
	findCredentialByUserOrgType: vi.fn(),
	orgFindUnique: vi.fn(),
	tryDecrypt: vi.fn(),
	createBackgroundCheckRequestTx: vi.fn(),
	writeAuditLogTx: vi.fn(),
	sendInitiatedEmail: vi.fn(),
	findEmailByUserId: vi.fn(),
}));

vi.mock('@/server/services/orgVolunteerAccessService', () => ({
	requireOrgVolunteerRelationship: mocks.requireOrgVolunteerRelationship,
}));

vi.mock('@/server/lib/adapters/background-check/sterling', () => ({
	sterlingAdapter: { initiateCheck: mocks.sterlingInitiateCheck },
	SterlingApiError: class SterlingApiError extends Error {},
	SterlingSignatureError: class SterlingSignatureError extends Error {},
	SterlingBadPayloadError: class SterlingBadPayloadError extends Error {},
	// These four extend `Error` directly, NOT SterlingApiError, which is why
	// `initiateProviderCheck` takes a LIST of classes — a single-class
	// `instanceof` let an expired credential, a 429 and a timeout fall through
	// as opaque INTERNAL_SERVER_ERRORs.
	SterlingAuthError: class SterlingAuthError extends Error {},
	SterlingValidationError: class SterlingValidationError extends Error {},
	SterlingRateLimitError: class SterlingRateLimitError extends Error {},
	SterlingTimeoutError: class SterlingTimeoutError extends Error {},
}));

vi.mock('@/server/lib/adapters/background-check/checkr', () => ({
	checkrAdapter: { initiateCheck: mocks.checkrInitiateCheck },
	CheckrApiError: class CheckrApiError extends Error {},
	CheckrSignatureError: class CheckrSignatureError extends Error {},
	CheckrBadPayloadError: class CheckrBadPayloadError extends Error {},
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
	sendBackgroundCheckInitiatedEmail: mocks.sendInitiatedEmail,
}));
vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	findEmailByUserId: mocks.findEmailByUserId,
}));
vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));

import { TRPCError } from '@trpc/server';
import { initiateSterlingCheck } from '../backgroundCheckService';

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
	// Without this Guard 0 refuses before any query and every test here passes
	// vacuously — see the same note in backgroundCheckService.access.test.ts.
	consentAttested: true,
};

beforeEach(() => {
	vi.resetAllMocks();
	// getOrgSterlingKey reads sterlingApiKey, not checkrAccessToken.
	mocks.orgFindUnique.mockResolvedValue({
		sterlingApiKey: 'enc',
		name: 'Helping Hands',
	});
	mocks.findEmailByUserId.mockResolvedValue('jane@example.com');
	mocks.tryDecrypt.mockReturnValue('sterling-key');
	mocks.findActiveCheckForUserInOrg.mockResolvedValue(null);
	mocks.findCredentialByUserOrgType.mockResolvedValue(null);
	mocks.sterlingInitiateCheck.mockResolvedValue({ reportId: 'strl-1' });
	mocks.createBackgroundCheckRequestTx.mockResolvedValue({ id: 'req-1' });
});

describe('initiateSterlingCheck access guard', () => {
	it('runs the check for a volunteer of the org', async () => {
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('SHIFT_SIGNUP');

		await expect(initiateSterlingCheck(input)).resolves.toEqual({
			requestId: 'req-1',
		});
		expect(mocks.sterlingInitiateCheck).toHaveBeenCalledOnce();
	});

	it('SECURITY: the Sterling entry point is guarded, not just Checkr', async () => {
		// The assertion that the shared `initiateProviderCheck` is where the
		// guard lives. Hoisting it into initiateBackgroundCheck turns this red.
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('APPLICATION');

		await initiateSterlingCheck(input);

		expect(mocks.requireOrgVolunteerRelationship).toHaveBeenCalledWith(
			'org-1',
			'user-1',
		);
	});

	it('SECURITY: never sends PII to Sterling when the guard rejects', async () => {
		mocks.requireOrgVolunteerRelationship.mockRejectedValue(
			new TRPCError({ code: 'NOT_FOUND' }),
		);

		await expect(initiateSterlingCheck(input)).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});

		expect(mocks.sterlingInitiateCheck).not.toHaveBeenCalled();
		expect(mocks.createBackgroundCheckRequestTx).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('records the authorizing relationship on the audit row', async () => {
		// The metadata field the service comment justifies as the thing you
		// most want during an incident review — a roster row can be
		// soft-deleted afterwards, the audit row cannot.
		mocks.requireOrgVolunteerRelationship.mockResolvedValue('ORG_VOLUNTEER');

		await initiateSterlingCheck(input);

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'BACKGROUND_CHECK_INITIATED',
				metadata: expect.objectContaining({
					provider: 'STERLING',
					relationship: 'ORG_VOLUNTEER',
				}),
			}),
		);
	});
});
