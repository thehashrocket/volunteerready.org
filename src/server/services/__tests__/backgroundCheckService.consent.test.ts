/**
 * FCRA consent attestation (Guard 0) and the volunteer's initiation notice.
 *
 * These are the two halves of one fix. `backgroundChecks.initiate` is gated by
 * `requireOrgVolunteerRelationship`, which accepts `ORG_VOLUNTEER` — a roster
 * row staff mint from an email address alone, sixty at a time via
 * `pnpm import:roster`. So the platform could make a paid third-party call
 * carrying someone's SSN and date of birth with no record that they had ever
 * agreed, and — the part that mattered more — no way for them to find out. The
 * only background-check email went to org STAFF on a CONSIDER result, and the
 * volunteer heard from the platform only on the FCRA pre-adverse path, i.e.
 * only if the report came back bad AND the coordinator acted on it.
 *
 * Requiring a consent-bearing relationship instead was considered and rejected:
 * the coordinator must already hold the SSN and DOB to submit the form, so the
 * edge adds no consent that is not already there, while blocking the concierge
 * case outright. The subject is the only party who can detect an unauthorized
 * check, so the fix is disclosure.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireOrgVolunteerRelationship: vi.fn(),
	checkrInitiateCheck: vi.fn(),
	sterlingInitiateCheck: vi.fn(),
	findActiveCheckForUserInOrg: vi.fn(),
	findCredentialByUserOrgType: vi.fn(),
	orgFindUnique: vi.fn(),
	tryDecrypt: vi.fn(),
	createBackgroundCheckRequestTx: vi.fn(),
	writeAuditLogTx: vi.fn(),
	sendInitiatedEmail: vi.fn(),
	findEmailByUserId: vi.fn(),
	waitUntil: vi.fn(),
}));

vi.mock('@/server/services/orgVolunteerAccessService', () => ({
	requireOrgVolunteerRelationship: mocks.requireOrgVolunteerRelationship,
}));

vi.mock('@/server/lib/adapters/background-check/checkr', () => ({
	checkrAdapter: { initiateCheck: mocks.checkrInitiateCheck },
	CheckrApiError: class CheckrApiError extends Error {},
	CheckrSignatureError: class CheckrSignatureError extends Error {},
	CheckrBadPayloadError: class CheckrBadPayloadError extends Error {},
}));

vi.mock('@/server/lib/adapters/background-check/sterling', () => ({
	sterlingAdapter: { initiateCheck: mocks.sterlingInitiateCheck },
	SterlingApiError: class SterlingApiError extends Error {},
	SterlingSignatureError: class SterlingSignatureError extends Error {},
	SterlingBadPayloadError: class SterlingBadPayloadError extends Error {},
	SterlingAuthError: class SterlingAuthError extends Error {},
	SterlingValidationError: class SterlingValidationError extends Error {},
	SterlingRateLimitError: class SterlingRateLimitError extends Error {},
	SterlingTimeoutError: class SterlingTimeoutError extends Error {},
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
// Passes the promise straight through, so the notification still runs here and
// every assertion below is about real behaviour rather than the wrapper.
vi.mock('@vercel/functions', () => ({
	waitUntil: mocks.waitUntil.mockImplementation((p: Promise<unknown>) => p),
}));

import {
	initiateBackgroundCheck,
	initiateSterlingCheck,
} from '../backgroundCheckService';

/**
 * The address the coordinator TYPED. Deliberately different from the one on the
 * User record — see the SECURITY test below.
 */
const TYPED_EMAIL = 'coordinator-controlled@example.com';
/** The address actually on the volunteer's User row. */
const ACCOUNT_EMAIL = 'jane@example.com';

const input = {
	orgId: 'org-1',
	userId: 'user-1',
	actorId: 'actor-1',
	pii: {
		firstName: 'Jane',
		lastName: 'Doe',
		email: TYPED_EMAIL,
		dob: '1990-01-01',
		ssn: '123456789',
	},
	consentAttested: true,
};

beforeEach(() => {
	vi.resetAllMocks();
	mocks.orgFindUnique.mockResolvedValue({
		checkrAccessToken: 'enc',
		sterlingApiKey: 'enc',
		name: 'Helping Hands',
	});
	mocks.tryDecrypt.mockReturnValue('token');
	mocks.findActiveCheckForUserInOrg.mockResolvedValue(null);
	mocks.findCredentialByUserOrgType.mockResolvedValue(null);
	mocks.checkrInitiateCheck.mockResolvedValue({ reportId: 'rpt-1' });
	mocks.sterlingInitiateCheck.mockResolvedValue({ reportId: 'strl-1' });
	mocks.createBackgroundCheckRequestTx.mockResolvedValue({ id: 'req-1' });
	mocks.requireOrgVolunteerRelationship.mockResolvedValue('ORG_VOLUNTEER');
	mocks.findEmailByUserId.mockResolvedValue(ACCOUNT_EMAIL);
	mocks.sendInitiatedEmail.mockResolvedValue(undefined);
});

