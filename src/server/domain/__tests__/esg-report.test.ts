import { describe, expect, it } from 'vitest';
import {
	computeESGSummary,
	type ESGOrgRow,
	type ESGReportSummary,
	escapeCsvField,
	esgReportInputSchema,
	formatESGCsv,
	normalizeESGDateRange,
} from '../esg-report';

// ---------------------------------------------------------------------------
// computeESGSummary
// ---------------------------------------------------------------------------

describe('computeESGSummary', () => {
	const makeRow = (overrides: Partial<ESGOrgRow> = {}): ESGOrgRow => ({
		orgId: 'org-1',
		orgName: 'Helpers Inc',
		employeeCount: 5,
		shiftCount: 10,
		totalHours: 25.5,
		verifiedCredentialCount: 3,
		...overrides,
	});

	it('computes totals from multiple rows', () => {
		const rows = [
			makeRow({ shiftCount: 10, totalHours: 25.5, verifiedCredentialCount: 3 }),
			makeRow({
				orgId: 'org-2',
				orgName: 'Care Org',
				shiftCount: 5,
				totalHours: 12.25,
				verifiedCredentialCount: 1,
			}),
		];

		const result = computeESGSummary(rows, 8);

		expect(result).toEqual({
			totalEmployeesActive: 8,
			totalOrgsSupported: 2,
			totalShifts: 15,
			totalHours: 37.75,
			totalVerifiedCredentials: 4,
		});
	});

	it('returns zeros for empty rows', () => {
		const result = computeESGSummary([], 0);

		expect(result).toEqual({
			totalEmployeesActive: 0,
			totalOrgsSupported: 0,
			totalShifts: 0,
			totalHours: 0,
			totalVerifiedCredentials: 0,
		});
	});

	it('uses distinctEmployeeCount instead of summing row counts', () => {
		const rows = [
			makeRow({ employeeCount: 10 }),
			makeRow({ orgId: 'org-2', employeeCount: 10 }),
		];

		// distinctEmployeeCount is 12 (not 20 from summing row.employeeCount)
		const result = computeESGSummary(rows, 12);
		expect(result.totalEmployeesActive).toBe(12);
	});

	it('rounds totalHours to 2 decimal places', () => {
		const rows = [
			makeRow({ totalHours: 1.005 }),
			makeRow({ orgId: 'org-2', totalHours: 2.005 }),
		];

		const result = computeESGSummary(rows, 1);
		expect(result.totalHours).toBe(3.01);
	});
});

// ---------------------------------------------------------------------------
// escapeCsvField
// ---------------------------------------------------------------------------

