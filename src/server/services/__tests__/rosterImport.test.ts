/**
 * The concierge import's write loop and its dry-run rehearsal (T17).
 *
 * The parsing half is covered by `scripts/import-roster.test.ts` and
 * `domain/__tests__/csv.test.ts`. What is pinned here is the behaviour a bulk
 * loader lives or dies on: that one bad row does not cost the operator the rest
 * of the file, that re-running is a no-op rather than a duplicate, and that the
 * roster-added notices are not fired sixty-at-once into a rate limiter.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RosterImportRow } from '@/server/domain/roster-import';

const mocks = vi.hoisted(() => ({
	addVolunteer: vi.fn(),
	resolveRosterNotificationContext: vi.fn(),
	sendRosterAddedNotice: vi.fn(),
	findUserIdByEmail: vi.fn(),
	findLiveOrgVolunteer: vi.fn(),
	findOrgVolunteerBlock: vi.fn(),
	findConciergeImportAuditRows: vi.fn(),
	findSentAddresses: vi.fn(),
	findBlockedEmailsForOrg: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	findConciergeImportAuditRows: mocks.findConciergeImportAuditRows,
}));

vi.mock('@/server/repositories/emailEventRepo', () => ({
	findSentAddresses: mocks.findSentAddresses,
}));

vi.mock('@/server/services/staffVolunteerService', () => ({
	addVolunteer: mocks.addVolunteer,
	resolveRosterNotificationContext: mocks.resolveRosterNotificationContext,
	sendRosterAddedNotice: mocks.sendRosterAddedNotice,
}));

vi.mock('@/server/repositories/orgVolunteerRepo', () => ({
	findLiveOrgVolunteer: mocks.findLiveOrgVolunteer,
	findOrgVolunteerBlock: mocks.findOrgVolunteerBlock,
	findBlockedEmailsForOrg: mocks.findBlockedEmailsForOrg,
}));

vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	findUserIdByEmail: mocks.findUserIdByEmail,
}));

const {
	classifyOwedNotices,
	DEFAULT_NOTIFY_DELAY_MS,
	importRoster,
	previewRosterImport,
	sendImportNotifications,
	sendOwedNotices,
} = await import('../rosterImportService');

const ORG = 'org_1';

function row(n: number, email = `v${n}@example.org`): RosterImportRow {
	return { line: n + 1, displayName: `V ${n}`, email, phone: null };
}

const CONTEXT = { orgName: 'Riverside', addedByName: null };

beforeEach(() => {
	vi.clearAllMocks();
	mocks.resolveRosterNotificationContext.mockResolvedValue(CONTEXT);
	// `true`, not `undefined`. `sendRosterAddedNotice` returns whether the send
	// happened, and the sender treats a falsy resolution as a FAILURE — a mock
	// resolving `undefined` would fail every notice in every test for a reason
	// that has nothing to do with what the test is asserting.
	mocks.sendRosterAddedNotice.mockResolvedValue(true);
	mocks.addVolunteer.mockResolvedValue({
		outcome: 'CREATED_SHADOW',
		volunteerId: 'ov_1',
		userId: 'u_1',
		displayName: 'V',
		notify: false,
	});
	mocks.findConciergeImportAuditRows.mockResolvedValue([]);
	mocks.findSentAddresses.mockResolvedValue(new Set());
	mocks.findBlockedEmailsForOrg.mockResolvedValue(new Set());
});

// ---------------------------------------------------------------------------
// importRoster
// ---------------------------------------------------------------------------

describe('importRoster', () => {
	it('adds every row and reports one result per row', async () => {
		const results = await importRoster({
			orgId: ORG,
			rows: [row(1), row(2), row(3)],
			actorId: 'admin_1',
		});

		expect(mocks.addVolunteer).toHaveBeenCalledTimes(3);
		expect(results.map((r) => r.outcome)).toEqual(['ADDED', 'ADDED', 'ADDED']);
		expect(results.map((r) => r.line)).toEqual([2, 3, 4]);
	});

	it('stamps the import provenance on the audit row', async () => {
		await importRoster({ orgId: ORG, rows: [row(1)], actorId: 'admin_1' });
		expect(mocks.addVolunteer).toHaveBeenCalledWith(
			expect.objectContaining({ via: 'CONCIERGE_IMPORT', actorId: 'admin_1' }),
		);
	});

	it('opts out of the per-add email so the importer can pace them', async () => {
		// Load-bearing. `addVolunteer`'s own send is fire-and-forget with a
		// `.catch(console.error)`; sixty of those at once get rate limited and the
		// rejections land on promises nobody holds. The people owed this email are
		// exactly those added from a spreadsheet they never saw, and it carries
		// the only link to the surface where they can revoke the access.
		await importRoster({ orgId: ORG, rows: [row(1)], actorId: null });
		expect(mocks.addVolunteer).toHaveBeenCalledWith(
			expect.objectContaining({ sendNotification: false }),
		);
	});

	it('keeps going after a row throws, and records what failed', async () => {
		// Row 31 of 60 failing must not cost the operator rows 32-60, nor leave
		// them unable to answer "what actually got in?" — the failure this task
		// was raised to prevent.
		mocks.addVolunteer
			.mockResolvedValueOnce({ notify: false })
			.mockRejectedValueOnce(new Error('connection reset'))
			.mockResolvedValueOnce({ notify: false });

		const results = await importRoster({
			orgId: ORG,
			rows: [row(1), row(2), row(3)],
			actorId: null,
		});

		expect(results.map((r) => r.outcome)).toEqual(['ADDED', 'FAILED', 'ADDED']);
		expect(results[1]?.message).toBe('connection reset');
	});

	it('IDEMPOTENT: an existing roster member is a skip, not an error', async () => {
		// A second run of the same file is a supported workflow. If CONFLICT read
		// as a failure, "fix three rows and re-run" would report 57 errors.
		mocks.addVolunteer.mockRejectedValue(
			new TRPCError({ code: 'CONFLICT', message: 'Already on your roster' }),
		);

		const results = await importRoster({
			orgId: ORG,
			rows: [row(1), row(2)],
			actorId: null,
		});

		expect(results.map((r) => r.outcome)).toEqual([
			'SKIPPED_ALREADY_ON_ROSTER',
			'SKIPPED_ALREADY_ON_ROSTER',
		]);
	});

	it('reports a volunteer who revoked the org’s access, and does not retry', async () => {
		mocks.addVolunteer.mockRejectedValue(
			new TRPCError({ code: 'FORBIDDEN', message: 'They left your roster.' }),
		);

		const results = await importRoster({
			orgId: ORG,
			rows: [row(1)],
			actorId: null,
		});

		expect(results[0]?.outcome).toBe('REFUSED_BY_VOLUNTEER');
		expect(results[0]?.message).toBe('They left your roster.');
		expect(mocks.addVolunteer).toHaveBeenCalledTimes(1);
	});

	it('classifies by TRPC code, not by message text', async () => {
		// Re-wording the coordinator-facing copy must not silently reclassify half
		// an import as errors.
		mocks.addVolunteer.mockRejectedValue(
			new TRPCError({ code: 'CONFLICT', message: 'totally different words' }),
		);
		const results = await importRoster({
			orgId: ORG,
			rows: [row(1)],
			actorId: null,
		});
		expect(results[0]?.outcome).toBe('SKIPPED_ALREADY_ON_ROSTER');
	});

	it('streams progress through onRow as each row lands', async () => {
		const seen: number[] = [];
		await importRoster({
			orgId: ORG,
			rows: [row(1), row(2)],
			actorId: null,
			onRow: (r) => seen.push(r.line),
		});
		expect(seen).toEqual([2, 3]);
	});
});

// ---------------------------------------------------------------------------
// previewRosterImport
// ---------------------------------------------------------------------------

describe('previewRosterImport', () => {
	it('writes nothing', async () => {
		mocks.findUserIdByEmail.mockResolvedValue(null);
		await previewRosterImport({ orgId: ORG, rows: [row(1), row(2)] });
		expect(mocks.addVolunteer).not.toHaveBeenCalled();
	});

	it('reports an unknown address as one that would be added', async () => {
		mocks.findUserIdByEmail.mockResolvedValue(null);
		const results = await previewRosterImport({ orgId: ORG, rows: [row(1)] });
		expect(results[0]?.outcome).toBe('ADDED');
		// No user means no roster row and no block can exist, so neither is read.
		expect(mocks.findLiveOrgVolunteer).not.toHaveBeenCalled();
		expect(mocks.findOrgVolunteerBlock).not.toHaveBeenCalled();
	});

	it('reports an existing roster member as a skip', async () => {
		mocks.findUserIdByEmail.mockResolvedValue('u_1');
		mocks.findLiveOrgVolunteer.mockResolvedValue({ id: 'ov_1' });
		const results = await previewRosterImport({ orgId: ORG, rows: [row(1)] });
		expect(results[0]?.outcome).toBe('SKIPPED_ALREADY_ON_ROSTER');
	});

	it('reports a blocked volunteer as refused', async () => {
		mocks.findUserIdByEmail.mockResolvedValue('u_1');
		mocks.findLiveOrgVolunteer.mockResolvedValue(null);
		mocks.findOrgVolunteerBlock.mockResolvedValue({ id: 'b_1' });
		const results = await previewRosterImport({ orgId: ORG, rows: [row(1)] });
		expect(results[0]?.outcome).toBe('REFUSED_BY_VOLUNTEER');
	});

	it('checks the roster before the block, matching addVolunteer', async () => {
		// Someone who is on the roster AND blocked is a real state (the accepted
		// TOCTOU window on the block insert). The preview must say what the run
		// will say, which is "already on your roster".
		mocks.findUserIdByEmail.mockResolvedValue('u_1');
		mocks.findLiveOrgVolunteer.mockResolvedValue({ id: 'ov_1' });
		mocks.findOrgVolunteerBlock.mockResolvedValue({ id: 'b_1' });
		const results = await previewRosterImport({ orgId: ORG, rows: [row(1)] });
		expect(results[0]?.outcome).toBe('SKIPPED_ALREADY_ON_ROSTER');
	});
});

// ---------------------------------------------------------------------------
// sendImportNotifications
// ---------------------------------------------------------------------------

describe('sendImportNotifications', () => {
	const added = (email: string, notify: boolean) =>
		({ line: 1, email, outcome: 'ADDED', notify }) as const;

	it('emails only the rows that are owed one', async () => {
		const { sent } = await sendImportNotifications({
			orgId: ORG,
			actorId: null,
			delayMs: 0,
			results: [
				added('active@example.org', true),
				added('shadow@example.org', false),
				{
					line: 3,
					email: 'dup@example.org',
					outcome: 'SKIPPED_ALREADY_ON_ROSTER',
				},
			],
		});

		expect(sent).toBe(1);
		expect(mocks.sendRosterAddedNotice).toHaveBeenCalledTimes(1);
		expect(mocks.sendRosterAddedNotice).toHaveBeenCalledWith(
			CONTEXT,
			'active@example.org',
		);
		// The invariant org/actor context is resolved ONCE for the whole run.
		expect(mocks.resolveRosterNotificationContext).toHaveBeenCalledTimes(1);
	});

	it('returns failures rather than throwing — the rows are already committed', async () => {
		mocks.sendRosterAddedNotice
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error('rate limited'));

		const { sent, failed } = await sendImportNotifications({
			orgId: ORG,
			actorId: null,
			delayMs: 0,
			results: [added('a@example.org', true), added('b@example.org', true)],
		});

		expect(sent).toBe(1);
		expect(failed).toEqual([{ email: 'b@example.org', error: 'rate limited' }]);
	});

	it('SECURITY: counts a send that RESOLVES FALSE as a failure, not as sent', async () => {
		// The failure this whole file exists to prevent. `sendEmail` does NOT
		// throw for a Resend error or a bounce-suppressed address — it returns
		// `false` — so a sender that only catches rejections reported
		// "notifications sent: 60" with nothing delivered. The rejection test
		// above passed the entire time this hole stood, which is why BOTH are
		// needed: returns-false and rejects are different failures.
		mocks.sendRosterAddedNotice
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);

		const { sent, failed } = await sendImportNotifications({
			orgId: ORG,
			actorId: null,
			delayMs: 0,
			results: [added('a@example.org', true), added('b@example.org', true)],
		});

		expect(sent).toBe(1);
		expect(failed).toHaveLength(1);
		expect(failed[0]?.email).toBe('a@example.org');
		expect(failed[0]?.error).toMatch(/returned false/);
	});

	it('streams each attempt through onSend as it lands', async () => {
		// A 60-row batch paces at 600ms, so without this the operator watches 36
		// seconds of silence — which is what invites the Ctrl-C that leaves rows
		// committed and notices unsent.
		mocks.sendRosterAddedNotice
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce(false)
			.mockRejectedValueOnce(new Error('rate limited'));

		const seen: Array<{ email: string; status: string }> = [];

		await sendImportNotifications({
			orgId: ORG,
			actorId: null,
			delayMs: 0,
			results: [
				added('a@example.org', true),
				added('b@example.org', true),
				added('c@example.org', true),
			],
			onSend: (r) => seen.push({ email: r.email, status: r.status }),
		});

		expect(seen).toEqual([
			{ email: 'a@example.org', status: 'SENT' },
			{ email: 'b@example.org', status: 'FAILED' },
			{ email: 'c@example.org', status: 'FAILED' },
		]);
	});

	it('reports every owed row through onSend when the org cannot be resolved', async () => {
		// The early-return branch sends nothing, so without this the operator
		// sees no per-row output at all and only the final tally.
		mocks.resolveRosterNotificationContext.mockResolvedValue(null);
		const seen: string[] = [];

		const { sent, failed } = await sendImportNotifications({
			orgId: ORG,
			actorId: null,
			delayMs: 0,
			results: [added('a@example.org', true), added('b@example.org', true)],
			onSend: (r) => seen.push(r.email),
		});

		expect(sent).toBe(0);
		expect(failed).toHaveLength(2);
		expect(seen).toEqual(['a@example.org', 'b@example.org']);
	});

	it('sends sequentially, not all at once', async () => {
		// The whole reason this exists rather than letting addVolunteer fire them.
		let inFlight = 0;
		let maxInFlight = 0;
		mocks.sendRosterAddedNotice.mockImplementation(async () => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((r) => setTimeout(r, 1));
			inFlight--;
			return true;
		});

		await sendImportNotifications({
			orgId: ORG,
			actorId: null,
			delayMs: 0,
			results: [
				added('a@example.org', true),
				added('b@example.org', true),
				added('c@example.org', true),
			],
		});

		expect(maxInFlight).toBe(1);
	});

	it('paces sends at the DEFAULT interval when none is given', async () => {
		// The value production actually uses. Every other test passes `delayMs: 0`
		// and the script passes nothing, so before this the `?? 600` default was
		// the one line nothing pinned — deleting the sleep left the suite green
		// while a 60-row import hammered Resend's 2 req/s allowance.
		vi.useFakeTimers();
		try {
			const sentAt: number[] = [];
			mocks.sendRosterAddedNotice.mockImplementation(async () => {
				sentAt.push(Date.now());
				return true;
			});

			const pending = sendImportNotifications({
				orgId: ORG,
				actorId: null,
				results: [added('a@example.org', true), added('b@example.org', true)],
			});

			// The first send is not delayed; the second is still waiting on the pacer.
			await vi.advanceTimersByTimeAsync(0);
			expect(sentAt).toHaveLength(1);

			// One tick short of the interval is still not enough.
			await vi.advanceTimersByTimeAsync(DEFAULT_NOTIFY_DELAY_MS - 1);
			expect(sentAt).toHaveLength(1);

			await vi.advanceTimersByTimeAsync(1);
			await pending;
			expect(sentAt).toHaveLength(2);
		} finally {
			vi.useRealTimers();
		}
	});
});

// ---------------------------------------------------------------------------
// --notify-only recovery
// ---------------------------------------------------------------------------

const auditRow = (
	email: string,
	outcome: string,
	actorId: string | null = 'u_actor',
) => ({
	email,
	outcome,
	actorId,
	createdAt: new Date('2026-01-01T00:00:00Z'),
});

describe('classifyOwedNotices', () => {
	it('queries EmailEvent only for the addresses that are ELIGIBLE', async () => {
		// Most of a re-fed CSV is rows that were never owed mail. Passing the whole
		// file to `findSentAddresses` would widen an `IN (…)` over an unindexed
		// subject match for no benefit, so eligibility is decided first.
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('active@example.org', 'LINKED_ACTIVE'),
			auditRow('shadow@example.org', 'CREATED_SHADOW'),
		]);

		await classifyOwedNotices({
			orgId: ORG,
			rows: [row(1, 'active@example.org'), row(2, 'shadow@example.org')],
		});

		expect(mocks.findSentAddresses).toHaveBeenCalledWith(
			['active@example.org'],
			// Derived from the sender, never a second hand-typed copy of the string.
			'Riverside added you to their volunteer roster',
		);
	});

	it('reports the org as unresolvable rather than classifying against nothing', async () => {
		mocks.resolveRosterNotificationContext.mockResolvedValue(null);

		const { orgName, rows } = await classifyOwedNotices({
			orgId: ORG,
			rows: [row(1, 'active@example.org')],
		});

		expect(orgName).toBeNull();
		expect(rows).toEqual([]);
		// No point reading the audit log for an org whose name we cannot render.
		expect(mocks.findConciergeImportAuditRows).not.toHaveBeenCalled();
	});

	it('sends nothing — it is the dry-run half', async () => {
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('active@example.org', 'LINKED_ACTIVE'),
		]);

		await classifyOwedNotices({
			orgId: ORG,
			rows: [row(1, 'active@example.org')],
		});

		expect(mocks.sendRosterAddedNotice).not.toHaveBeenCalled();
	});
});

describe('sendOwedNotices', () => {
	it('mails only the rows an earlier import actually committed', async () => {
		// The whole point of going through the audit log: a row on the roster for
		// some other reason (they applied last year) must NOT be told an import
		// just added them.
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('active@example.org', 'LINKED_ACTIVE'),
		]);

		const { rows } = await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [row(1, 'active@example.org'), row(2, 'stranger@example.org')],
		});

		expect(mocks.sendRosterAddedNotice).toHaveBeenCalledTimes(1);
		expect(rows.map((r) => r.status)).toEqual(['SENT', 'NOT_COMMITTED']);
	});

	it('skips an address that already has a SENT event', async () => {
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('active@example.org', 'LINKED_ACTIVE'),
		]);
		mocks.findSentAddresses.mockResolvedValue(new Set(['active@example.org']));

		const { rows } = await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [row(1, 'active@example.org')],
		});

		expect(mocks.sendRosterAddedNotice).not.toHaveBeenCalled();
		expect(rows.map((r) => r.status)).toEqual(['ALREADY_SENT']);
	});

	it('attributes each notice to the ORIGINAL run’s actor', async () => {
		// A recovery says what the killed run would have said. Resolving one
		// context for the batch would tell half these volunteers they were added
		// by a coordinator who never added them.
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('a@example.org', 'LINKED_ACTIVE', 'u_alice'),
			auditRow('b@example.org', 'LINKED_ACTIVE', 'u_bob'),
		]);

		await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [row(1, 'a@example.org'), row(2, 'b@example.org')],
		});

		expect(mocks.resolveRosterNotificationContext).toHaveBeenCalledWith(
			ORG,
			'u_alice',
		);
		expect(mocks.resolveRosterNotificationContext).toHaveBeenCalledWith(
			ORG,
			'u_bob',
		);
	});

	it('resolves the context once per DISTINCT actor, not once per recipient', async () => {
		// An interrupted batch normally has exactly one actor, so this is the
		// common case: three recipients must not cost three lookups of a name that
		// cannot change mid-run.
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('a@example.org', 'LINKED_ACTIVE', 'u_alice'),
			auditRow('b@example.org', 'LINKED_ACTIVE', 'u_alice'),
			auditRow('c@example.org', 'LINKED_ACTIVE', 'u_alice'),
		]);

		await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [
				row(1, 'a@example.org'),
				row(2, 'b@example.org'),
				row(3, 'c@example.org'),
			],
		});

		expect(mocks.sendRosterAddedNotice).toHaveBeenCalledTimes(3);
		// One for the org name in classifyOwedNotices, one for the shared actor.
		expect(mocks.resolveRosterNotificationContext).toHaveBeenCalledTimes(2);
	});

	it('SECURITY: records a send that RESOLVES FALSE as FAILED, not SENT', async () => {
		// Same hole as the live path. A recovery mode that reports a silent
		// failure as delivered is worse than none, because it retires a problem it
		// did not fix — and this notice carries the only revoke link the volunteer
		// ever gets.
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('a@example.org', 'LINKED_ACTIVE'),
		]);
		mocks.sendRosterAddedNotice.mockResolvedValue(false);

		const { rows } = await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [row(1, 'a@example.org')],
		});

		expect(rows[0]?.status).toBe('FAILED');
		expect(rows[0]?.error).toMatch(/returned false/);
	});

	it('keeps going after one send throws', async () => {
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('a@example.org', 'LINKED_ACTIVE'),
			auditRow('b@example.org', 'LINKED_ACTIVE'),
		]);
		mocks.sendRosterAddedNotice
			.mockRejectedValueOnce(new Error('rate limited'))
			.mockResolvedValueOnce(true);

		const { rows } = await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [row(1, 'a@example.org'), row(2, 'b@example.org')],
		});

		expect(rows.map((r) => r.status)).toEqual(['FAILED', 'SENT']);
		expect(rows[0]?.error).toBe('rate limited');
	});

	it('streams each attempt through onSend as it lands', async () => {
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('a@example.org', 'LINKED_ACTIVE'),
			auditRow('b@example.org', 'LINKED_ACTIVE'),
		]);

		const seen: string[] = [];
		await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [row(1, 'a@example.org'), row(2, 'b@example.org')],
			onSend: (r) => seen.push(`${r.email}:${r.status}`),
		});

		expect(seen).toEqual(['a@example.org:SENT', 'b@example.org:SENT']);
	});

	it('sends sequentially, not all at once', async () => {
		// Same rate limiter as the live path, so the same guarantee is needed.
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('a@example.org', 'LINKED_ACTIVE'),
			auditRow('b@example.org', 'LINKED_ACTIVE'),
			auditRow('c@example.org', 'LINKED_ACTIVE'),
		]);

		let inFlight = 0;
		let maxInFlight = 0;
		mocks.sendRosterAddedNotice.mockImplementation(async () => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((r) => setTimeout(r, 1));
			inFlight--;
			return true;
		});

		await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [
				row(1, 'a@example.org'),
				row(2, 'b@example.org'),
				row(3, 'c@example.org'),
			],
		});

		expect(maxInFlight).toBe(1);
	});

	it('paces at the DEFAULT interval when none is given', async () => {
		// The value production uses. Every other test here passes `delayMs: 0` and
		// the script passes nothing, so without this the default is unpinned on
		// this path exactly as it once was on the live one.
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('a@example.org', 'LINKED_ACTIVE'),
			auditRow('b@example.org', 'LINKED_ACTIVE'),
		]);

		vi.useFakeTimers();
		try {
			const sentAt: number[] = [];
			mocks.sendRosterAddedNotice.mockImplementation(async () => {
				sentAt.push(Date.now());
				return true;
			});

			const pending = sendOwedNotices({
				orgId: ORG,
				rows: [row(1, 'a@example.org'), row(2, 'b@example.org')],
			});

			await vi.advanceTimersByTimeAsync(0);
			expect(sentAt).toHaveLength(1);

			await vi.advanceTimersByTimeAsync(DEFAULT_NOTIFY_DELAY_MS - 1);
			expect(sentAt).toHaveLength(1);

			await vi.advanceTimersByTimeAsync(1);
			await pending;
			expect(sentAt).toHaveLength(2);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('sendOwedNotices — revoked access', () => {
	it('SECURITY: does not mail someone who has since revoked the org', async () => {
		// The audit row still says this import added them, but they have since left
		// and blocked the org. Mailing "X added you to their roster" would be both
		// unwanted and false — and it would go to the one person who explicitly
		// said no.
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('gone@example.org', 'LINKED_ACTIVE'),
			auditRow('here@example.org', 'LINKED_ACTIVE'),
		]);
		mocks.findBlockedEmailsForOrg.mockResolvedValue(
			new Set(['gone@example.org']),
		);

		const { rows } = await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [row(1, 'gone@example.org'), row(2, 'here@example.org')],
		});

		expect(rows.map((r) => r.status)).toEqual(['REFUSED_BY_VOLUNTEER', 'SENT']);
		expect(mocks.sendRosterAddedNotice).toHaveBeenCalledTimes(1);
		expect(mocks.sendRosterAddedNotice).toHaveBeenCalledWith(
			CONTEXT,
			'here@example.org',
		);
	});

	it('asks for blocks only on the addresses that are otherwise eligible', async () => {
		// Same narrowing as the EmailEvent query — most of a re-fed CSV was never
		// owed mail, so there is nothing to refuse for those rows.
		mocks.findConciergeImportAuditRows.mockResolvedValue([
			auditRow('active@example.org', 'LINKED_ACTIVE'),
			auditRow('shadow@example.org', 'CREATED_SHADOW'),
		]);

		await sendOwedNotices({
			orgId: ORG,
			delayMs: 0,
			rows: [row(1, 'active@example.org'), row(2, 'shadow@example.org')],
		});

		expect(mocks.findBlockedEmailsForOrg).toHaveBeenCalledWith(ORG, [
			'active@example.org',
		]);
	});
});
