import { describe, expect, it } from 'vitest';
import type { AccountState } from '@/prisma/generated/client';
import { parseCsvRecords } from '../csv';
import {
	ACCOUNT_STATE_EXPORT_COPY,
	formatFailureNotice,
	formatRosterHeader,
	formatRosterRow,
	formatTruncationNotice,
	ROSTER_EXPORT_HEADERS,
	type RosterExportRow,
	rosterExportFilename,
} from '../roster-export';

const row = (over: Partial<RosterExportRow> = {}): RosterExportRow => ({
	displayName: 'Jane Doe',
	email: 'jane@example.org',
	phone: '555-1234',
	accountState: 'ACTIVE',
	source: 'STAFF_ADDED',
	createdAt: new Date('2026-03-04T17:45:00Z'),
	attendedShifts: 7,
	...over,
});

describe('formatRosterRow', () => {
	it('emits one field per header, in header order', () => {
		const fields = parseCsvRecords(`${formatRosterRow(row())}\n`)[0]?.fields;
		expect(fields).toEqual([
			'Jane Doe',
			'jane@example.org',
			'555-1234',
			'Active',
			'Added by their staff',
			'2026-03-04',
			'7',
		]);
		expect(fields).toHaveLength(ROSTER_EXPORT_HEADERS.length);
	});

	it('keeps the header and the row the same width', () => {
		// Drifting by one column silently shifts every value in the file.
		const header = parseCsvRecords(`${formatRosterHeader()}\n`)[0]?.fields;
		const data = parseCsvRecords(`${formatRosterRow(row())}\n`)[0]?.fields;
		expect(data?.length).toBe(header?.length);
	});

	it('writes a date, not a timestamp', () => {
		expect(formatRosterRow(row())).toContain('2026-03-04');
		expect(formatRosterRow(row())).not.toContain('17:45');
	});

	it('renders a missing email or phone as a blank cell, not "null"', () => {
		const fields = parseCsvRecords(
			`${formatRosterRow(row({ email: null, phone: null }))}\n`,
		)[0]?.fields;
		expect(fields?.[1]).toBe('');
		expect(fields?.[2]).toBe('');
	});

	it('escapes a name containing a comma', () => {
		const fields = parseCsvRecords(
			`${formatRosterRow(row({ displayName: 'Doe, Jane' }))}\n`,
		)[0]?.fields;
		expect(fields?.[0]).toBe('Doe, Jane');
	});

	it('SECURITY: neutralizes a formula in an org-entered name', () => {
		// `displayName` is free text a coordinator typed, or that arrived in a
		// spreadsheet we imported. It lands in someone's Excel.
		expect(formatRosterRow(row({ displayName: '=cmd|calc' }))).toContain(
			"'=cmd|calc",
		);
	});

	it('names both account states', () => {
		const states: AccountState[] = ['ACTIVE', 'UNCLAIMED'];
		for (const state of states) {
			expect(ACCOUNT_STATE_EXPORT_COPY[state]).toBeTruthy();
		}
		expect(
			parseCsvRecords(
				`${formatRosterRow(row({ accountState: 'UNCLAIMED' }))}\n`,
			)[0]?.fields[3],
		).toBe('Invited — has not signed in');
	});
});

describe('rosterExportFilename', () => {
	it('is dated and names the org', () => {
		expect(
			rosterExportFilename(
				'riverside-shelter',
				new Date('2026-07-29T00:00:00Z'),
			),
		).toBe('roster-riverside-shelter-2026-07-29.csv');
	});
});

describe('formatTruncationNotice', () => {
	it('says how many rows it stopped at', () => {
		expect(formatTruncationNotice()).toContain('10000');
	});

	it('keeps the file rectangular', () => {
		// A one-field row in a seven-column file yields a final record whose Name
		// is the notice and whose other columns are empty — a phantom volunteer.
		const csv = `${formatRosterHeader()}\n${formatTruncationNotice()}\n`;
		const records = parseCsvRecords(csv);
		expect(records[1]?.fields).toHaveLength(ROSTER_EXPORT_HEADERS.length);
	});
});

describe('formatFailureNotice', () => {
	it('names the row count and says the file is unusable', () => {
		const notice = formatFailureNotice(1234);
		expect(notice).toContain('1234');
		expect(notice).toMatch(/INCOMPLETE/);
	});

	it('keeps the file rectangular', () => {
		const csv = `${formatRosterHeader()}\n${formatFailureNotice(5)}\n`;
		expect(parseCsvRecords(csv)[1]?.fields).toHaveLength(
			ROSTER_EXPORT_HEADERS.length,
		);
	});
});

describe('the exported column contract', () => {
	it('pins the header line verbatim', () => {
		// Downstream consumers parse these columns. Renaming or reordering one is
		// a breaking change that no width-equality assertion would catch.
		expect(formatRosterHeader()).toBe(
			'Name,Email,Phone,Status,How they joined,Added,Shifts attended',
		);
	});
});
