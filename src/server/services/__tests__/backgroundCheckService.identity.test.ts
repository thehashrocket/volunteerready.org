/**
 * Guard 1.5 — the submitted PII describes the volunteer being checked.
 *
 * `backgroundChecks.initiate` takes a `userId` AND a free-text `pii` block from
 * the same form, and nothing checked that they described the same person. The
 * service authorized the `userId`, shipped the TYPED SSN and date of birth to a
 * consumer reporting agency, and bound the report — plus the FCRA attestation
 * naming a coordinator — to the `userId`. Picking the wrong row therefore sent a
 * STRANGER's SSN to Checkr and filed the result against the intended volunteer,
 * with nothing on either side to notice.
 *
 * The email is the only submitted field the platform can independently verify,
 * so it carries the check: restating the address states the identity twice from
 * the same source, and a row mistake makes the two disagree. SSN and DOB stay
 * unverifiable by construction, which is why the name comparison is recorded on
 * the audit row rather than dropped.
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
	findUserIdentity: vi.fn(),
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
	findUserIdentity: mocks.findUserIdentity,
}));
vi.mock('@/server/services/tenureBadgeService', () => ({
	checkAndIssueTenureBadges: vi.fn(),
}));
vi.mock('@vercel/functions', () => ({
	waitUntil: mocks.waitUntil.mockImplementation((p: Promise<unknown>) => p),
}));

import {
	initiateBackgroundCheck,
	initiateSterlingCheck,
} from '../backgroundCheckService';

const ACCOUNT_EMAIL = 'jane@example.com';
const ACCOUNT_NAME = 'Jane Doe';

const input = {
	orgId: 'org-1',
	userId: 'user-1',
	actorId: 'actor-1',
	pii: {
		firstName: 'Jane',
		lastName: 'Doe',
		email: ACCOUNT_EMAIL,
		dob: '1990-01-01',
		ssn: '123456789',
	},
	consentAttested: true,
};

/** The same submission with a different person's identity typed into it. */
const wrongPerson = {
	...input,
	pii: {
		...input.pii,
		firstName: 'Robert',
		lastName: 'Jones',
		email: 'robert@example.com',
		ssn: '987654321',
	},
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
	mocks.findUserIdentity.mockResolvedValue({
		name: ACCOUNT_NAME,
		email: ACCOUNT_EMAIL,
	});
	mocks.sendInitiatedEmail.mockResolvedValue(true);
});

describe('Guard 1.5 — identity binding', () => {
	it('runs a check whose submitted email is the volunteer’s own', async () => {
		await expect(initiateBackgroundCheck(input)).resolves.toEqual({
			requestId: 'req-1',
		});
	});

	it('refuses a submission naming a different person', async () => {
		await expect(initiateBackgroundCheck(wrongPerson)).rejects.toMatchObject({
			code: 'BAD_REQUEST',
		});
	});

	it('refuses with an allowlisted code so the coordinator can read why', async () => {
		// Asserting the CODE alongside the message: a `throw new Error(...)` maps
		// to INTERNAL_SERVER_ERROR and `errorFormatter` swaps the text for generic
		// copy, silently — and `rejects.toThrow('…')` passes either way. T37 rule.
		await expect(initiateBackgroundCheck(wrongPerson)).rejects.toMatchObject({
			code: 'BAD_REQUEST',
			message: expect.stringContaining('does not match the address'),
		});
	});

	it('SECURITY: refuses before the paid provider call and writes nothing', async () => {
		// The whole point of the guard's POSITION. Placed after the adapter call
		// it would refuse a check whose SSN and date of birth had already reached
		// a consumer reporting agency and been charged for.
		await expect(initiateBackgroundCheck(wrongPerson)).rejects.toThrow();

		expect(mocks.checkrInitiateCheck).not.toHaveBeenCalled();
		expect(mocks.createBackgroundCheckRequestTx).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
		expect(mocks.sendInitiatedEmail).not.toHaveBeenCalled();
	});

	it('SECURITY: runs AFTER the relationship guard, so it is not an existence oracle', async () => {
		// Ordered deliberately. Run first, this answers "does user X have address
		// Y?" for any userId a caller submits — and user ids are not secret
		// (`/v/[userId]` is a public route). Behind Guard 1 the caller has already
		// been proven entitled to this volunteer's record. Moving the identity
		// block above `requireOrgVolunteerRelationship` turns this red.
		mocks.requireOrgVolunteerRelationship.mockRejectedValue(
			new Error('not yours'),
		);

		await expect(initiateBackgroundCheck(wrongPerson)).rejects.toThrow(
			'not yours',
		);

		expect(mocks.findUserIdentity).not.toHaveBeenCalled();
	});

	it('SECURITY: guards the Sterling entry point too, not just Checkr', async () => {
		// The guard lives in the shared `initiateProviderCheck`. Moving it up into
		// `initiateBackgroundCheck` turns this red.
		await expect(initiateSterlingCheck(wrongPerson)).rejects.toMatchObject({
			code: 'BAD_REQUEST',
		});

		expect(mocks.sterlingInitiateCheck).not.toHaveBeenCalled();
	});

	it('accepts the casing and whitespace a human actually types', async () => {
		// A coordinator typing "Jane@Example.com" has named the right person.
		// Refusing that teaches them the guard is noise, which is how a control
		// gets routed around.
		await expect(
			initiateBackgroundCheck({
				...input,
				pii: { ...input.pii, email: '  Jane@Example.com ' },
			}),
		).resolves.toEqual({ requestId: 'req-1' });
	});

	it('accepts an uncanonical address on the User row', async () => {
		// Storage is canonicalized by the T1 trigger, so both sides are normalized
		// only as insurance — but dropping `normalizeEmail` from the STORED side
		// makes this refuse a legitimate check on a legacy row, which is the
		// failure direction that gets a guard deleted rather than fixed.
		mocks.findUserIdentity.mockResolvedValue({
			name: ACCOUNT_NAME,
			email: ' Jane@Example.com',
		});

		await expect(initiateBackgroundCheck(input)).resolves.toEqual({
			requestId: 'req-1',
		});
		// And what leaves is the canonical form, not the padded stored string —
		// whitespace in an address reaches Checkr as an opaque 422 days later.
		expect(mocks.checkrInitiateCheck).toHaveBeenCalledWith(
			expect.objectContaining({ email: ACCOUNT_EMAIL }),
			expect.anything(),
			expect.anything(),
		);
	});

	it('SECURITY: sends the ACCOUNT address to the provider, not the typed one', async () => {
		// Guard 1.5 has just proved they are the same address, so this is about
		// which STRING leaves: the field the coordinator controls confirms the
		// identity and never steers the provider's candidate correspondence.
		await initiateBackgroundCheck({
			...input,
			pii: { ...input.pii, email: '  Jane@Example.com ' },
		});

		expect(mocks.checkrInitiateCheck).toHaveBeenCalledWith(
			expect.objectContaining({ email: ACCOUNT_EMAIL }),
			expect.anything(),
			expect.anything(),
		);
	});

	it('still forwards the unverifiable fields the provider actually needs', async () => {
		// Substituting the email must not disturb the rest of the block: a guard
		// that quietly dropped the SSN would fail as a rejected report days later.
		await initiateBackgroundCheck(input);

		expect(mocks.checkrInitiateCheck).toHaveBeenCalledWith(
			expect.objectContaining({
				firstName: 'Jane',
				lastName: 'Doe',
				dob: '1990-01-01',
				ssn: '123456789',
			}),
			expect.anything(),
			expect.anything(),
		);
	});

	it('refuses when the volunteer has no address on file', async () => {
		// Nothing to verify against, and the disclosure the subject is entitled to
		// has nowhere to go either. Refusing is the only honest answer.
		mocks.findUserIdentity.mockResolvedValue({
			name: ACCOUNT_NAME,
			email: null,
		});

		await expect(initiateBackgroundCheck(input)).rejects.toMatchObject({
			code: 'BAD_REQUEST',
			message: expect.stringContaining('no email address on file'),
		});
		expect(mocks.checkrInitiateCheck).not.toHaveBeenCalled();
	});

	it('refuses when the user row has vanished entirely', async () => {
		mocks.findUserIdentity.mockResolvedValue(null);

		await expect(initiateBackgroundCheck(input)).rejects.toMatchObject({
			code: 'BAD_REQUEST',
		});
		expect(mocks.checkrInitiateCheck).not.toHaveBeenCalled();
	});
});

