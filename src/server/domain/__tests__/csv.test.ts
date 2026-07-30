import { describe, expect, it } from 'vitest';
import {
	CsvFormatError,
	escapeCsvField,
	parseCsvRecords,
	toCsvLine,
	unescapeCsvField,
} from '../csv';

describe('parseCsvRecords', () => {
	it('parses plain rows', () => {
		expect(parseCsvRecords('a,b\n1,2\n')).toEqual([
			{ line: 1, fields: ['a', 'b'] },
			{ line: 2, fields: ['1', '2'] },
		]);
	});

	it('keeps a comma inside a quoted field', () => {
		expect(parseCsvRecords('"Doe, Jane",x\n')[0]?.fields).toEqual([
			'Doe, Jane',
			'x',
		]);
	});

	it('unescapes a doubled quote', () => {
		expect(parseCsvRecords('"say ""hi""",x\n')[0]?.fields).toEqual([
			'say "hi"',
			'x',
		]);
	});

	it('keeps a newline inside a quoted field, and still counts the line', () => {
		// The embedded newline is data, but it moves the file's line counter — so
		// the NEXT record must report line 3, not line 2. Without that a
		// spreadsheet with one multi-line cell reports every later error against
		// the wrong row, which is worse than not reporting a line at all.
		const records = parseCsvRecords('"two\nlines",x\nnext,y\n');
		expect(records[0]?.fields[0]).toBe('two\nlines');
		expect(records[1]).toEqual({ line: 3, fields: ['next', 'y'] });
	});

	it('strips a UTF-8 BOM from the first field', () => {
		// Excel writes one. It survives into the first header cell, and while
		// `String.trim()` happens to remove ﻿, no caller should have to know
		// that — a consumer comparing an untrimmed first field would miss.
		expect(parseCsvRecords('﻿name,email\n')[0]?.fields).toEqual([
			'name',
			'email',
		]);
	});

	it('accepts CRLF, LF and lone CR line endings', () => {
		for (const eol of ['\r\n', '\n', '\r']) {
			expect(parseCsvRecords(`a,b${eol}c,d${eol}`)).toEqual([
				{ line: 1, fields: ['a', 'b'] },
				{ line: 2, fields: ['c', 'd'] },
			]);
		}
	});

	it('drops blank lines but keeps the original line numbers', () => {
		expect(parseCsvRecords('a\n\n\nb\n')).toEqual([
			{ line: 1, fields: ['a'] },
			{ line: 4, fields: ['b'] },
		]);
	});

	it('does not invent a trailing record for a trailing newline', () => {
		expect(parseCsvRecords('a,b\n')).toHaveLength(1);
	});

	it('reads a final row that has no line terminator', () => {
		expect(parseCsvRecords('a,b\nc,d')).toHaveLength(2);
	});

	it('preserves empty fields rather than collapsing them', () => {
		expect(parseCsvRecords('a,,c\n')[0]?.fields).toEqual(['a', '', 'c']);
	});

	it('DATA LOSS: refuses a file with an unterminated quote', () => {
		// Found in pre-landing review. Before the fix, one unbalanced quote made
		// the parser swallow every following line into a single field: a 4-line
		// file became 1 record with 1 field, and the importer reported
		// `Email is required. ("")` on one line — a wrong diagnosis for a file with
		// three populated email cells, silently dropping the other rows.
		expect(() =>
			parseCsvRecords('name,email\nPat "The Boss,p1@x.org\nBob,b@x.org\n'),
		).toThrow(CsvFormatError);
	});

	it('names the line the unterminated quote started on', () => {
		expect(() => parseCsvRecords('a,b\nc,"d\ne,f\n')).toThrow(/line 2/);
	});

	it('still accepts a balanced quote spanning lines', () => {
		expect(parseCsvRecords('a,"b\nc"\nd,e\n')).toHaveLength(2);
	});

	it('returns nothing for an empty string', () => {
		expect(parseCsvRecords('')).toEqual([]);
	});
});

