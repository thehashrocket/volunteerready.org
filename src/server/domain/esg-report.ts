// ---------------------------------------------------------------------------
// ESG Report — pure domain logic (no framework imports)
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { escapeCsvField } from './csv';

// ---- Types ----------------------------------------------------------------

export type ESGOrgRow = {
	orgId: string;
	orgName: string;
	employeeCount: number;
	shiftCount: number;
	totalHours: number;
	verifiedCredentialCount: number;
};

export type ESGReportSummary = {
	companyId: string;
	companyName: string;
	generatedAt: Date;
	dateRange: { from: Date | null; to: Date | null };
	totalEmployeesActive: number;
	totalOrgsSupported: number;
	totalShifts: number;
	totalHours: number;
	totalVerifiedCredentials: number;
	rows: ESGOrgRow[];
};

// ---- Date range normalization ----------------------------------------------

/**
 * Normalize an ESG report date range so a date-only `to` bound includes the
 * full end day.
 *
 * Date pickers and query params produce date-only values ('2026-01-31') that
 * coerce to UTC midnight; comparing `s."endTime" <= midnight` would exclude
 * nearly all of the chosen end day. A `to` at exactly UTC midnight is bumped
 * to 23:59:59.999 of the same UTC day. Explicit timestamps (any non-zero UTC
 * time component) pass through untouched.
 */
export function normalizeESGDateRange(range: {
	from?: Date | null;
	to?: Date | null;
}): { from: Date | null; to: Date | null } {
	const from = range.from ?? null;
	let to = range.to ?? null;

	const isUtcMidnight =
		to !== null &&
		to.getUTCHours() === 0 &&
		to.getUTCMinutes() === 0 &&
		to.getUTCSeconds() === 0 &&
		to.getUTCMilliseconds() === 0;

	if (to && isUtcMidnight) {
		to = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
	}

	return { from, to };
}

// ---- Computation ----------------------------------------------------------

/**
 * Compute ESG summary totals from per-org rows.
 * `distinctEmployeeCount` is the cross-org deduplicated count from a separate
 * SQL query — per-org employeeCount may double-count employees at multiple orgs.
 */
export function computeESGSummary(
	rows: readonly ESGOrgRow[],
	distinctEmployeeCount: number,
): Pick<
	ESGReportSummary,
	| 'totalEmployeesActive'
	| 'totalOrgsSupported'
	| 'totalShifts'
	| 'totalHours'
	| 'totalVerifiedCredentials'
> {
	let totalShifts = 0;
	let totalHours = 0;
	let totalVerifiedCredentials = 0;

	for (const row of rows) {
		totalShifts += row.shiftCount;
		totalHours += row.totalHours;
		totalVerifiedCredentials += row.verifiedCredentialCount;
	}

	return {
		totalEmployeesActive: distinctEmployeeCount,
		totalOrgsSupported: rows.length,
		totalShifts,
		totalHours: Math.round(totalHours * 100) / 100,
		totalVerifiedCredentials,
	};
}

// ---- CSV formatting -------------------------------------------------------

const CSV_HEADERS = [
	'Organization',
	'Organization ID',
	'Employees Active',
	'Shifts Completed',
	'Total Hours',
	'Verified Credentials',
];

/**
 * Re-exported so this module's existing callers and tests are unchanged.
 *
 * The definition moved to `domain/csv.ts` when the roster export (T19) became
 * its second consumer — two copies of a formula-injection guard is exactly the
 * shape where one of them quietly stops being maintained.
 */
export { escapeCsvField };

export function formatESGCsv(summary: ESGReportSummary): string {
	const lines: string[] = [];

	// Header comment
	lines.push(
		`# ESG Volunteer Impact Report — ${escapeCsvField(summary.companyName)}`,
	);
	lines.push(`# Generated: ${summary.generatedAt.toISOString()}`);
	if (summary.dateRange.from || summary.dateRange.to) {
		const from = summary.dateRange.from?.toISOString().split('T')[0] ?? 'all';
		const to = summary.dateRange.to?.toISOString().split('T')[0] ?? 'present';
		lines.push(`# Date range: ${from} to ${to}`);
	}
	lines.push('');

	// Summary row
	lines.push(
		`# Summary: ${summary.totalEmployeesActive} employees, ${summary.totalOrgsSupported} orgs, ${summary.totalShifts} shifts, ${summary.totalHours} hours, ${summary.totalVerifiedCredentials} credentials`,
	);
	lines.push('');

	// Column headers
	lines.push(CSV_HEADERS.join(','));

	// Data rows
	for (const row of summary.rows) {
		lines.push(
			[
				escapeCsvField(row.orgName),
				row.orgId,
				String(row.employeeCount),
				String(row.shiftCount),
				String(Math.round(row.totalHours * 100) / 100),
				String(row.verifiedCredentialCount),
			].join(','),
		);
	}

	// Totals row
	lines.push(
		[
			'TOTAL',
			'',
			String(summary.totalEmployeesActive),
			String(summary.totalShifts),
			String(summary.totalHours),
			String(summary.totalVerifiedCredentials),
		].join(','),
	);

	return lines.join('\n');
}

// ---- Zod schemas ----------------------------------------------------------

export const esgReportInputSchema = z
	.object({
		from: z.coerce.date().nullish(),
		to: z.coerce.date().nullish(),
	})
	.refine(
		(data) => {
			if (data.from && data.to) {
				return data.from <= data.to;
			}
			return true;
		},
		{ message: 'Start date must be before or equal to end date' },
	);

export type ESGReportInput = z.infer<typeof esgReportInputSchema>;