describe('name mismatch is recorded, not refused', () => {
	const differentName = {
		...input,
		pii: { ...input.pii, firstName: 'Robert', lastName: 'Jones' },
	};

	it('passes identityNameMismatch to the audit writer', async () => {
		// The only signal left for the case the email cannot catch: the right
		// volunteer named, another row's name and SSN typed underneath.
		//
		// Scoped claim, deliberately named as one. `writeAuditLogTx` is mocked
		// here, so this proves the SERVICE hands the flag over, not that a row
		// carries it — the same correction the attestation test took during the
		// v0.40.0.0 ship. `metadata` is a long-established column exercised by the
		// audit repository's own tests, which is why this does not get an
		// integration counterpart the way a NEW column would.
		await initiateBackgroundCheck(differentName);

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: 'BACKGROUND_CHECK_INITIATED',
				metadata: expect.objectContaining({ identityNameMismatch: true }),
			}),
		);
	});

	it('does NOT refuse the check', async () => {
		// Legal names and account names legitimately differ — preferred names,
		// marriage, a roster imported from a spreadsheet holding "Bob". Refusing
		// would block real checks on real people.
		await expect(initiateBackgroundCheck(differentName)).resolves.toEqual({
			requestId: 'req-1',
		});
		expect(mocks.checkrInitiateCheck).toHaveBeenCalledOnce();
	});

	it('warns in the logs as well as the audit row', async () => {
		// The audit row is the durable record; the log line is what an operator
		// sees while it is happening. Cheap to keep, and without this assertion a
		// refactor can drop the warn with nothing going red.
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await initiateBackgroundCheck(differentName);

		expect(consoleWarn).toHaveBeenCalledWith(
			expect.stringContaining('does not match the account name'),
		);
		// No names in the line — the identity detail belongs on the
		// access-controlled audit row, not in application logs.
		expect(consoleWarn.mock.calls[0][0]).not.toContain('Robert');
		consoleWarn.mockRestore();
	});

	it('writes no key when the names agree', async () => {
		// Stamped unconditionally the key cannot be filtered on — the same reason
		// `impersonatedBy` is spread rather than defaulted to null.
		await initiateBackgroundCheck(input);

		const meta = mocks.writeAuditLogTx.mock.calls[0][1].metadata;
		expect(meta).not.toHaveProperty('identityNameMismatch');
	});

	it('writes no key when the account has no name to compare', async () => {
		// Shadow users created from an email address alone have none. Flagging
		// them would mark every concierge-imported volunteer as suspect.
		mocks.findUserIdentity.mockResolvedValue({
			name: null,
			email: ACCOUNT_EMAIL,
		});

		await initiateBackgroundCheck(input);

		const meta = mocks.writeAuditLogTx.mock.calls[0][1].metadata;
		expect(meta).not.toHaveProperty('identityNameMismatch');
	});
});
