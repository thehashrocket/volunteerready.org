/**
 * CSV primitives — one parser and one writer, shared by every consumer.
 *
 * Pure: no I/O, no Prisma, safe to import from `scripts/**` as well as from
 * services.
 *
 * `escapeCsvField` moved here from `esg-report.ts` when the roster CSV export
 * (T19) became its second consumer. `esg-report.ts` re-exports it so its own
 * tests and callers are unchanged.
 *
 * `bulk-import-service.parseCsv` (the applications importer) reads through
 * `parseCsvRecords` as of v0.41.0.0 — it used to do `line.split(',')` and was
 * the last surface that did. There is now exactly ONE CSV parser in this repo;
 * a second one is a regression, not a shortcut.
 */

/** The byte-order mark Excel writes at the head of a UTF-8 CSV. */
const BOM = '\ufeff';

/**
 * Thrown when the FILE cannot be interpreted, as opposed to a row in it.
 *
 * Only an unterminated quote raises this today, and it has to: once a quote is
 * left open, every column boundary after it is unknowable, so there is no honest
 * per-row answer to give.
 */
export class CsvFormatError extends Error {}

export type CsvRecord = {
	/**
	 * 1-indexed line where this record STARTS, in the original file.
	 *
	 * Not the index in the returned array: blank lines are dropped and a quoted
	 * field may span several lines, so the two diverge. This is the number an
	 * operator types into their spreadsheet's "go to line", which is the entire
	 * reason it is carried rather than recomputed.
	 */
	line: number;
	fields: string[];
};

/**
 * Parse RFC 4180 CSV: quoted fields, embedded commas and newlines, `""` escapes.
 *
 * A naive `split(',')` is wrong for the files this actually receives. Real
 * volunteer spreadsheets contain `"Smith, Jane"` in the name column, and
 * splitting on the comma silently shifts every later column left — so the email
 * column arrives holding a first name and the row fails validation for a reason
 * that has nothing to do with what is wrong with it.
 *
 * Accepts CRLF, LF and lone-CR line endings. Records that are entirely empty
 * are dropped (spreadsheet exports pad the tail), which is why `line` is
 * carried on each record rather than inferred from the array index.
 */