describe('Guard 0 — FCRA consent attestation', () => {
	it('refuses an unattested check', async () => {
		await expect(
			initiateBackgroundCheck({ ...input, consentAttested: false }),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('refuses with an allowlisted code so the coordinator can read why', async () => {
		// Asserting the CODE, not the message. A `throw new Error(...)` maps to
		// INTERNAL_SERVER_ERROR and `errorFormatter` replaces the text with
		// generic copy — silently, and `rejects.toThrow('…')` passes either way.
		// This is the T37 rule: a message a user is meant to READ needs an
		// allowlisted code.
		await expect(
			initiateBackgroundCheck({ ...input, consentAttested: false }),
		).rejects.toMatchObject({
			code: 'BAD_REQUEST',
			message: expect.stringContaining('signed background check authorization'),
		});
	});

	it('SECURITY: refuses before any query and before the paid provider call', async () => {
		await expect(
			initiateBackgroundCheck({ ...input, consentAttested: false }),
		).rejects.toThrow();

		// Guard 0 sits ahead of the relationship guard deliberately: an unattested
		// request is a fact about the caller's own submission and should not cost
		// a round trip or touch the volunteer's row at all.
		expect(mocks.requireOrgVolunteerRelationship).not.toHaveBeenCalled();
		expect(mocks.checkrInitiateCheck).not.toHaveBeenCalled();
		expect(mocks.createBackgroundCheckRequestTx).not.toHaveBeenCalled();
		expect(mocks.sendInitiatedEmail).not.toHaveBeenCalled();
	});

	it('SECURITY: guards the Sterling entry point too, not just Checkr', async () => {
		// The guard lives in the shared `initiateProviderCheck`. Moving it up into
		// `initiateBackgroundCheck` turns this red.
		await expect(
			initiateSterlingCheck({ ...input, consentAttested: false }),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });

		expect(mocks.sterlingInitiateCheck).not.toHaveBeenCalled();
	});

	it('SECURITY: records the real admin when the attestation is made under impersonation', async () => {
		// `createTRPCContext` rewrites session.user.id to the impersonated TARGET,
		// so `actorId` — and with it `consentAttestedBy` — names the coordinator
		// being impersonated, not the admin who ticked the box. Without the
		// `impersonatedBy` stamp, a platform admin can manufacture evidence that
		// a named coordinator swore they hold someone's signed FCRA
		// authorization. Found by an adversarial pass, not by the checklist.
		await initiateBackgroundCheck({ ...input, impersonatedBy: 'real-admin-1' });

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'BACKGROUND_CHECK_INITIATED',
				metadata: expect.objectContaining({ impersonatedBy: 'real-admin-1' }),
			}),
		);
	});

	it('writes no impersonatedBy key on an ordinary request', async () => {
		// Stamping null on every row would make queryAuditLog's impersonatedOnly
		// filter match everything — the exact bug trpc/audit-actor.ts documents.
		await initiateBackgroundCheck(input);

		const meta = mocks.writeAuditLogTx.mock.calls[0][1].metadata;
		expect(meta).not.toHaveProperty('impersonatedBy');
	});

	it('passes the attesting actor to the repository', async () => {
		// Scoped claim, deliberately. The repository is mocked here, so this
		// proves the SERVICE hands the attestation over — not that it is written.
		// Verified: deleting both columns from `createBackgroundCheckRequestTx`'s
		// `data` block leaves this test green. The persistence is covered by
		// `repositories/backgroundCheckConsent.integration.test.ts` against real
		// Postgres, which goes red on exactly that mutation.
		await initiateBackgroundCheck(input);

		expect(mocks.createBackgroundCheckRequestTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ consentAttestedBy: 'actor-1' }),
		);
	});
});

