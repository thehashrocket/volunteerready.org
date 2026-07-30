/**
 * Unit tests for the concierge roster importer's pure surface.
 *
 * Covers argument parsing (where a mistake writes to production when the
 * operator meant to rehearse), CSV parsing, and the summary/exit-code contract.
 * The write loop itself is exercised in
 * `src/server/services/__tests__/rosterImport.test.ts`.
 *
 *   pnpm test:scripts
 */

import { describe, expect, it } from 'vitest';
import {
	exitCodeFor,
	parseRosterCsv,
	ROSTER_IMPORT_CAP,
	RosterCsvFormatError,
	type RosterImportResult,
	summarize,
} from '@/server/domain/roster-import';
import {
	ArgError,
	describeDatabase,
	formatResultLine,
	formatSummary,
	parseArgs,
} from './import-roster';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
	it('accepts --key value', () => {
		const args = parseArgs(['--org', 'shelter', '--file', 'a.csv', '--yes']);
		expect(args.org).toBe('shelter');
		expect(args.file).toBe('a.csv');
		expect(args.dryRun).toBe(false);
	});

	it('accepts --key=value', () => {
		const args = parseArgs(['--org=shelter', '--file=a.csv', '--dry-run']);
		expect(args.org).toBe('shelter');
		expect(args.file).toBe('a.csv');
		expect(args.dryRun).toBe(true);
	});

	it('notifies by default and not with --no-notify', () => {
		expect(parseArgs(['--org', 'o', '--file', 'f', '--yes']).notify).toBe(true);
		expect(
			parseArgs(['--org', 'o', '--file', 'f', '--yes', '--no-notify']).notify,
		).toBe(false);
	});

	it('reads --actor as an email, and rejects a bare --actor', () => {
		expect(
			parseArgs(['--org', 'o', '--file', 'f', '--yes', '--actor', 'a@b.c'])
				.actor,
		).toBe('a@b.c');
		expect(() =>
			parseArgs(['--org', 'o', '--file', 'f', '--yes', '--actor']),
		).toThrow(ArgError);
	});

	it('defaults --actor to null', () => {
		expect(parseArgs(['--org', 'o', '--file', 'f', '--yes']).actor).toBeNull();
	});

	// SAFETY: the three tests below are the ones that keep a rehearsal from
	// becoming a live write.
	it('SAFETY: refuses to write without --yes', () => {
		expect(() => parseArgs(['--org', 'o', '--file', 'f'])).toThrow(ArgError);
	});

	it('SAFETY: --dry-run needs no --yes', () => {
		expect(() =>
			parseArgs(['--org', 'o', '--file', 'f', '--dry-run']),
		).not.toThrow();
	});

	// SAFETY: found in pre-landing review. `flags.get('dry-run') === true` FAILED
	// OPEN when the switch carried a value — `--dry-run=false --yes`,
	// `--dry-run=0 --yes` and `--dry-run false --yes` all yielded
	// `dryRun: false, yes: true`, i.e. a live production write from a command line
	// that visibly reads `--dry-run`. Verified before the fix.
	it.each([
		['--dry-run=false'],
		['--dry-run=true'],
		['--dry-run=0'],
		['--dry-run=1'],
	])('SAFETY: refuses a value on --dry-run (%s)', (flag) => {
		expect(() =>
			parseArgs(['--org', 'o', '--file', 'f', flag, '--yes']),
		).toThrow(/switch and takes no value/);
	});

	it('SAFETY: refuses a bare token after --dry-run rather than swallowing it', () => {
		expect(() =>
			parseArgs(['--org', 'o', '--file', 'f', '--dry-run', 'false', '--yes']),
		).toThrow(/switch and takes no value/);
	});

	it('SAFETY: refuses a value on --no-notify, which would re-enable mail', () => {
		// Same root cause, different irreversible consequence: `!== true` read the
		// string 'true' as "flag absent" and mailed everyone anyway.
		expect(() =>
			parseArgs(['--org', 'o', '--file', 'f', '--yes', '--no-notify=true']),
		).toThrow(/switch and takes no value/);
	});

	it('SAFETY: refuses --dry-run and --yes together rather than guessing', () => {
		expect(() =>
			parseArgs(['--org', 'o', '--file', 'f', '--dry-run', '--yes']),
		).toThrow(/mutually exclusive/);
	});

	it('rejects an empty --actor as firmly as a bare one', () => {
		// An empty value would fall through `if (args.actor)` and attribute the
		// import to nobody — what naming an actor was meant to prevent.
		expect(() =>
			parseArgs(['--org', 'o', '--file', 'f', '--yes', '--actor=']),
		).toThrow(ArgError);
	});

	it('SAFETY: rejects an unknown flag rather than ignoring it', () => {
		// `--dryrun` silently ignored would run a live import the operator
		// believed was a rehearsal. This is the whole reason for the allowlist.
		expect(() =>
			parseArgs(['--org', 'o', '--file', 'f', '--yes', '--dryrun']),
		).toThrow(/Unknown flag: --dryrun/);
	});

	it('requires --org and --file', () => {
		expect(() => parseArgs(['--file', 'f', '--yes'])).toThrow(/--org/);
		expect(() => parseArgs(['--org', 'o', '--yes'])).toThrow(/--file/);
	});

	it('rejects a bare positional argument', () => {
		expect(() => parseArgs(['volunteers.csv'])).toThrow(ArgError);
	});
});

