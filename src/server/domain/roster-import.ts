/**
 * Concierge roster import — parsing and validation (T17).
 *
 * Pure. Everything here runs before a single row is written, so `pnpm
 * import:roster --dry-run` can report exactly what the real run would attempt
 * without opening a transaction.
 *
 * The import writes through `addVolunteer()`, the same service the
 * `/app/volunteers` add form uses, so this module deliberately validates with
 * the SAME schemas (`displayNameSchema`, `volunteerEmailSchema`,
 * `volunteerPhoneSchema`). A row this module accepts and the service then
 * rejects would be a validation fork, and the failure would surface as an
 * unexplained mid-run error on row 31 of 60 — the exact failure §4 of the design
 * doc raised this task to prevent.
 */

import { CsvFormatError, parseCsvRecords, unescapeCsvField } from './csv';
import {
	displayNameSchema,
	normalizeEmail,
	volunteerEmailSchema,
	volunteerPhoneSchema,
} from './org-volunteer';

/**
 * Accepted spellings for each column, matched case- and space-insensitively.
 *
 * Wide on purpose: the input is whatever a shelter's volunteer coordinator
 * happens to have in Excel, and rejecting a file because its header reads
 * "Full Name" instead of "name" turns a five-minute concierge onboarding into
 * an email thread.
 */
const COLUMN_ALIASES = {
	displayName: ['name', 'displayname', 'display name', 'full name', 'fullname'],
	email: ['email', 'email address', 'emailaddress', 'e-mail'],
	phone: ['phone', 'phone number', 'phonenumber', 'mobile', 'cell'],
} as const;

export type RosterImportRow = {
	/** 1-indexed line in the source file, for an operator fixing the sheet. */
	line: number;
	displayName: string;
	/** Already canonical — `volunteerEmailSchema` transforms on parse. */
	email: string;
	phone: string | null;
};

export type RosterImportRowError = {
	line: number;
	message: string;
};

export type ParsedRosterCsv = {
	rows: RosterImportRow[];
	errors: RosterImportRowError[];
};

/** Thrown for problems with the FILE, as opposed to with a row in it. */
export class RosterCsvFormatError extends Error {}

/**
 * Refuse a file this large rather than importing it.
 *
 * Not a capacity limit — a real concierge roster is tens of rows. It is a
 * blast-radius bound: every unknown address mints a `User` + `VolunteerProfile`
 * that no bulk path can undo (`removeVolunteer` soft-deletes ONE `OrgVolunteer`
 * row and touches neither), so a mis-selected 50k-row export would leave 50k
 * shadow users on the platform permanently. Well above any honest spreadsheet.
 */
export const ROSTER_IMPORT_CAP = 5_000;

function normalizeHeader(value: string): string {
	return value.trim().toLowerCase().replace(/_/g, ' ');
}

/**
 * Names the spellings that WOULD have worked, derived from COLUMN_ALIASES.
 *
 * Without this the operator's next move after "No name column found" is to guess
 * or read the source — the accepted list lives in a constant they cannot see.
 */
function missingColumn(
	column: keyof typeof COLUMN_ALIASES,
	header: string[],
): string {
	return (
		`No "${column === 'displayName' ? 'name' : column}" column found. ` +
		`Header was: ${header.join(', ') || '(blank)'}. ` +
		`Accepted: ${COLUMN_ALIASES[column].join(', ')}.`
	);
}

function findColumn(
	header: string[],
	aliases: readonly string[],
): number | null {
	const index = header.findIndex((h) => aliases.includes(h));
	return index === -1 ? null : index;
}

/**
 * Parse a roster CSV into rows to add and rows to report.
 *
 * Never throws on a bad ROW — a single malformed address must not cost the
 * operator the other 59 rows. It throws only when the FILE cannot be
 * interpreted at all (no header, no email column), where continuing would mean
 * guessing which column holds what.
 *
 * Duplicate addresses within one file are reported as errors on the LATER row
 * rather than silently collapsed. Two rows for one person usually carry
 * different names or phone numbers, and picking one of them for the operator is
 * a decision this code has no basis to make.
 */
