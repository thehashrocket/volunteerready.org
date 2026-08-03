/**
 * Concierge roster import (T17) — the write loop and its read-only rehearsal.
 *
 * The concierge motion is "send us your spreadsheet, we'll load it for you", and
 * until this existed the only way in was the one-at-a-time add form. A shelter
 * with eighty volunteers has no path onto the platform through that.
 *
 * Two invariants this file exists to hold:
 *
 *  1. **Per-row transactions.** `addVolunteer` opens its own transaction, and
 *     this loop deliberately does NOT wrap it in an outer one. Row 31 of 60
 *     failing must leave rows 1-30 committed and rows 32-60 still attempted —
 *     the design doc raised this task because the alternative leaves the
 *     operator unable to answer "what actually got in?" without reading the
 *     database by hand. A single enclosing transaction would also hold locks on
 *     `User` for the length of the whole run.
 *
 *  2. **Idempotent.** Re-running the same file is a supported operation, not a
 *     mistake to be guarded against. `addVolunteer` throws CONFLICT for someone
 *     already on the live roster; that is recorded as a skip, not an error, so a
 *     second run exits 0 with every row skipped and nothing duplicated.
 */

import { TRPCError } from '@trpc/server';
import { rosterAddedEmailSubject } from '@/server/domain/org-volunteer';
import type {
	OwedNoticeResult,
	RosterImportResult,
	RosterImportRow,
} from '@/server/domain/roster-import';
import { computeOwedNotices } from '@/server/domain/roster-import';
import { findConciergeImportAuditRows } from '@/server/repositories/auditRepo';
import { findSentAddresses } from '@/server/repositories/emailEventRepo';
import {
	findBlockedEmailsForOrg,
	findLiveOrgVolunteer,
	findOrgVolunteerBlock,
} from '@/server/repositories/orgVolunteerRepo';
import { findUserIdByEmail } from '@/server/repositories/userAccountStateRepo';
import {
	addVolunteer,
	resolveRosterNotificationContext,
	sendRosterAddedNotice,
} from './staffVolunteerService';

/**
 * Milliseconds between roster-added notices.
 *
 * Resend's default allowance is 2 requests/second, so this paces under it with
 * room to spare. Named rather than inlined as `?? 600` so a test can assert the
 * value production actually uses — every test passing `delayMs: 0` left the real
 * default unpinned.
 */
export const DEFAULT_NOTIFY_DELAY_MS = 600;

/**
 * Classify each row against the current database WITHOUT writing.
 *
 * A rehearsal, not a simulation. It reports what the real run would attempt
 * given the data as it stands right now; anything that changes in between —
 * someone applying, someone leaving — changes the answer. That is inherent to a
 * dry run and is stated in the script's output rather than papered over.
 *
 * Per-row queries rather than one batched read, on purpose: this mirrors the
 * shape of the real loop, and a dry run is not on a latency budget. Batching
 * here would be a second implementation of the same classification, which is
 * how a preview starts disagreeing with the run it previews.
 *
 * `ADDED` in a preview means "would be added", so the dry-run summary lines up
 * column-for-column with the real one.
 */
export async function previewRosterImport(input: {
	orgId: string;
	rows: readonly RosterImportRow[];
}): Promise<RosterImportResult[]> {
	const results: RosterImportResult[] = [];

	for (const row of input.rows) {
		const userId = await findUserIdByEmail(row.email);

		if (!userId) {
			// Nobody holds this address, so there can be neither a roster row nor a
			// block. A shadow user would be minted.
			results.push({ line: row.line, email: row.email, outcome: 'ADDED' });
			continue;
		}

		// Same order as `addVolunteer`: roster first, then block. Reporting
		// "already on your roster" for someone who is on it matters more than
		// reporting a block that cannot apply to them.
		const live = await findLiveOrgVolunteer(input.orgId, userId);
		if (live) {
			results.push({
				line: row.line,
				email: row.email,
				outcome: 'SKIPPED_ALREADY_ON_ROSTER',
			});
			continue;
		}

		const blocked = await findOrgVolunteerBlock(input.orgId, userId);
		if (blocked) {
			results.push({
				line: row.line,
				email: row.email,
				outcome: 'REFUSED_BY_VOLUNTEER',
				message: 'This person left the roster and revoked the org’s access.',
			});
			continue;
		}

		results.push({ line: row.line, email: row.email, outcome: 'ADDED' });
	}

	return results;
}

