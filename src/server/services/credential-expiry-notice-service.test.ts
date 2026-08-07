import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/credential-expiry-repo', () => ({
	findOrgsNeedingExpiryNotice: vi.fn(async () => []),
	findExpiryNoticeCredentialsForOrgs: vi.fn(async () => []),
	// Models the real updateMany: it stamps every id it is handed, unless a
	// concurrent run got there first. Tests that care about the short-count
	// case override this per call.
	markCredentialsNotifiedTx: vi.fn(
		async (_tx: unknown, ids: readonly string[]) => ({ count: ids.length }),
	),
}));

vi.mock('../repositories/orgRepo', () => ({
	findOrgStaffRecipients: vi.fn(async () => []),
}));

vi.mock('../repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(async () => ({})),
}));

vi.mock('../repositories/prisma', () => ({
	prisma: {
		// Runs the callback with a stand-in tx, like an interactive transaction.
		$transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
	},
}));

vi.mock('./notificationService', () => ({
	tryNotify: vi.fn(async () => ({ inAppSent: true, emailSent: true })),
}));

import {
	CREDENTIAL_EXPIRY_NOTICE_ORG_CAP,
	NOTICE_SEND_DELAY_MS,
} from '../domain/credential-expiry';
import { writeAuditLogTx } from '../repositories/auditRepo';
import {
	findExpiryNoticeCredentialsForOrgs,
	findOrgsNeedingExpiryNotice,
	markCredentialsNotifiedTx,
} from '../repositories/credential-expiry-repo';
import { findOrgStaffRecipients } from '../repositories/orgRepo';
import { notifyStaffOfExpiringCredentials } from './credential-expiry-notice-service';
import { tryNotify } from './notificationService';

const NOW = new Date('2026-08-07T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function makeDueCredential(overrides: Record<string, unknown> = {}) {
	return {
		id: 'cred-1',
		orgId: 'org-1',
		type: 'BACKGROUND_CHECK',
		expiresAt: new Date(NOW.getTime() + 10 * DAY_MS),
		notifiedAt: null,
		user: { name: 'Jane Doe' },
		organization: { name: 'Helping Hands' },
		...overrides,
	};
}

function makeRecipient(overrides: Record<string, unknown> = {}) {
	return {
		userId: 'user-1',
		user: { email: 'owner@example.com' },
		...overrides,
	};
}

/** Arrange a scan: the org list is derived from the credentials given. */
function mockDue(rows: ReturnType<typeof makeDueCredential>[]) {
	const orgIds = [...new Set(rows.map((r) => r.orgId))];
	vi.mocked(findOrgsNeedingExpiryNotice).mockResolvedValueOnce(orgIds as never);
	vi.mocked(findExpiryNoticeCredentialsForOrgs).mockResolvedValueOnce(
		rows as never,
	);
}

function mockRecipients(rows: unknown[]) {
	vi.mocked(findOrgStaffRecipients).mockResolvedValueOnce(rows as never);
}

function run() {
	return notifyStaffOfExpiringCredentials(NOW);
}

