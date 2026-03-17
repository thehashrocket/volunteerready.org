// ---------------------------------------------------------------------------
// ESG Report — pure domain logic (no framework imports)
// ---------------------------------------------------------------------------

import { z } from 'zod';

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
 * Escape a CSV field value. Handles:
 * - Commas, quotes, newlines → wrap in double quotes
 * - Formula injection (=, +, -, @) → prefix with single quote
 */
export function escapeCsvField(value: string): string {
	// Neutralize formula injection: prefix dangerous leading chars with '
	const first = value.charAt(0);
	if (first === '=' || first === '+' || first === '-' || first === '@') {
		value = `'${value}`;
	}

	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

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