export function parseRosterCsv(text: string): ParsedRosterCsv {
	let records: ReturnType<typeof parseCsvRecords>;
	try {
		records = parseCsvRecords(text);
	} catch (err) {
		// Re-thrown as this module's error type so the script's existing
		// file-level handler reports it with the friendly path prefix rather than
		// crashing with a stack trace.
		if (err instanceof CsvFormatError) {
			throw new RosterCsvFormatError(err.message);
		}
		throw err;
	}

	const headerRecord = records[0];
	if (!headerRecord) {
		throw new RosterCsvFormatError('The file is empty.');
	}

	const header = headerRecord.fields.map(normalizeHeader);
	const emailIdx = findColumn(header, COLUMN_ALIASES.email);
	if (emailIdx === null) {
		throw new RosterCsvFormatError(missingColumn('email', header));
	}
	const nameIdx = findColumn(header, COLUMN_ALIASES.displayName);
	if (nameIdx === null) {
		throw new RosterCsvFormatError(missingColumn('displayName', header));
	}
	const phoneIdx = findColumn(header, COLUMN_ALIASES.phone);

	// Checked before any row is validated, so an accidentally huge file is
	// refused outright rather than reported row by row.
	const dataRecordCount = records.length - 1;
	if (dataRecordCount > ROSTER_IMPORT_CAP) {
		throw new RosterCsvFormatError(
			`This file has ${dataRecordCount} rows; the importer refuses more than ${ROSTER_IMPORT_CAP}. Split it, or check you selected the right export.`,
		);
	}

	const rows: RosterImportRow[] = [];
	const errors: RosterImportRowError[] = [];
	// Maps canonical email → the line that first claimed it, so the duplicate
	// message can name the row the operator should compare against.
	const seen = new Map<string, number>();

	for (const record of records.slice(1)) {
		const { line, fields } = record;

		// `unescapeCsvField` because our own export is a valid input here: the
		// writer prefixes `@`/`=`/`+`/`-`-leading values with `'` to stop a
		// spreadsheet executing them, and without undoing it a re-imported
		// `+1 555 0100` would persist as `'+1 555 0100`.
		const rawEmail = unescapeCsvField(fields[emailIdx] ?? '');
		const rawName = unescapeCsvField(fields[nameIdx] ?? '');
		const rawPhone = unescapeCsvField(
			phoneIdx === null ? '' : (fields[phoneIdx] ?? ''),
		);

		const email = volunteerEmailSchema.safeParse(rawEmail);
		if (!email.success) {
			errors.push({
				line,
				message: `${email.error.issues[0]?.message ?? 'Invalid email.'} (${JSON.stringify(rawEmail)})`,
			});
			continue;
		}

		const displayName = displayNameSchema.safeParse(rawName);
		if (!displayName.success) {
			errors.push({
				line,
				message: `${displayName.error.issues[0]?.message ?? 'Invalid name.'} (${JSON.stringify(rawName)})`,
			});
			continue;
		}

		// Empty means "not provided", not "an empty phone number" — the schema is
		// nullable and the service stores null.
		const phoneInput = rawPhone.trim() === '' ? null : rawPhone;
		const phone = volunteerPhoneSchema.safeParse(phoneInput);
		if (!phone.success) {
			errors.push({
				line,
				message: `${phone.error.issues[0]?.message ?? 'Invalid phone.'} (${JSON.stringify(rawPhone)})`,
			});
			continue;
		}

		// Compare on the canonical form, not the raw text: `A@x.com` and
		// `a@x.com` are one person to the database, so they must be one person
		// here too or the second row reaches `addVolunteer` and comes back as a
		// confusing "Already on your roster" for a roster the operator is
		// building right now.
		const key = normalizeEmail(email.data);
		const firstSeen = seen.get(key);
		if (firstSeen !== undefined) {
			errors.push({
				line,
				message: `Duplicate of line ${firstSeen} (${key}). Merge the two rows and re-run.`,
			});
			continue;
		}
		seen.set(key, line);

		rows.push({
			line,
			displayName: displayName.data,
			email: email.data,
			phone: phone.data ?? null,
		});
	}

	return { rows, errors };
}

/**
 * What happened to one row. `SKIPPED_ALREADY_ON_ROSTER` is not a failure —
 * re-running an import is a supported and expected thing to do, and the second
 * run reports every row that way.
 */
export type RosterImportOutcome =
	/** A new live roster row was created. */
	| 'ADDED'
	/** The person was already on this org's live roster. Idempotent no-op. */
	| 'SKIPPED_ALREADY_ON_ROSTER'
	/** The volunteer left this org and revoked its access. Not overridable. */
	| 'REFUSED_BY_VOLUNTEER'
	/** The row could not be parsed or validated. */
	| 'INVALID'
	/** Anything else — reported with the message, never swallowed. */
	| 'FAILED';

export type RosterImportResult = {
	line: number;
	email: string;
	outcome: RosterImportOutcome;
	/**
	 * Set for INVALID, FAILED and REFUSED_BY_VOLUNTEER; absent for ADDED and
	 * SKIPPED_ALREADY_ON_ROSTER.
	 */
	message?: string;
	/** True when a roster-added notification is owed to this address. */
	notify?: boolean;
};

export type RosterImportSummary = Record<RosterImportOutcome, number>;

export function summarize(results: readonly RosterImportResult[]) {
	const summary: RosterImportSummary = {
		ADDED: 0,
		SKIPPED_ALREADY_ON_ROSTER: 0,
		REFUSED_BY_VOLUNTEER: 0,
		INVALID: 0,
		FAILED: 0,
	};
	for (const r of results) summary[r.outcome]++;
	return summary;
}

/**
 * Exit code for the process.
 *
 * `FAILED` and `INVALID` are the only non-zero cases. A refusal is a correct
 * outcome the operator cannot and must not override — it is reported loudly but
 * it is not an error in the run.
 */
export function exitCodeFor(summary: RosterImportSummary): number {
	return summary.FAILED > 0 || summary.INVALID > 0 ? 1 : 0;
}
