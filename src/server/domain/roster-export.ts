/**
 * Roster CSV export (T19) — column contract and row rendering. Pure.
 *
 * The export is available on every plan, FREE included. That is a product
 * decision, not an oversight: "send us your spreadsheet" only works as an offer
 * if the answer to "can I get it back out?" is yes without a card. An org that
 * cannot leave has not chosen to stay.
 */

import type {
	AccountState,
	OrgVolunteerSource,
} from '@/prisma/generated/client';
import { toCsvLine } from './csv';
import { ORG_VOLUNTEER_SOURCE_COPY } from './org-volunteer';

/**
 * Hard ceiling on exported rows.
 *
 * The response streams, so this is not a memory bound — it is a bound on how
 * long one request may hold a database connection paging the roster. No org is
 * near it (the largest roster in the product is three orders of magnitude
 * smaller), and a run that hits it says so in the file rather than silently
 * returning a prefix.
 */
export const ROSTER_EXPORT_CAP = 10_000;

/** Rows fetched per page while streaming. */
export const ROSTER_EXPORT_BATCH = 500;

export const ROSTER_EXPORT_HEADERS = [
	'Name',
	'Email',
	'Phone',
	'Status',
	'How they joined',
	'Added',
	'Shifts attended',
] as const;

/**
 * Volunteer-account status, in the words the roster page uses.
 *
 * A `Record` over the enum for the same reason `ORG_VOLUNTEER_SOURCE_COPY` is:
 * a new `AccountState` must be a type error here, not a blank cell in a file an
 * org is about to make decisions from.
 */
export const ACCOUNT_STATE_EXPORT_COPY: Record<AccountState, string> = {
	UNCLAIMED: 'Invited — has not signed in',
	ACTIVE: 'Active',
};

export type RosterExportRow = {
	displayName: string;
	email: string | null;
	phone: string | null;
	accountState: AccountState;
	source: OrgVolunteerSource;
	createdAt: Date;
	attendedShifts: number;
};

export function formatRosterHeader(): string {
	return toCsvLine([...ROSTER_EXPORT_HEADERS]);
}

export function formatRosterRow(row: RosterExportRow): string {
	return toCsvLine([
		row.displayName,
		// A roster row always has a user, but `User.email` is nullable in the
		// schema. Blank beats the string "null" in a spreadsheet cell.
		row.email ?? '',
		row.phone ?? '',
		ACCOUNT_STATE_EXPORT_COPY[row.accountState],
		ORG_VOLUNTEER_SOURCE_COPY[row.source],
		// Date only. The time a coordinator added someone is noise in a
		// spreadsheet, and an ISO timestamp is what Excel mangles into a serial.
		row.createdAt.toISOString().slice(0, 10),
		String(row.attendedShifts),
	]);
}

/**
 * Trailing note when the cap was reached.
 *
 * A row rather than a header, because the response has already started streaming
 * by the time we know — the alternative is a truncated file that looks complete.
 *
 * PADDED to the full column count. A one-field row in a seven-column file makes
 * a strict parser either error on the width mismatch or, more often, yield a
 * final record whose `Name` is the notice and whose other six columns are empty
 * — a phantom volunteer in the org's spreadsheet.
 */
export function formatTruncationNotice(): string {
	return padToWidth(
		`# Truncated at ${ROSTER_EXPORT_CAP} rows. Contact support@volunteerready.org for the full roster.`,
	);
}

/**
 * Terminal row when the export failed part-way through.
 *
 * The response is already committed as a 200 with headers flushed by the time a
 * page read can fail, so there is no status code left to signal with. Without
 * this marker a mid-stream failure yields a well-formed CSV prefix that looks
 * complete — the same failure mode `formatTruncationNotice` exists to prevent,
 * for the error case instead of the cap case.
 */
export function formatFailureNotice(rowsEmitted: number): string {
	return padToWidth(
		`# EXPORT FAILED after ${rowsEmitted} rows. This file is INCOMPLETE — do not use it. Retry, or contact support@volunteerready.org.`,
	);
}

/** One row carrying `text` in the first column and blanks in the rest. */
function padToWidth(text: string): string {
	const fields = [text, ...ROSTER_EXPORT_HEADERS.slice(1).map(() => '')];
	return toCsvLine(fields);
}

/** `roster-<slug>-<yyyy-mm-dd>.csv` */
export function rosterExportFilename(slug: string, now: Date): string {
	return `roster-${slug}-${now.toISOString().slice(0, 10)}.csv`;
}
