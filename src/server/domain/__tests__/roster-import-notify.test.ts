/**
 * `computeOwedNotices` — the pure half of `pnpm import:roster --notify-only`.
 *
 * This is the classification an interrupted import has to be recovered through:
 * a run killed at row 55 of 60 leaves 55 roster rows committed and zero notices
 * sent, and re-running the importer cannot repair it — every committed row comes
 * back as `SKIPPED_ALREADY_ON_ROSTER`, which carries no notify flag. The audit
 * row is the only durable record of who was added and which branch was taken.
 *
 * Kept DB-free so every branch is a unit test. Most of these states are painful
 * to stage against real data and would otherwise go unexercised.
 */

import { describe, expect, it } from 'vitest';
import {
	type CommittedConciergeAddRow,
	computeOwedNotices,
	type NotifyOnlySummary,
	notifyOnlyExitCode,
	type RosterImportRow,
} from '../roster-import';

const row = (line: number, email: string): RosterImportRow => ({
	line,
	email,
	displayName: 'Ada Lovelace',
	phone: null,
});

const committed = (
	email: string,
	outcome: string | null,
	overrides: Partial<CommittedConciergeAddRow> = {},
): CommittedConciergeAddRow => ({
	email,
	outcome,
	actorId: 'u_actor',
	createdAt: new Date('2026-01-01T00:00:00Z'),
	...overrides,
});

const statusFor = (
	rows: readonly RosterImportRow[],
	committedRows: readonly CommittedConciergeAddRow[],
	alreadySent: ReadonlySet<string> = new Set(),
) =>
	computeOwedNotices({ rows, committedRows, alreadySent }).map((r) => r.status);

describe('computeOwedNotices', () => {
	it('owes a notice for a committed LINKED_ACTIVE add', () => {
		expect(
			statusFor(
				[row(2, 'ada@example.org')],
				[committed('ada@example.org', 'LINKED_ACTIVE')],
			),
		).toEqual(['OWED']);
	});

	it.each([
		'CREATED_SHADOW',
		'LINKED_UNCLAIMED',
	])('owes nothing for a committed %s add', (outcome) => {
		// These two branches deliberately send no mail at all — nobody has asked
		// to hear from us and the address may be a typo. A recovery mode that
		// mailed them would send email the original run correctly withheld.
		expect(
			statusFor(
				[row(2, 'ada@example.org')],
				[committed('ada@example.org', outcome)],
			),
		).toEqual(['INELIGIBLE_OUTCOME']);
	});

	it('reports a row no import ever added as NOT_COMMITTED', () => {
		// The ordinary shape of re-feeding a file killed partway: everything past
		// the kill point is legitimately uncommitted.
		expect(statusFor([row(2, 'ada@example.org')], [])).toEqual([
			'NOT_COMMITTED',
		]);
	});

	it('does not treat another address at the same org as a match', () => {
		expect(
			statusFor(
				[row(2, 'ada@example.org')],
				[committed('grace@example.org', 'LINKED_ACTIVE')],
			),
		).toEqual(['NOT_COMMITTED']);
	});

	it('skips — advisorily — an address that already has a SENT event', () => {
		expect(
			statusFor(
				[row(2, 'ada@example.org')],
				[committed('ada@example.org', 'LINKED_ACTIVE')],
				new Set(['ada@example.org']),
			),
		).toEqual(['ALREADY_SENT']);
	});

	it.each([
		['an unrecognised outcome', 'LINKED_SOMETHING_NEW'],
		['a missing outcome', null],
	])('reports %s as MALFORMED_AUDIT_ROW, not as ineligible', (_label, outcome) => {
		// Deliberately its own status. "This person was never owed an email" and
		// "we cannot tell whether they were" are different answers, and reporting
		// the second as the first answers a question nothing actually answered.
		expect(
			statusFor(
				[row(2, 'ada@example.org')],
				[committed('ada@example.org', outcome)],
			),
		).toEqual(['MALFORMED_AUDIT_ROW']);
	});

	it('carries the ORIGINAL run’s actor, so a resend is attributed as it was', () => {
		// Not the actor of whoever is running the recovery today — that would tell
		// volunteers they were added by someone who never added them.
		const [result] = computeOwedNotices({
			rows: [row(2, 'ada@example.org')],
			committedRows: [
				committed('ada@example.org', 'LINKED_ACTIVE', {
					actorId: 'u_original',
				}),
			],
			alreadySent: new Set(),
		});

		expect(result?.actorId).toBe('u_original');
	});

	it.each([
		['oldest first', ['old', 'new']],
		['newest first', ['new', 'old']],
	])('takes the NEWEST audit row when an address has two (%s)', (_label, order) => {
		// An address removed and re-imported carries two rows. Asserted in BOTH
		// input orders because sorting is done here rather than trusted from the
		// repository's `orderBy` — a test that only passes one order would still
		// be green if the sort were deleted.
		const rows: Record<string, CommittedConciergeAddRow> = {
			old: committed('ada@example.org', 'CREATED_SHADOW', {
				createdAt: new Date('2026-01-01T00:00:00Z'),
				actorId: 'u_old',
			}),
			new: committed('ada@example.org', 'LINKED_ACTIVE', {
				createdAt: new Date('2026-06-01T00:00:00Z'),
				actorId: 'u_new',
			}),
		};

		const [result] = computeOwedNotices({
			rows: [row(2, 'ada@example.org')],
			// biome-ignore lint/style/noNonNullAssertion: keys are literals above
			committedRows: order.map((k) => rows[k]!),
			alreadySent: new Set(),
		});

		expect(result?.status).toBe('OWED');
		expect(result?.actorId).toBe('u_new');
	});

	it('preserves the file’s line numbers and order', () => {
		// The operator fixes a spreadsheet by line number.
		const results = computeOwedNotices({
			rows: [row(2, 'a@example.org'), row(7, 'b@example.org')],
			committedRows: [committed('b@example.org', 'LINKED_ACTIVE')],
			alreadySent: new Set(),
		});

		expect(results.map((r) => [r.line, r.status])).toEqual([
			[2, 'NOT_COMMITTED'],
			[7, 'OWED'],
		]);
	});

	it('returns nothing for an empty file rather than throwing', () => {
		expect(
			computeOwedNotices({
				rows: [],
				committedRows: [committed('ada@example.org', 'LINKED_ACTIVE')],
				alreadySent: new Set(),
			}),
		).toEqual([]);
	});
});