/**
 * Add every row, one transaction each. Never throws for a row — a row that
 * fails is recorded and the loop continues.
 *
 * `sendNotification: false` because the sends are paced afterwards by
 * `sendImportNotifications`; see that function and `addVolunteer`'s option.
 */
export async function importRoster(input: {
	orgId: string;
	rows: readonly RosterImportRow[];
	actorId: string | null;
	/** Called after each row so a long run reports progress as it goes. */
	onRow?: (result: RosterImportResult) => void;
}): Promise<RosterImportResult[]> {
	const results: RosterImportResult[] = [];

	for (const row of input.rows) {
		const result = await addRow(input.orgId, row, input.actorId);
		results.push(result);
		input.onRow?.(result);
	}

	return results;
}

async function addRow(
	orgId: string,
	row: RosterImportRow,
	actorId: string | null,
): Promise<RosterImportResult> {
	try {
		const added = await addVolunteer({
			orgId,
			displayName: row.displayName,
			email: row.email,
			phone: row.phone,
			actorId,
			via: 'CONCIERGE_IMPORT',
			sendNotification: false,
		});

		return {
			line: row.line,
			email: row.email,
			outcome: 'ADDED',
			notify: added.notify,
		};
	} catch (err) {
		// The two outcomes `addVolunteer` signals by throwing are both ordinary
		// results of a bulk load, not failures of it. Matched on the tRPC code
		// rather than the message so re-wording the user-facing copy cannot
		// silently reclassify half an import as errors.
		if (err instanceof TRPCError) {
			if (err.code === 'CONFLICT') {
				return {
					line: row.line,
					email: row.email,
					outcome: 'SKIPPED_ALREADY_ON_ROSTER',
				};
			}
			if (err.code === 'FORBIDDEN') {
				return {
					line: row.line,
					email: row.email,
					outcome: 'REFUSED_BY_VOLUNTEER',
					message: err.message,
				};
			}
		}

		return {
			line: row.line,
			email: row.email,
			outcome: 'FAILED',
			message: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Send the roster-added notices the import deferred, one at a time.
 *
 * Sequential and awaited. `addVolunteer`'s own send is fire-and-forget, which is
 * right for one coordinator clicking Add and wrong for sixty rows: Resend rate
 * limits, and a rejected send there lands in a `.catch(console.error)` on a
 * promise nobody holds. The people this email is owed to are precisely those
 * added from a spreadsheet they never saw, and it carries the only link to the
 * surface where they can revoke the access — so a silently dropped one is the
 * consent remedy going missing.
 *
 * Failures are returned, not thrown: the roster rows are already committed and
 * an unsent notice must not read as a failed import.
 */
export async function sendImportNotifications(input: {
	orgId: string;
	actorId: string | null;
	results: readonly RosterImportResult[];
	/** Milliseconds between sends. Defaults to DEFAULT_NOTIFY_DELAY_MS. */
	delayMs?: number;
	/** Called after each attempt, so a long run reports progress as it goes. */
	onSend?: (result: SendAttemptResult) => void;
}): Promise<{ sent: number; failed: Array<{ email: string; error: string }> }> {
	const owed = input.results.filter((r) => r.outcome === 'ADDED' && r.notify);

	if (owed.length === 0) return { sent: 0, failed: [] };

	// Resolved ONCE. The org name and the actor's name cannot change mid-run, and
	// re-reading them per recipient cost two redundant single-row queries per
	// notice.
	const context = await resolveRosterNotificationContext(
		input.orgId,
		input.actorId,
	);
	if (!context) {
		const failed = owed.map((r) => ({
			email: r.email,
			error: 'Organisation not found; no notices sent.',
		}));
		for (const f of failed) {
			input.onSend?.({ email: f.email, status: 'FAILED', error: f.error });
		}
		return { sent: 0, failed };
	}

	return tallySendAttempts(
		await sendNoticesSequentially({
			recipients: owed.map((r) => r.email),
			// One context for the whole batch: a live run has a single org and a
			// single actor, both invariant for its duration.
			resolveContext: async () => context,
			delayMs: input.delayMs,
			onResult: input.onSend,
		}),
	);
}

/** One send attempt. `FAILED` covers a rejection AND a `false` return alike. */
export type SendAttemptResult =
	| { email: string; status: 'SENT' }
	| { email: string; status: 'FAILED'; error: string };

/**
 * The reason a send that neither threw nor succeeded gives back.
 *
 * `sendEmail` returns `false` for a Resend error and for a bounce-suppressed
 * address, so this is the COMMON failure, not the exotic one. It has no detail
 * to offer beyond "look at the server logs" because `sendEmail` logs the cause
 * and returns a bare boolean.
 */
const SILENT_FAILURE_REASON =
	'send returned false — bounce-suppressed address or a provider error; see server logs';

/**
 * Send one notice per recipient, paced, sequential, awaited.
 *
 * The ONLY send loop. Both callers — the live import (`sendImportNotifications`)
 * and the `--notify-only` recovery (`sendOwedNotices`) — go through it, so the
 * pacing, the boolean-vs-rejection handling and the per-send streaming are
 * pinned in one place. Two paths that differ only in HOW the recipient list is
 * computed must not also differ in how sending works.
 *
 * This started as two loops with a docstring claiming they were one; a reviewer
 * caught the claim before it could become true by accident. If you add a third
 * caller, extend `resolveContext` rather than writing a second loop.
 *
 * Never throws: a failed notice is a fact to report, not a failed import.
 */
async function sendNoticesSequentially(input: {
	recipients: readonly string[];
	/**
	 * Resolves the display context for one recipient, called once per recipient
	 * in order.
	 *
	 * A CALLBACK rather than a single context because the two callers differ on
	 * exactly this and nothing else: a live run has one org and one actor for the
	 * whole batch, while a recovery attributes each notice to whoever the ORIGINAL
	 * run recorded. Passing a resolver is what lets both go through this loop
	 * instead of maintaining two copies of the pacing and the boolean handling.
	 * Returning `null` fails that recipient without stopping the batch.
	 */
	resolveContext: (
		email: string,
	) => Promise<{ orgName: string; addedByName: string | null } | null>;
	delayMs?: number;
	onResult?: (result: SendAttemptResult) => void;
}): Promise<SendAttemptResult[]> {
	const results: SendAttemptResult[] = [];

	for (const [index, email] of input.recipients.entries()) {
		if (index > 0) await sleep(input.delayMs ?? DEFAULT_NOTIFY_DELAY_MS);

		let result: SendAttemptResult;
		try {
			const context = await input.resolveContext(email);
			if (!context) {
				result = {
					email,
					status: 'FAILED',
					error: 'Organisation not found; no notice sent.',
				};
			} else {
				// The boolean is READ. `sendEmail` does not throw for a Resend error
				// or a suppressed address, so a `try/catch` alone counted every
				// silent failure as a success — the importer reported
				// "notifications sent: 60" with nothing delivered. The catch below
				// stays as defence in depth against a genuine throw further up; it
				// is not what covers this.
				const ok = await sendRosterAddedNotice(context, email);
				result = ok
					? { email, status: 'SENT' }
					: { email, status: 'FAILED', error: SILENT_FAILURE_REASON };
			}
		} catch (err) {
			result = {
				email,
				status: 'FAILED',
				error: err instanceof Error ? err.message : String(err),
			};
		}

		results.push(result);
		input.onResult?.(result);
	}

	return results;
}

function tallySendAttempts(results: readonly SendAttemptResult[]): {
	sent: number;
	failed: Array<{ email: string; error: string }>;
} {
	const failed: Array<{ email: string; error: string }> = [];
	let sent = 0;
	for (const r of results) {
		if (r.status === 'SENT') sent++;
		else failed.push({ email: r.email, error: r.error });
	}
	return { sent, failed };
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// --notify-only recovery
// ---------------------------------------------------------------------------

/** A row's status once the send has been attempted. */
export type NotifyOnlyRowStatus =
	| OwedNoticeResult['status']
	| 'SENT'
	| 'FAILED';

export type NotifyOnlyRow = {
	line: number;
	email: string;
	status: NotifyOnlyRowStatus;
	error?: string;
};

/**
 * Work out which of a CSV's rows are still owed a roster-added notice.
 *
 * Reads only. `--notify-only --dry-run` stops here, and the write path runs the
 * exact same classification before sending, so the rehearsal and the run cannot
 * disagree about who is in scope.
 */
export async function classifyOwedNotices(input: {
	orgId: string;
	rows: readonly RosterImportRow[];
}): Promise<{ orgName: string | null; rows: OwedNoticeResult[] }> {
	// `actorId: null` — this call resolves the ORG NAME, which is what the
	// EmailEvent subject is built from. Per-recipient attribution is resolved
	// later, from each audit row's own actor.
	const context = await resolveRosterNotificationContext(input.orgId, null);
	if (!context) return { orgName: null, rows: [] };

	const committedRows = await findConciergeImportAuditRows(input.orgId);

	// Classified twice. The first pass runs with an empty already-sent set purely
	// to find which addresses are even eligible, so the EmailEvent query is
	// issued for those rather than for every address in the file — most of a
	// re-fed CSV is rows that were never owed mail at all.
	const eligible = computeOwedNotices({
		rows: input.rows,
		committedRows,
		alreadySent: new Set(),
	})
		.filter((r) => r.status === 'OWED')
		.map((r) => r.email);

	// Both narrowed to the eligible set, and issued together — neither informs
	// the other, and this runs once per recovery rather than per row.
	const [alreadySent, blocked] = await Promise.all([
		findSentAddresses(eligible, rosterAddedEmailSubject(context.orgName)),
		findBlockedEmailsForOrg(input.orgId, eligible),
	]);

	return {
		orgName: context.orgName,
		rows: computeOwedNotices({
			rows: input.rows,
			committedRows,
			alreadySent,
			blocked,
		}),
	};
}

/**
 * Send the notices an interrupted run left owed.
 *
 * Attribution comes from each audit row's own `actorId`, not from a `--actor` on
 * this invocation: a recovery says what the original run would have said. The
 * context is resolved once per DISTINCT actor rather than per recipient — an
 * interrupted batch normally has exactly one, so this is one extra query, and
 * collapsing them all onto a single context would misattribute "who added you"
 * whenever a re-fed file spans two earlier runs.
 */
export async function sendOwedNotices(input: {
	orgId: string;
	rows: readonly RosterImportRow[];
	delayMs?: number;
	onSend?: (row: NotifyOnlyRow) => void;
}): Promise<{ orgName: string | null; rows: NotifyOnlyRow[] }> {
	const { orgName, rows: classified } = await classifyOwedNotices(input);
	if (orgName === null) return { orgName: null, rows: [] };

	const owed = classified.filter((r) => r.status === 'OWED');
	if (owed.length === 0) return { orgName, rows: classified };

	// Resolved once per DISTINCT actor. Keyed on `undefined` vs a cached `null`
	// deliberately: an actor whose context does not resolve caches the `null` and
	// is not re-queried on every later row that shares them.
	const contextByActor = new Map<
		string | null,
		{ orgName: string; addedByName: string | null } | null
	>();
	const actorByEmail = new Map(owed.map((r) => [r.email, r.actorId]));
	const lineByEmail = new Map(owed.map((r) => [r.email, r.line]));

	const attempts = await sendNoticesSequentially({
		recipients: owed.map((r) => r.email),
		resolveContext: async (email) => {
			const actorId = actorByEmail.get(email) ?? null;
			let context = contextByActor.get(actorId);
			if (context === undefined) {
				context = await resolveRosterNotificationContext(input.orgId, actorId);
				contextByActor.set(actorId, context);
			}
			return context;
		},
		delayMs: input.delayMs,
		onResult: (result) =>
			input.onSend?.(
				toNotifyOnlyRow(result, lineByEmail.get(result.email) ?? 0),
			),
	});

	const attempted = new Map(
		attempts.map((a) => [
			a.email,
			toNotifyOnlyRow(a, lineByEmail.get(a.email) ?? 0),
		]),
	);

	return {
		orgName,
		rows: classified.map((r) => attempted.get(r.email) ?? r),
	};
}

/** A send attempt, re-keyed onto the CSV line the operator reads. */
function toNotifyOnlyRow(
	attempt: SendAttemptResult,
	line: number,
): NotifyOnlyRow {
	return attempt.status === 'SENT'
		? { line, email: attempt.email, status: 'SENT' }
		: { line, email: attempt.email, status: 'FAILED', error: attempt.error };
}