// ---------------------------------------------------------------------------
// parseRosterCsv
// ---------------------------------------------------------------------------

describe('parseRosterCsv', () => {
	it('parses a plain file', () => {
		const { rows, errors } = parseRosterCsv(
			'name,email,phone\nJane Doe,jane@example.org,555-1234\n',
		);
		expect(errors).toEqual([]);
		expect(rows).toEqual([
			{
				line: 2,
				displayName: 'Jane Doe',
				email: 'jane@example.org',
				phone: '555-1234',
			},
		]);
	});

	it('handles a quoted name containing a comma', () => {
		// The reason a hand-rolled split(',') is not good enough: without quote
		// handling the email column would arrive holding "Jane".
		const { rows } = parseRosterCsv(
			'name,email\n"Doe, Jane",jane@example.org\n',
		);
		expect(rows[0]?.displayName).toBe('Doe, Jane');
		expect(rows[0]?.email).toBe('jane@example.org');
	});

	it('canonicalizes the email and trims whitespace', () => {
		const { rows } = parseRosterCsv('name,email\n Jane , JANE@Example.ORG \n');
		expect(rows[0]?.email).toBe('jane@example.org');
		expect(rows[0]?.displayName).toBe('Jane');
	});

	it('accepts alternative header spellings and any column order', () => {
		const { rows } = parseRosterCsv(
			'Phone Number,E-Mail,Full Name\n555,jane@example.org,Jane\n',
		);
		expect(rows[0]).toMatchObject({
			displayName: 'Jane',
			email: 'jane@example.org',
			phone: '555',
		});
	});

	it('reads a header written by Excel, byte-order mark and all', () => {
		// Belt and braces: `parseCsvRecords` strips the BOM and `normalizeHeader`
		// would trim it anyway (﻿ counts as whitespace to `String.trim`).
		// The parser-level guarantee is pinned in domain/__tests__/csv.test.ts;
		// this only asserts the header still resolves end to end.
		const { rows } = parseRosterCsv('﻿name,email\nJane,jane@example.org\n');
		expect(rows).toHaveLength(1);
	});

	it('accepts CRLF line endings', () => {
		const { rows } = parseRosterCsv(
			'name,email\r\nJane,jane@example.org\r\nBob,bob@example.org\r\n',
		);
		expect(rows.map((r) => r.line)).toEqual([2, 3]);
	});

	it('skips blank lines without shifting the reported line numbers', () => {
		const { rows } = parseRosterCsv(
			'name,email\n\nJane,jane@example.org\n\n\nBob,bob@example.org\n',
		);
		expect(rows.map((r) => r.line)).toEqual([3, 6]);
	});

	it('treats a missing phone as null rather than an empty string', () => {
		const { rows } = parseRosterCsv('name,email,phone\nJane,jane@example.org,\n');
		expect(rows[0]?.phone).toBeNull();
	});

	it('reports a bad row and keeps the good ones', () => {
		const { rows, errors } = parseRosterCsv(
			'name,email\nJane,jane@example.org\nBob,not-an-email\nSue,sue@example.org\n',
		);
		expect(rows.map((r) => r.email)).toEqual([
			'jane@example.org',
			'sue@example.org',
		]);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.line).toBe(3);
	});

	it('reports a missing name rather than inventing one from the address', () => {
		const { rows, errors } = parseRosterCsv('name,email\n,jane@example.org\n');
		expect(rows).toEqual([]);
		expect(errors[0]?.message).toMatch(/Name is required/);
	});

	it('reports a duplicate address against the line that first claimed it', () => {
		const { rows, errors } = parseRosterCsv(
			'name,email\nJane,jane@example.org\nJ. Doe,JANE@example.org\n',
		);
		expect(rows).toHaveLength(1);
		expect(errors[0]?.line).toBe(3);
		expect(errors[0]?.message).toMatch(/Duplicate of line 2/);
	});

	it('throws on a file with no email column', () => {
		expect(() => parseRosterCsv('name,phone\nJane,555\n')).toThrow(
			RosterCsvFormatError,
		);
	});

	it('throws on a file with no name column', () => {
		expect(() => parseRosterCsv('email\njane@example.org\n')).toThrow(
			RosterCsvFormatError,
		);
	});

	it('refuses a file large enough to be a mis-selected export', () => {
		// Every unknown address mints a User + VolunteerProfile that no bulk path
		// can undo, so the cap is a blast-radius bound, not a capacity limit.
		const rows = [
			'name,email',
			...Array.from(
				{ length: ROSTER_IMPORT_CAP + 1 },
				(_, i) => `P ${i},p${i}@example.org`,
			),
		];
		expect(() => parseRosterCsv(rows.join('\n'))).toThrow(
			/refuses more than/,
		);
	});

	it('names the accepted spellings when a column is missing', () => {
		// Otherwise the operator's next move is to guess or read the source.
		expect(() => parseRosterCsv('volunteer name,email\n')).toThrow(
			/Accepted: name, displayname/,
		);
	});

	it('DATA LOSS: refuses a file with an unterminated quote', () => {
		// Rather than reporting "0 valid, 1 invalid — Email is required" for a file
		// whose email cells are all populated.
		expect(() =>
			parseRosterCsv('name,email\nPat "The Boss,p@x.org\nBob,b@x.org\n'),
		).toThrow(RosterCsvFormatError);
	});

	it('round-trips a value our own export would have prefixed', () => {
		// The export escapes `@`-leading names and `+`-leading phones against
		// formula injection; re-importing must undo it, not persist the prefix.
		const { rows } = parseRosterCsv(
			"name,email,phone\n'@handle Jones,a@x.org,'+1 555 0100\n",
		);
		expect(rows[0]?.displayName).toBe('@handle Jones');
		expect(rows[0]?.phone).toBe('+1 555 0100');
	});

	it('throws on an empty file', () => {
		expect(() => parseRosterCsv('')).toThrow(RosterCsvFormatError);
	});
});

