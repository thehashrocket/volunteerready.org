/**
 * `parseCsv` — the applications bulk importer's CSV surface.
 *
 * This module had NO tests when it was migrated off `line.split(',')` onto the
 * shared RFC 4180 parser in `domain/csv.ts`, so these pin both the behaviour
 * that had to survive the swap (trimming, lowercasing, the `{ rows, errors }`
 * contract, never throwing) and the behaviour the swap exists to fix.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));
vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(),
}));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

const { parseCsv } = await import('../bulk-import-service');

describe('parseCsv — preserved behaviour', () => {
	it('reads the email column and lowercases it', () => {
		const { rows, errors } = parseCsv('email\nAda@Example.ORG\n');
		expect(errors).toEqual([]);
		expect(rows).toEqual([
			{ line: 2, email: 'ada@example.org', opportunityId: undefined },
		]);
	});

	it('trims surrounding whitespace on every cell', () => {
		// `parseCsvRecords` is a tokenizer and normalizes nothing, so dropping the
		// trim would send ` ada@example.org` to a column stored canonical.
		const { rows } = parseCsv(
			' email , opportunityid \n ada@example.org , opp_1 \n',
		);
		expect(rows).toEqual([
			{ line: 2, email: 'ada@example.org', opportunityId: 'opp_1' },
		]);
	});

	it('matches the header case-insensitively', () => {
		const { rows } = parseCsv('Email,OpportunityId\nada@example.org,opp_1\n');
		expect(rows).toEqual([
			{ line: 2, email: 'ada@example.org', opportunityId: 'opp_1' },
		]);
	});

	it('reads an empty opportunityId as undefined, not as an empty string', () => {
		const { rows } = parseCsv('email,opportunityid\nada@example.org,\n');
		expect(rows[0]?.opportunityId).toBeUndefined();
	});

	it('omits opportunityId entirely when the column is absent', () => {
		const { rows } = parseCsv('email\nada@example.org\n');
		expect(rows[0]?.opportunityId).toBeUndefined();
	});

	it('reports a header with no email column', () => {
		expect(parseCsv('name,phone\nAda,555\n')).toEqual({
			rows: [],
			errors: [{ row: 1, error: 'Missing required "email" column' }],
		});
	});

	it('reports a file with a header and nothing else', () => {
		expect(parseCsv('email\n')).toEqual({
			rows: [],
			errors: [{ row: 1, error: 'No data rows found' }],
		});
	});

	it('reports an empty file', () => {
		expect(parseCsv('')).toEqual({
			rows: [],
			errors: [{ row: 1, error: 'No header row found' }],
		});
	});

	it('records a bad address and keeps parsing the rest', () => {
		// One typo must not cost the operator the other fifty-nine rows.
		const { rows, errors } = parseCsv(
			'email\nada@example.org\nnot-an-email\ngrace@example.org\n',
		);
		expect(rows.map((r) => r.email)).toEqual([
			'ada@example.org',
			'grace@example.org',
		]);
		expect(errors).toEqual([
			{ row: 3, error: 'Invalid email: "not-an-email"' },
		]);
	});
});

describe('parseCsv — what the shared parser fixes', () => {
	it('keeps a quoted field containing a comma in one column', () => {
		// The whole reason for the swap. `split(',')` shifted every later column
		// left, so `opportunityId` read as the tail of somebody's name.
		const { rows, errors } = parseCsv(
			'email,name,opportunityid\nada@example.org,"Smith, Jane",opp_1\n',
		);
		expect(errors).toEqual([]);
		expect(rows).toEqual([
			{ line: 2, email: 'ada@example.org', opportunityId: 'opp_1' },
		]);
	});

	it('unescapes a doubled quote inside a quoted field', () => {
		const { rows } = parseCsv(
			'email,name,opportunityid\nada@example.org,"Ada ""Countess"" L",opp_1\n',
		);
		expect(rows[0]?.opportunityId).toBe('opp_1');
	});

	it('numbers an error by its TRUE file line, past a blank line', () => {
		// The old numbering indexed a blank-line-filtered array, so every reported
		// row number after a blank line pointed at the wrong spreadsheet row —
		// which is the number the operator uses to find what to fix.
		const { errors } = parseCsv('email\nada@example.org\n\nnot-an-email\n');
		expect(errors).toEqual([
			{ row: 4, error: 'Invalid email: "not-an-email"' },
		]);
	});

	it('accepts a BOM-prefixed file, as Excel exports one', () => {
		// Previously the BOM corrupted the first header cell, so `﻿email`
		// failed the lookup and a perfectly good file was rejected outright.
		const { rows, errors } = parseCsv('﻿email\nada@example.org\n');
		expect(errors).toEqual([]);
		expect(rows).toEqual([
			{ line: 2, email: 'ada@example.org', opportunityId: undefined },
		]);
	});

	it.each([
		['CRLF', 'email\r\nada@example.org\r\n'],
		['LF', 'email\nada@example.org\n'],
		['lone CR', 'email\rada@example.org\r'],
	])('reads %s line endings', (_label, csv) => {
		// A lone-CR file (old Mac export) previously did not split into rows at
		// all — the whole file became one line.
		const { rows } = parseCsv(csv);
		expect(rows).toEqual([
			{ line: 2, email: 'ada@example.org', opportunityId: undefined },
		]);
	});

	it('reads a final row with no trailing newline', () => {
		const { rows } = parseCsv('email\nada@example.org');
		expect(rows).toHaveLength(1);
	});

	it('NEVER THROWS on an unterminated quote — it reports it', () => {
		// `parseCsvRecords` raises CsvFormatError here. The only caller is a tRPC
		// mutation that records the outcome on a BulkImportJob, so a job saying
		// what is wrong beats an uncaught 500 that says nothing. Previously the
		// stray quote was silently absorbed into whatever `split(',')` produced.
		const { rows, errors } = parseCsv('email\n"ada@example.org\n');

		expect(rows).toEqual([]);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.row).toBe(1);
		expect(errors[0]?.error).toMatch(/quote/i);
	});
});

describe('parseCsv — blank and whitespace rows', () => {
	it('ignores a whitespace-only data line rather than reporting it', () => {
		// `parseCsvRecords` drops a record only when its single field is exactly
		// '', so a line of spaces survives tokenization where the old
		// trim-then-filter dropped it — and would have surfaced as
		// `Invalid email: ""`, inflating the parse-error count the upload page
		// shows the coordinator.
		const { rows, errors } = parseCsv('email\nada@example.org\n   \n');
		expect(errors).toEqual([]);
		expect(rows).toHaveLength(1);
	});

	it('ignores the trailing `,,,` padding rows spreadsheets append', () => {
		const { rows, errors } = parseCsv(
			'email,opportunityid\nada@example.org,opp_1\n,,\n',
		);
		expect(errors).toEqual([]);
		expect(rows).toHaveLength(1);
	});

	it('carries the source line onto each row for downstream error reporting', () => {
		// processImportJob reports a PROCESSING failure by this line, so a parse
		// error and a processing error land in one `errorRows` column using the
		// same coordinate. They used to use two schemes that could collide.
		const { rows } = parseCsv('email\nada@example.org\n\ngrace@example.org\n');
		expect(rows.map((r) => r.line)).toEqual([2, 4]);
	});
});