describe('escapeCsvField', () => {
	it('returns plain text unchanged', () => {
		expect(escapeCsvField('Hello World')).toBe('Hello World');
	});

	it('wraps field containing comma in double quotes', () => {
		expect(escapeCsvField('foo,bar')).toBe('"foo,bar"');
	});

	it('wraps field containing double quote and escapes it', () => {
		expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
	});

	it('wraps field containing newline', () => {
		expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
	});

	it('prefixes = with single quote to prevent formula injection', () => {
		expect(escapeCsvField('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
	});

	it('prefixes + with single quote', () => {
		expect(escapeCsvField('+1234')).toBe("'+1234");
	});

	it('prefixes - with single quote', () => {
		expect(escapeCsvField('-1234')).toBe("'-1234");
	});

	it('prefixes @ with single quote', () => {
		expect(escapeCsvField('@SUM')).toBe("'@SUM");
	});

	it('handles formula char + comma (both defenses)', () => {
		// = gets prefixed, then comma triggers quoting
		expect(escapeCsvField('=CMD(),foo')).toBe('"\'=CMD(),foo"');
	});
});

// ---------------------------------------------------------------------------
// formatESGCsv
// ---------------------------------------------------------------------------

describe('formatESGCsv', () => {
	const makeSummary = (
		overrides: Partial<ESGReportSummary> = {},
	): ESGReportSummary => ({
		companyId: 'comp-1',
		companyName: 'Acme Corp',
		generatedAt: new Date('2026-01-15T12:00:00Z'),
		dateRange: { from: new Date('2026-01-01'), to: new Date('2026-01-31') },
		totalEmployeesActive: 10,
		totalOrgsSupported: 2,
		totalShifts: 20,
		totalHours: 50,
		totalVerifiedCredentials: 5,
		rows: [
			{
				orgId: 'org-1',
				orgName: 'Helpers Inc',
				employeeCount: 6,
				shiftCount: 12,
				totalHours: 30,
				verifiedCredentialCount: 3,
			},
			{
				orgId: 'org-2',
				orgName: 'Care Org',
				employeeCount: 4,
				shiftCount: 8,
				totalHours: 20,
				verifiedCredentialCount: 2,
			},
		],
		...overrides,
	});

	it('produces CSV with headers and data rows', () => {
		const csv = formatESGCsv(makeSummary());
		const lines = csv.split('\n');

		// Check header comment
		expect(lines[0]).toContain('ESG Volunteer Impact Report');
		expect(lines[0]).toContain('Acme Corp');

		// Find column headers line
		const headerLine = lines.find((l) => l.startsWith('Organization,'));
		expect(headerLine).toBe(
			'Organization,Organization ID,Employees Active,Shifts Completed,Total Hours,Verified Credentials',
		);

		// Data rows
		expect(csv).toContain('Helpers Inc,org-1,6,12,30,3');
		expect(csv).toContain('Care Org,org-2,4,8,20,2');

		// Totals row
		expect(csv).toContain('TOTAL,,10,20,50,5');
	});

	it('handles empty report (no rows)', () => {
		const csv = formatESGCsv(
			makeSummary({
				totalEmployeesActive: 0,
				totalOrgsSupported: 0,
				totalShifts: 0,
				totalHours: 0,
				totalVerifiedCredentials: 0,
				rows: [],
			}),
		);

		expect(csv).toContain('TOTAL,,0,0,0,0');
	});

	it('neutralizes formula injection in org names', () => {
		const csv = formatESGCsv(
			makeSummary({
				rows: [
					{
						orgId: 'org-x',
						orgName: '=SUM(A1:A10)',
						employeeCount: 1,
						shiftCount: 1,
						totalHours: 1,
						verifiedCredentialCount: 0,
					},
				],
			}),
		);

		// The org name should be prefixed with ' to neutralize the formula
		expect(csv).toContain("'=SUM(A1:A10)");
		// Must NOT contain unescaped =SUM at the start of a field
		expect(csv).not.toMatch(/^=SUM/m);
	});
});

// ---------------------------------------------------------------------------
// esgReportInputSchema
// ---------------------------------------------------------------------------

describe('esgReportInputSchema', () => {
	it('accepts empty input (no dates)', () => {
		const result = esgReportInputSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it('accepts valid date range', () => {
		const result = esgReportInputSchema.safeParse({
			from: '2026-01-01',
			to: '2026-01-31',
		});
		expect(result.success).toBe(true);
	});

	it('accepts from-only', () => {
		const result = esgReportInputSchema.safeParse({ from: '2026-01-01' });
		expect(result.success).toBe(true);
	});

	it('accepts to-only', () => {
		const result = esgReportInputSchema.safeParse({ to: '2026-01-31' });
		expect(result.success).toBe(true);
	});

	it('rejects from > to', () => {
		const result = esgReportInputSchema.safeParse({
			from: '2026-02-01',
			to: '2026-01-01',
		});
		expect(result.success).toBe(false);
	});

	it('accepts from === to (same day)', () => {
		const result = esgReportInputSchema.safeParse({
			from: '2026-01-15',
			to: '2026-01-15',
		});
		expect(result.success).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// normalizeESGDateRange
// ---------------------------------------------------------------------------

describe('normalizeESGDateRange', () => {
	it('bumps a date-only `to` (UTC midnight) to end of that UTC day', () => {
		const { to } = normalizeESGDateRange({
			to: new Date('2026-01-31T00:00:00.000Z'),
		});
		expect(to?.toISOString()).toBe('2026-01-31T23:59:59.999Z');
	});

	it('leaves an explicit `to` timestamp untouched', () => {
		const explicit = new Date('2026-01-31T14:30:00.000Z');
		const { to } = normalizeESGDateRange({ to: explicit });
		expect(to?.toISOString()).toBe('2026-01-31T14:30:00.000Z');
	});

	it('never modifies `from` (a date-only from means start of day, which is correct)', () => {
		const { from } = normalizeESGDateRange({
			from: new Date('2026-01-01T00:00:00.000Z'),
		});
		expect(from?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
	});

	it('maps missing bounds to null', () => {
		expect(normalizeESGDateRange({})).toEqual({ from: null, to: null });
		expect(normalizeESGDateRange({ from: undefined, to: null })).toEqual({
			from: null,
			to: null,
		});
	});

	it('same-day range covers the full day after normalization', () => {
		const day = new Date('2026-01-15T00:00:00.000Z');
		const { from, to } = normalizeESGDateRange({ from: day, to: day });
		expect(from?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
		expect(to?.toISOString()).toBe('2026-01-15T23:59:59.999Z');
	});
});