describe('notifyStaffOfExpiringCredentials', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
		process.env.NEXTAUTH_URL = 'http://localhost:3005';
	});

	it('reports an empty scan distinctly from a failed one, and touches nothing', async () => {
		mockDue([]);

		const result = await run();

		expect(result.credentialsScanned).toBe(0);
		expect(result.credentialsNotified).toBe(0);
		expect(result.credentialsUnresolved).toBe(0);
		expect(result.orgCapReached).toBe(false);
		expect(tryNotify).not.toHaveBeenCalled();
		expect(markCredentialsNotifiedTx).not.toHaveBeenCalled();
	});

	it('sends ONE summary per recipient, not one per credential', async () => {
		mockDue([
			makeDueCredential({ id: 'a', user: { name: 'Jane Doe' } }),
			makeDueCredential({ id: 'b', user: { name: 'John Smith' } }),
			makeDueCredential({ id: 'c', user: { name: 'Ada Byron' } }),
		]);
		mockRecipients([makeRecipient()]);

		const result = await run();

		expect(tryNotify).toHaveBeenCalledTimes(1);
		const payload = vi.mocked(tryNotify).mock.calls[0][0];
		expect(payload.type).toBe('CREDENTIAL_EXPIRY');
		expect(payload.emailTo).toBe('owner@example.com');
		expect(payload.emailSubject).toContain('3 volunteer credentials');
		expect(payload.emailHtml).toContain('Jane Doe');
		expect(payload.emailHtml).toContain('John Smith');
		expect(payload.emailHtml).toContain('Ada Byron');
		expect(payload.href).toBe('/app/settings/background-checks');

		expect(markCredentialsNotifiedTx).toHaveBeenCalledWith(
			expect.anything(),
			['a', 'b', 'c'],
			NOW,
		);
		expect(result.credentialsNotified).toBe(3);
		expect(result.noticeEmailsSent).toBe(1);
	});

	it('does NOT stamp when a recipient email failed, even though the in-app landed', async () => {
		// THE regression for this feature. `sendEmail` returns false rather than
		// throwing, and the in-app half always succeeds — so the original
		// `inAppSent || emailSent === true` threshold stamped the batch and lost
		// the email permanently. This is the exact shape a 429 produces.
		mockDue([makeDueCredential()]);
		mockRecipients([makeRecipient()]);
		vi.mocked(tryNotify).mockResolvedValueOnce({
			inAppSent: true,
			emailSent: false,
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await run();

		expect(markCredentialsNotifiedTx).not.toHaveBeenCalled();
		expect(result.credentialsNotified).toBe(0);
		expect(result.credentialsUnresolved).toBe(1);
		expect(result.noticeEmailsFailed).toBe(1);
		errorSpy.mockRestore();
	});

	it('does not stamp when ONE of several recipients failed', async () => {
		mockDue([makeDueCredential({ id: 'a' }), makeDueCredential({ id: 'b' })]);
		mockRecipients([
			makeRecipient({ userId: 'u1' }),
			makeRecipient({ userId: 'u2' }),
			makeRecipient({ userId: 'u3' }),
		]);
		vi.mocked(tryNotify)
			.mockResolvedValueOnce({ inAppSent: true, emailSent: true })
			.mockResolvedValueOnce({ inAppSent: true, emailSent: false })
			.mockResolvedValueOnce({ inAppSent: true, emailSent: true });
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await run();

		expect(markCredentialsNotifiedTx).not.toHaveBeenCalled();
		expect(result.credentialsUnresolved).toBe(2);
		expect(result.noticeEmailsSent).toBe(2);
		expect(result.noticeEmailsFailed).toBe(1);
		errorSpy.mockRestore();
	});

	it('stamps when every recipient opted out of both channels', async () => {
		// Nobody failed — they chose not to be told. Retrying nightly would hold
		// this org's slot under the org cap forever.
		mockDue([makeDueCredential()]);
		mockRecipients([makeRecipient()]);
		vi.mocked(tryNotify).mockResolvedValueOnce({
			inAppSent: false,
			emailSent: null,
		});

		const result = await run();

		expect(markCredentialsNotifiedTx).toHaveBeenCalled();
		expect(result.credentialsNotified).toBe(1);
		expect(result.noticeEmailsSent).toBe(0);
		expect(result.noticeEmailsFailed).toBe(0);
	});

	it('still notifies a recipient with no email address, via the in-app half', async () => {
		mockDue([makeDueCredential()]);
		mockRecipients([makeRecipient({ user: { email: null } })]);
		vi.mocked(tryNotify).mockResolvedValueOnce({
			inAppSent: true,
			emailSent: null,
		});

		await run();

		const payload = vi.mocked(tryNotify).mock.calls[0][0];
		expect(payload.emailTo).toBeUndefined();
		expect(payload.emailHtml).toBeUndefined();
		expect(markCredentialsNotifiedTx).toHaveBeenCalled();
	});

	it('writes an audit row in the same transaction as the stamp', async () => {
		// notifiedAt is otherwise the only record a warning was issued, and it is
		// irreversible — without this a bad run cannot be identified, let alone
		// repaired by `pnpm credentials:reset-notice`.
		mockDue([makeDueCredential({ id: 'a' }), makeDueCredential({ id: 'b' })]);
		mockRecipients([makeRecipient()]);

		await run();

		expect(writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				orgId: 'org-1',
				actorId: null,
				action: 'CREDENTIAL_EXPIRY_NOTICE_SENT',
				metadata: expect.objectContaining({
					credentialIds: ['a', 'b'],
					stamped: 2,
					recipients: 1,
				}),
			}),
		);
	});

	it('does not write an audit row when the batch was not stamped', async () => {
		mockDue([makeDueCredential()]);
		mockRecipients([makeRecipient()]);
		vi.mocked(tryNotify).mockResolvedValueOnce({
			inAppSent: true,
			emailSent: false,
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await run();

		expect(writeAuditLogTx).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('counts what the stamp actually wrote, not what it was handed', async () => {
		// A concurrent run stamped two of the three first, so updateMany's cycle
		// guard matches only one row. Reporting the batch size would claim the job
		// warned about three when a run of it warned about one.
		mockDue([
			makeDueCredential({ id: 'a' }),
			makeDueCredential({ id: 'b' }),
			makeDueCredential({ id: 'c' }),
		]);
		mockRecipients([makeRecipient()]);
		vi.mocked(markCredentialsNotifiedTx).mockResolvedValueOnce({ count: 1 });

		const result = await run();

		expect(result.credentialsNotified).toBe(1);
		expect(result.credentialsUnresolved).toBe(2);
		expect(result.credentialsNotified + result.credentialsUnresolved).toBe(
			result.credentialsScanned,
		);
	});

	it('isolates a failing org so later orgs still get their notice', async () => {
		mockDue([
			makeDueCredential({ id: 'a', orgId: 'org-1' }),
			makeDueCredential({
				id: 'b',
				orgId: 'org-2',
				organization: { name: 'Second Org' },
			}),
		]);
		vi.mocked(findOrgStaffRecipients)
			.mockRejectedValueOnce(new Error('DB blip'))
			.mockResolvedValueOnce([makeRecipient()] as never);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await run();

		expect(result.orgsProcessed).toBe(2);
		expect(result.credentialsUnresolved).toBe(1);
		expect(result.credentialsNotified).toBe(1);
		expect(markCredentialsNotifiedTx).toHaveBeenCalledWith(
			expect.anything(),
			['b'],
			NOW,
		);
		errorSpy.mockRestore();
	});

	it('accounts for every scanned credential as either notified or unresolved', async () => {
		mockDue([
			makeDueCredential({ id: 'a1', orgId: 'ok' }),
			makeDueCredential({ id: 'a2', orgId: 'ok' }),
			makeDueCredential({ id: 'b1', orgId: 'fails' }),
			makeDueCredential({ id: 'b2', orgId: 'fails' }),
			makeDueCredential({ id: 'c1', orgId: 'throws' }),
			makeDueCredential({ id: 'c2', orgId: 'throws' }),
		]);
		vi.mocked(findOrgStaffRecipients)
			.mockResolvedValueOnce([makeRecipient()] as never)
			.mockResolvedValueOnce([makeRecipient()] as never)
			.mockRejectedValueOnce(new Error('DB blip'));
		vi.mocked(tryNotify)
			.mockResolvedValueOnce({ inAppSent: true, emailSent: true })
			.mockResolvedValueOnce({ inAppSent: true, emailSent: false });
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await run();

		expect(result.credentialsScanned).toBe(6);
		expect(result.credentialsNotified).toBe(2);
		expect(result.credentialsUnresolved).toBe(4);
		expect(result.credentialsNotified + result.credentialsUnresolved).toBe(
			result.credentialsScanned,
		);
		expect(result.orgsProcessed).toBe(3);
		errorSpy.mockRestore();
	});

	it('scopes each org summary to its own credentials', async () => {
		mockDue([
			makeDueCredential({
				id: 'a',
				orgId: 'org-1',
				user: { name: 'Jane Doe' },
			}),
			makeDueCredential({
				id: 'b',
				orgId: 'org-2',
				organization: { name: 'Second Org' },
				user: { name: 'John Smith' },
			}),
		]);
		mockRecipients([makeRecipient({ userId: 'u1' })]);
		mockRecipients([makeRecipient({ userId: 'u2' })]);

		await run();

		const [first, second] = vi.mocked(tryNotify).mock.calls.map((c) => c[0]);
		expect(first.orgId).toBe('org-1');
		expect(first.emailHtml).toContain('Jane Doe');
		expect(first.emailHtml).not.toContain('John Smith');
		expect(second.orgId).toBe('org-2');
		expect(second.emailHtml).toContain('John Smith');
		expect(second.emailHtml).not.toContain('Jane Doe');
	});

	it('escapes volunteer and org names in the email body', async () => {
		mockDue([
			makeDueCredential({
				user: { name: '<script>alert(1)</script>' },
				organization: { name: 'Bob & Co "Charity"' },
			}),
		]);
		mockRecipients([makeRecipient()]);

		await run();

		const html = vi.mocked(tryNotify).mock.calls[0][0].emailHtml ?? '';
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('Bob &amp; Co &quot;Charity&quot;');
	});

	it('renders a per-credential day count, singular at exactly one day', async () => {
		mockDue([
			makeDueCredential({
				id: 'a',
				user: { name: 'Soon Leaver' },
				expiresAt: new Date(NOW.getTime() + DAY_MS - 60_000),
			}),
			makeDueCredential({
				id: 'b',
				user: { name: 'Later Leaver' },
				expiresAt: new Date(NOW.getTime() + 12 * DAY_MS),
			}),
		]);
		mockRecipients([makeRecipient()]);

		await run();

		const html = vi.mocked(tryNotify).mock.calls[0][0].emailHtml ?? '';
		expect(html).toContain('expires in 1 day<');
		expect(html).toContain('expires in 12 days<');
	});

	it('never renders a zero or negative day count', async () => {
		// The row is selected with `expiresAt > now`, but the scan and the render
		// are not one atomic read — a credential can expire in between, and
		// `Math.ceil` of a non-positive span gives 0 or a negative. "expires in 0
		// days" reads as a bug to the coordinator; a negative reads as gibberish.
		//
		// The fixture must be genuinely PAST `now`. An earlier version used
		// `now + 1000ms`, which already ceils to 1 on its own — so deleting the
		// clamp left this test green and it proved nothing. Caught by mutation.
		mockDue([
			makeDueCredential({ id: 'x', expiresAt: new Date(NOW.getTime() - 1000) }),
			makeDueCredential({
				id: 'y',
				expiresAt: new Date(NOW.getTime() - 3 * DAY_MS),
			}),
		]);
		mockRecipients([makeRecipient()]);

		await run();

		const html = vi.mocked(tryNotify).mock.calls[0][0].emailHtml ?? '';
		expect(html).not.toMatch(/expires in (0|-\d+) days?/);
		expect(html.match(/expires in 1 day</g)).toHaveLength(2);
	});

	it('falls back to a neutral name for a volunteer with no name on record', async () => {
		mockDue([makeDueCredential({ user: { name: null } })]);
		mockRecipients([makeRecipient()]);

		await run();

		expect(vi.mocked(tryNotify).mock.calls[0][0].emailHtml).toContain(
			'A volunteer',
		);
	});

	it('links to the review page with an absolute origin', async () => {
		mockDue([makeDueCredential()]);
		mockRecipients([makeRecipient()]);

		await run();

		expect(vi.mocked(tryNotify).mock.calls[0][0].emailHtml).toContain(
			'href="http://localhost:3005/app/settings/background-checks"',
		);
	});

	it('falls back to BASE_URL when NEXTAUTH_URL is unset or empty', async () => {
		// A relative href in an email client is a dead link, and this CTA is the
		// notice's only action. `||` not `??` — an empty string is the shape a
		// half-configured deployment produces.
		for (const value of [undefined, '']) {
			vi.clearAllMocks();
			if (value === undefined) {
				process.env.NEXTAUTH_URL = undefined;
				delete process.env.NEXTAUTH_URL;
			} else {
				process.env.NEXTAUTH_URL = value;
			}
			mockDue([makeDueCredential()]);
			mockRecipients([makeRecipient()]);

			await run();

			const html = vi.mocked(tryNotify).mock.calls[0][0].emailHtml ?? '';
			expect(html).toMatch(/href="https?:\/\/[^"]+\/app\/settings/);
		}
	});

	it('names the org so a multi-org coordinator opens the right one', async () => {
		// `/app/settings/background-checks` renders the session's ACTIVE org, not
		// the org this notice is about, so the copy has to say which one.
		mockDue([makeDueCredential()]);
		mockRecipients([makeRecipient()]);

		await run();

		const html = vi.mocked(tryNotify).mock.calls[0][0].emailHtml ?? '';
		expect(html).toContain('is your selected organization');
		expect(html).toContain('Helping Hands');
	});

	it('paces sends so a batch cannot trip Resend rate limiting', async () => {
		vi.useFakeTimers();
		mockDue([makeDueCredential({ orgId: 'org-1' })]);
		mockRecipients([
			makeRecipient({ userId: 'u1' }),
			makeRecipient({ userId: 'u2' }),
		]);

		const pending = run();
		await vi.advanceTimersByTimeAsync(0);
		expect(tryNotify).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(NOTICE_SEND_DELAY_MS);
		await pending;
		expect(tryNotify).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it('does not pace a recipient who gets no email', async () => {
		vi.useFakeTimers();
		mockDue([makeDueCredential()]);
		mockRecipients([
			makeRecipient({ userId: 'u1', user: { email: null } }),
			makeRecipient({ userId: 'u2', user: { email: null } }),
		]);
		vi.mocked(tryNotify).mockResolvedValue({
			inAppSent: true,
			emailSent: null,
		});

		const pending = run();
		await vi.advanceTimersByTimeAsync(0);

		expect(tryNotify).toHaveBeenCalledTimes(2);
		await pending;
		vi.useRealTimers();
	});

	it('flags a run that hit the org cap', async () => {
		const orgIds = Array.from(
			{ length: CREDENTIAL_EXPIRY_NOTICE_ORG_CAP },
			(_, i) => `org-${i}`,
		);
		vi.mocked(findOrgsNeedingExpiryNotice).mockResolvedValueOnce(
			orgIds as never,
		);
		vi.mocked(findExpiryNoticeCredentialsForOrgs).mockResolvedValueOnce(
			orgIds.map((orgId) =>
				makeDueCredential({ id: `c-${orgId}`, orgId }),
			) as never,
		);
		// Email-less recipients: this asserts the cap flag, and paying 50 x
		// NOTICE_SEND_DELAY_MS of real pacing to do it would make the test a
		// 30-second one. Pacing has its own test above.
		vi.mocked(findOrgStaffRecipients).mockResolvedValue([
			makeRecipient({ user: { email: null } }),
		] as never);
		vi.mocked(tryNotify).mockResolvedValue({
			inAppSent: true,
			emailSent: null,
		});

		const result = await run();

		expect(result.orgCapReached).toBe(true);
		expect(result.orgsProcessed).toBe(CREDENTIAL_EXPIRY_NOTICE_ORG_CAP);
	});

	it('does not flag a run that came in under the org cap', async () => {
		mockDue([makeDueCredential()]);
		mockRecipients([makeRecipient()]);

		const result = await run();

		expect(result.orgCapReached).toBe(false);
	});
});