describe('notifyOnlyExitCode', () => {
	const summary = (
		over: Partial<NotifyOnlySummary> = {},
	): NotifyOnlySummary => ({
		OWED: 0,
		SENT: 0,
		FAILED: 0,
		ALREADY_SENT: 0,
		INELIGIBLE_OUTCOME: 0,
		NOT_COMMITTED: 0,
		MALFORMED_AUDIT_ROW: 0,
		...over,
	});

	it('is 0 when every owed notice was sent', () => {
		expect(notifyOnlyExitCode(summary({ SENT: 3 }))).toBe(0);
	});

	it('is 1 when a notice failed', () => {
		expect(notifyOnlyExitCode(summary({ SENT: 2, FAILED: 1 }))).toBe(1);
	});

	it('is 1 when an audit row could not be read', () => {
		expect(notifyOnlyExitCode(summary({ MALFORMED_AUDIT_ROW: 1 }))).toBe(1);
	});

	it('is 0 for rows nothing ever added — the expected shape of the input', () => {
		// Re-feeding a file interrupted at row 55 leaves rows 56-60 uncommitted.
		// Exiting 1 on the normal case would train the operator to ignore the code.
		expect(notifyOnlyExitCode(summary({ SENT: 55, NOT_COMMITTED: 5 }))).toBe(0);
	});

	it('is 0 for already-sent and never-owed rows', () => {
		expect(
			notifyOnlyExitCode(summary({ ALREADY_SENT: 4, INELIGIBLE_OUTCOME: 9 })),
		).toBe(0);
	});
});

describe('computeOwedNotices — the volunteer revoked access', () => {
	const blocked = (email: string) =>
		computeOwedNotices({
			rows: [row(2, email)],
			committedRows: [committed(email, 'LINKED_ACTIVE')],
			alreadySent: new Set(),
			blocked: new Set([email]),
		});

	it('SECURITY: refuses a notice to someone who left and revoked the org', () => {
		// Every other roster path refuses while an OrgVolunteerBlock stands. A
		// recovery ACTS on a roster relationship, so it must too — otherwise it
		// tells the one person who explicitly revoked this org that they were just
		// added to its roster, which is both unwanted and no longer true.
		expect(blocked('ada@example.org')[0]?.status).toBe('REFUSED_BY_VOLUNTEER');
	});

	it('checks the block BEFORE the advisory already-sent skip', () => {
		// A block is a fact about consent; a SENT event is only advisory. Reporting
		// "already sent" for a blocked address would hide the revocation from the
		// operator behind a routine-looking dedupe line.
		const [result] = computeOwedNotices({
			rows: [row(2, 'ada@example.org')],
			committedRows: [committed('ada@example.org', 'LINKED_ACTIVE')],
			alreadySent: new Set(['ada@example.org']),
			blocked: new Set(['ada@example.org']),
		});

		expect(result?.status).toBe('REFUSED_BY_VOLUNTEER');
	});

	it('still owes the notice when nobody is blocked', () => {
		// The contrast case: without it the assertions above pass for a function
		// that refuses everyone.
		expect(
			statusFor(
				[row(2, 'ada@example.org')],
				[committed('ada@example.org', 'LINKED_ACTIVE')],
			),
		).toEqual(['OWED']);
	});

	it('treats an omitted blocked set as "nobody is blocked"', () => {
		// The parameter is optional so existing callers keep compiling; the default
		// must not accidentally refuse everything.
		expect(
			computeOwedNotices({
				rows: [row(2, 'ada@example.org')],
				committedRows: [committed('ada@example.org', 'LINKED_ACTIVE')],
				alreadySent: new Set(),
			})[0]?.status,
		).toBe('OWED');
	});
});