export function parseCsvRecords(text: string): CsvRecord[] {
	const input = text.startsWith(BOM) ? text.slice(1) : text;

	const records: CsvRecord[] = [];
	let fields: string[] = [];
	let field = '';
	let inQuotes = false;
	let line = 1;
	let recordLine = 1;

	const endRecord = () => {
		fields.push(field);
		field = '';
		// A record of one empty field is a blank line, not a row of data.
		if (!(fields.length === 1 && fields[0] === '')) {
			records.push({ line: recordLine, fields });
		}
		fields = [];
	};

	let i = 0;
	while (i < input.length) {
		const ch = input[i];

		if (inQuotes) {
			if (ch === '"') {
				if (input[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			// A newline inside quotes is data, but it still advances the file's
			// line counter — otherwise every later record reports a line number
			// short by however many embedded newlines preceded it.
			if (ch === '\n') line++;
			field += ch;
			i++;
			continue;
		}

		if (ch === '"') {
			inQuotes = true;
			i++;
			continue;
		}
		if (ch === ',') {
			fields.push(field);
			field = '';
			i++;
			continue;
		}
		if (ch === '\r' || ch === '\n') {
			endRecord();
			// Consume CRLF as one terminator, not two.
			if (ch === '\r' && input[i + 1] === '\n') i++;
			i++;
			line++;
			recordLine = line;
			continue;
		}

		field += ch;
		i++;
	}

	// SECURITY / DATA LOSS: refuse the file rather than returning what a
	// half-open quote produces. Found in pre-landing review, verified: a single
	// unbalanced quote made the parser swallow every following line into ONE
	// field, so a 4-line file yielded 1 record with 1 field. Downstream that read
	// as `Email is required. ("")` on one line and "0 valid, 1 invalid" — a
	// wrong diagnosis for a file with three populated email cells, and 59 people
	// silently dropped from a 60-row spreadsheet with nothing to hint at it.
	//
	// `ROSTER_IMPORT_CAP` cannot catch this: the runaway quote is exactly what
	// makes the record count small.
	if (inQuotes) {
		throw new CsvFormatError(
			`Unterminated quote starting on line ${recordLine}. Every column boundary after it is ambiguous, so no rows were read. Balance the quotes and re-run.`,
		);
	}

	// The last record has no terminator unless the file ends with a newline, in
	// which case this is the empty record `endRecord` drops.
	endRecord();

	return records;
}

/**
 * Characters that force a field to be quoted.
 *
 * SECURITY: `\r` is in this set, and leaving it out is a field-escape hole, not
 * a cosmetic gap. `parseCsvRecords` above accepts a lone CR as a record
 * terminator (classic-Mac line endings), so an unquoted `\r` inside a value
 * ends the record — and everything after it becomes the FIRST FIELD of a new
 * row, which never passes through the formula-injection guard below. A
 * volunteer-controlled `displayName` of `Jane\r=cmd|…` therefore lands an
 * executable payload in the coordinator's spreadsheet. Verified before the fix:
 * the value round-tripped as TWO records with `=cmd|…` leading the second.
 *
 * This function pre-dates the roster export — it only ever checked `\n`, which
 * was survivable while nothing parsed a lone CR as a terminator and the only
 * consumer was the ESG report. Adding a CR-terminating parser is what made it
 * exploitable, so the two belong in one module with one test.
 */
const MUST_QUOTE = /[",\n\r]/;

/**
 * Leading characters a spreadsheet may treat as the start of a formula.
 *
 * Includes tab/CR/LF because Excel and Sheets trim leading whitespace before
 * deciding whether a cell is a formula, so `\t=SUM(A1)` still executes.
 */
const FORMULA_LEAD = /^[\t\r\n ]*[=+\-@]/;

/**
 * Escape one CSV field. Handles:
 * - commas, quotes, newlines, carriage returns → wrap in double quotes
 * - formula injection (`=`, `+`, `-`, `@`, incl. behind whitespace) → prefix `'`
 *
 * The formula-injection prefix is not cosmetic. Every value we export is
 * org-entered or volunteer-entered free text, and a display name of
 * `=HYPERLINK(...)` executes when the recipient opens the file in Excel or
 * Sheets.
 */
export function escapeCsvField(value: string): string {
	let out = value;

	// Neutralize formula injection: prefix dangerous leading chars with '.
	// Tested against FORMULA_LEAD, not `charAt(0)`, so a payload hidden behind a
	// leading tab or newline is caught too.
	if (FORMULA_LEAD.test(out)) {
		out = `'${out}`;
	}

	if (MUST_QUOTE.test(out)) {
		return `"${out.replace(/"/g, '""')}"`;
	}
	return out;
}

/** Render one row. Every field is escaped — there is no opt-out on purpose. */
export function toCsvLine(fields: readonly string[]): string {
	return fields.map(escapeCsvField).join(',');
}

/**
 * Undo `escapeCsvField`'s formula-injection prefix.
 *
 * Needed because our own export is an input to our own importer — the product
 * promise is that an org can get its roster back out, and "back out" is only
 * true if it can go back in. Without this, exporting and re-importing corrupted
 * every value the writer had defended: `@handle Jones` came back as
 * `'@handle Jones` and `+1 555 0100` as `'+1 555 0100`, which
 * `displayNameSchema` and `volunteerPhoneSchema` both accept, so the mangled
 * text was persisted silently. Every international phone number was affected.
 *
 * Unambiguous to invert: the writer adds at most ONE `'`, and only when
 * `FORMULA_LEAD` matches what follows. A value that genuinely begins with an
 * apostrophe is left alone unless the rest would have triggered the prefix.
 */
export function unescapeCsvField(value: string): string {
	if (!value.startsWith("'")) return value;
	const rest = value.slice(1);
	return FORMULA_LEAD.test(rest) ? rest : value;
}