describe('volunteer initiation notice', () => {
	it('tells the volunteer a check has started', async () => {
		await initiateBackgroundCheck(input);

		await vi.waitFor(() => {
			expect(mocks.sendInitiatedEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					orgName: 'Helping Hands',
					providerName: 'Checkr',
				}),
			);
		});
	});

	it('hands the notice to waitUntil, not a bare floating promise', async () => {
		// On Vercel the function can be frozen as soon as the tRPC response is
		// written, so `void notify()` races the freeze — and the thing dropped is
		// the ONLY disclosure the subject of a background check ever receives.
		// `bulk-import-service.ts:98` established this pattern for the same
		// reason. Without this assertion, "simplifying" it back to `void` is
		// invisible to the whole suite and breaks in production only.
		await initiateBackgroundCheck(input);

		expect(mocks.waitUntil).toHaveBeenCalledTimes(1);
		expect(mocks.waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
	});

	it('SECURITY: notifies the address on the User record, never the typed one', async () => {
		// The PII block is staff-supplied free text. Sending the notice to
		// `pii.email` would deliver the subject's only disclosure straight back to
		// whoever is running the check — same rule as `ctx.session.user.email` not
		// being the effective user's address: resolve it from the id.
		await initiateBackgroundCheck(input);

		await vi.waitFor(() => {
			expect(mocks.sendInitiatedEmail).toHaveBeenCalledWith(
				expect.objectContaining({ to: ACCOUNT_EMAIL }),
			);
		});
		expect(mocks.findEmailByUserId).toHaveBeenCalledWith('user-1');
		expect(mocks.sendInitiatedEmail).not.toHaveBeenCalledWith(
			expect.objectContaining({ to: TYPED_EMAIL }),
		);
	});

	it('names Sterling when Sterling ran the check', async () => {
		await initiateSterlingCheck(input);

		await vi.waitFor(() => {
			expect(mocks.sendInitiatedEmail).toHaveBeenCalledWith(
				expect.objectContaining({ providerName: 'Sterling' }),
			);
		});
	});

	it('logs an error when sendEmail reports failure instead of throwing', async () => {
		// THE REAL FAILURE MODE. `sendEmail` does not throw — it RETURNS false for
		// a Resend error and for a bounce-suppressed address, so the `.catch` at
		// the callsite never fires and a lost disclosure looked exactly like a
		// delivered one. The rejection test below covers a different, rarer path;
		// it passed while this hole was open, which is why both exist.
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mocks.sendInitiatedEmail.mockResolvedValue(false);

		await expect(initiateBackgroundCheck(input)).resolves.toEqual({
			requestId: 'req-1',
		});

		await vi.waitFor(() => {
			expect(consoleError).toHaveBeenCalledWith(
				expect.stringContaining('DISCLOSURE NOT SENT'),
			);
		});
		consoleError.mockRestore();
	});

	it('does not fail the mutation when the notice cannot be sent', async () => {
		// By this point the provider call has happened, the PII has left and the
		// row is committed. Throwing would report a failure for a check that is
		// genuinely underway and invite the coordinator to run a second one.
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mocks.sendInitiatedEmail.mockRejectedValue(new Error('resend down'));

		await expect(initiateBackgroundCheck(input)).resolves.toEqual({
			requestId: 'req-1',
		});

		await vi.waitFor(() => {
			expect(consoleError).toHaveBeenCalled();
		});
		consoleError.mockRestore();
	});

	it('sends nothing when the relationship guard rejects', async () => {
		mocks.requireOrgVolunteerRelationship.mockRejectedValue(
			new Error('not yours'),
		);

		await expect(initiateBackgroundCheck(input)).rejects.toThrow();

		expect(mocks.sendInitiatedEmail).not.toHaveBeenCalled();
	});

	it('sends nothing when the provider call fails', async () => {
		// No request row exists, so there is no check to disclose. A notice here
		// would tell someone a check had started when none had.
		mocks.checkrInitiateCheck.mockRejectedValue(new Error('checkr down'));

		await expect(initiateBackgroundCheck(input)).rejects.toThrow();

		expect(mocks.sendInitiatedEmail).not.toHaveBeenCalled();
	});

	it('skips the notice when the volunteer has no address on file', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mocks.findEmailByUserId.mockResolvedValue(null);

		await expect(initiateBackgroundCheck(input)).resolves.toEqual({
			requestId: 'req-1',
		});

		await vi.waitFor(() => {
			expect(consoleError).toHaveBeenCalledWith(
				expect.stringContaining('DISCLOSURE NOT SENT'),
			);
		});
		expect(mocks.sendInitiatedEmail).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it('skips the notice rather than emailing an unnamed org', async () => {
		// `orgFindUnique` is consulted twice on this path — once for the provider
		// token, once here for the name. The second read can miss (a suspended or
		// concurrently-deleted org), and sending "undefined has started a
		// background check on you" is worse than sending nothing: the recipient
		// cannot act on it and it reads as phishing.
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mocks.orgFindUnique
			.mockResolvedValueOnce({
				checkrAccessToken: 'enc',
				name: 'Helping Hands',
			})
			.mockResolvedValueOnce(null);

		await expect(initiateBackgroundCheck(input)).resolves.toEqual({
			requestId: 'req-1',
		});

		await vi.waitFor(() => {
			expect(consoleError).toHaveBeenCalledWith(
				expect.stringContaining('DISCLOSURE NOT SENT'),
			);
		});
		expect(mocks.sendInitiatedEmail).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});
});