describe('escapeCsvField', () => {
	// The behaviour itself is covered in esg-report.test.ts, which was written
	// against this function in its previous home. These pin the properties that
	// matter now that a second consumer (the roster export) depends on it.
	it('round-trips through the parser', () => {
		const values = ['plain', 'has,comma', 'has"quote', 'has\nnewline', ''];
		const parsed = parseCsvRecords(`${toCsvLine(values)}\n`);
		expect(parsed[0]?.fields).toEqual(values);
	});

	it('SECURITY: a carriage return cannot break out of a field', () => {
		// Found in pre-landing review. `escapeCsvField` only quoted on `\n`, but
		// `parseCsvRecords` accepts a lone CR as a record terminator — so an
		// unquoted `\r` ENDED the record and everything after it became the first
		// field of a new row, which never passes the formula guard. Verified
		// before the fix: this round-tripped as TWO records with `=cmd|…` leading
		// the second. `displayName` is volunteer-controlled on APPLIED roster
		// rows, and the export hands the file to a coordinator.
		const payload = "Jane\r=cmd|'/C calc'!A0";
		const records = parseCsvRecords(`${toCsvLine([payload, 'j@x.org'])}\n`);
		expect(records).toHaveLength(1);
		expect(records[0]?.fields).toEqual([payload, 'j@x.org']);
	});

	it('SECURITY: neutralizes a formula hidden behind leading whitespace', () => {
		// Excel and Sheets trim before deciding a cell is a formula, so a leading
		// tab is not protection.
		expect(escapeCsvField('\t=HYPERLINK("http://evil")')).toContain("'\t=");
	});

	it('quotes a field containing a lone CR', () => {
		expect(escapeCsvField('a\rb')).toBe('"a\rb"');
	});

	it('neutralizes a formula so a spreadsheet will not execute it', () => {
		// The prefix goes INSIDE the quoting, not outside it — this value also
		// contains commas and quotes, so it gets wrapped as well. A `'` written
		// outside the wrapper would be a literal field of its own.
		expect(escapeCsvField('=HYPERLINK("http://evil","click")')).toBe(
			`"'=HYPERLINK(""http://evil"",""click"")"`,
		);
	});

	it('round-trips a neutralized formula back to the prefixed text', () => {
		// The prefix is data once written, so the PARSER returns it verbatim.
		// Undoing it is `unescapeCsvField`'s job — see below.
		expect(parseCsvRecords(`${toCsvLine(['=SUM(A1)'])}\n`)[0]?.fields).toEqual([
			"'=SUM(A1)",
		]);
	});
});

describe('unescapeCsvField', () => {
	it('DATA CORRUPTION: makes export → import a true round trip', () => {
		// Found in pre-landing review. Our own export is an input to our own
		// importer, and without undoing the formula prefix a re-imported
		// `+1 555 0100` persisted as `'+1 555 0100`. Both displayNameSchema and
		// volunteerPhoneSchema accept a leading apostrophe, so it was silent.
		// Every international phone number was affected.
		const values = ['@handle Jones', 'a@x.org', '+1 555 0100', '=SUM(A1)'];
		const parsed = parseCsvRecords(`${toCsvLine(values)}\n`)[0]?.fields ?? [];
		expect(parsed.map(unescapeCsvField)).toEqual(values);
	});

	it('leaves an apostrophe that the writer would not have added', () => {
		// `'tis` starts with a quote but `tis` is not a formula lead, so the
		// writer never prefixed it and stripping would corrupt a real name.
		expect(unescapeCsvField("'tis Jones")).toBe("'tis Jones");
	});

	it('leaves a doubled apostrophe alone, because the writer cannot produce one', () => {
		// `escapeCsvField("'=SUM(A1)")` adds NO prefix — `'` is neither whitespace
		// nor a formula lead, so FORMULA_LEAD does not match. A value that arrives
		// as `''=SUM(A1)` was therefore always literal, and stripping would corrupt
		// it. Asserted so a future "strip all leading quotes" simplification is red.
		expect(unescapeCsvField("''=SUM(A1)")).toBe("''=SUM(A1)");
		expect(escapeCsvField("'=SUM(A1)")).toBe("'=SUM(A1)");
	});
});
