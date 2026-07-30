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
}));

vi.mock('@/server/services/staffVolunteerService', () => ({
	addVolunteer: mocks.addVolunteer,
	resolveRosterNotificationContext: mocks.resolveRosterNotificationContext,
	sendRosterAddedNotice: mocks.sendRosterAddedNotice,
}));

vi.mock('@/server/repositories/orgVolunteerRepo', () => ({
	findLiveOrgVolunteer: mocks.findLiveOrgVolunteer,
	findOrgVolunteerBlock: mocks.findOrgVolunteerBlock,
}));

vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	findUserIdByEmail: mocks.findUserIdByEmail,
}));

const {
	DEFAULT_NOTIFY_DELAY_MS,
	importRoster,
	previewRosterImport,
	sendImportNotifications,
} = await import('../rosterImportService');

const ORG = 'org_1';

function row(n: number, email = `v${n}@example.org`): RosterImportRow {
	return { line: n + 1, displayName: `V ${n}`, email, phone: null };
}

const CONTEXT = { orgName: 'Riverside', addedByName: null };

beforeEach(() => {
	vi.clearAllMocks();
	mocks.resolveRosterNotificationContext.mockResolvedValue(CONTEXT);
	mocks.sendRosterAddedNotice.mockResolvedValue(undefined);
	mocks.addVolunteer.mockResolvedValue({
		outcome: 'CREATED_SHADOW',
		volunteerId: 'ov_1',
		userId: 'u_1',
		displayName: 'V',
		notify: false,
	});
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
			.mockResolvedValueOnce(undefined)
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

	it('sends sequentially, not all at once', async () => {
		// The whole reason this exists rather than letting addVolunteer fire them.
		let inFlight = 0;
		let maxInFlight = 0;
		mocks.sendRosterAddedNotice.mockImplementation(async () => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((r) => setTimeout(r, 1));
			inFlight--;
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
