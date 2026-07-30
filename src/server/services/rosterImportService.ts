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

import type {
	RosterImportResult,
	RosterImportRow,
} from '@/server/domain/roster-import';
import {
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
}): Promise<{ sent: number; failed: Array<{ email: string; error: string }> }> {
	const owed = input.results.filter((r) => r.outcome === 'ADDED' && r.notify);
	const failed: Array<{ email: string; error: string }> = [];
	let sent = 0;

	if (owed.length === 0) return { sent, failed };

	// Resolved ONCE. The org name and the actor's name cannot change mid-run, and
	// re-reading them per recipient cost two redundant single-row queries per
	// notice.
	const context = await resolveRosterNotificationContext(
		input.orgId,
		input.actorId,
	);
	if (!context) {
		return {
			sent,
			failed: owed.map((r) => ({
				email: r.email,
				error: 'Organisation not found; no notices sent.',
			})),
		};
	}

	for (const [index, result] of owed.entries()) {
		if (index > 0) await sleep(input.delayMs ?? DEFAULT_NOTIFY_DELAY_MS);
		try {
			await sendRosterAddedNotice(context, result.email);
			sent++;
		} catch (err) {
			failed.push({
				email: result.email,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return { sent, failed };
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