// ---------------------------------------------------------------------------
// summarize / exitCodeFor
// ---------------------------------------------------------------------------

const result = (
	outcome: RosterImportResult['outcome'],
): RosterImportResult => ({ line: 1, email: 'a@b.c', outcome });

describe('summarize / exitCodeFor', () => {
	it('counts each outcome', () => {
		const summary = summarize([
			result('ADDED'),
			result('ADDED'),
			result('SKIPPED_ALREADY_ON_ROSTER'),
			result('FAILED'),
		]);
		expect(summary).toEqual({
			ADDED: 2,
			SKIPPED_ALREADY_ON_ROSTER: 1,
			REFUSED_BY_VOLUNTEER: 0,
			INVALID: 0,
			FAILED: 1,
		});
	});

	it('exits 0 when every row was added or skipped', () => {
		// Idempotence: a second run of the same file is all skips and must be a
		// success, or "fix three rows and re-run" stops being a normal workflow.
		expect(
			exitCodeFor(
				summarize([result('ADDED'), result('SKIPPED_ALREADY_ON_ROSTER')]),
			),
		).toBe(0);
	});

	it('exits 0 for a refusal — a correct outcome nobody may override', () => {
		expect(exitCodeFor(summarize([result('REFUSED_BY_VOLUNTEER')]))).toBe(0);
	});

	it('exits 1 on a failure or an invalid row', () => {
		expect(exitCodeFor(summarize([result('FAILED')]))).toBe(1);
		expect(exitCodeFor(summarize([result('INVALID')]))).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

describe('formatSummary', () => {
	it('labels the tally for the mode it ran in', () => {
		const summary = summarize([
			result('ADDED'),
			result('REFUSED_BY_VOLUNTEER'),
		]);
		expect(formatSummary(summary, true)).toMatch(/would add:\s+1/);
		expect(formatSummary(summary, false)).toMatch(/added:\s+1/);
		expect(formatSummary(summary, false)).toMatch(/refused by volunteer:\s+1/);
	});
});

describe('formatResultLine', () => {
	it('says "would add" in a dry run and "added" in a write run', () => {
		expect(formatResultLine(result('ADDED'), true)).toMatch(/would add/);
		expect(formatResultLine(result('ADDED'), false)).toMatch(/added/);
		expect(formatResultLine(result('ADDED'), false)).not.toMatch(/would/);
	});

	it('appends the message when there is one', () => {
		expect(
			formatResultLine({ ...result('FAILED'), message: 'boom' }, false),
		).toMatch(/boom/);
	});
});

describe('describeDatabase', () => {
	it('shows host and database, never the password', () => {
		const described = describeDatabase(
			'postgresql://user:hunter2@db.example.com:5432/volunteerready',
		);
		expect(described).toBe('db.example.com/volunteerready');
		expect(described).not.toMatch(/hunter2/);
	});

	it('degrades rather than throwing', () => {
		expect(describeDatabase(undefined)).toMatch(/not set/);
		expect(describeDatabase('nonsense')).toMatch(/unparseable/);
	});
});
