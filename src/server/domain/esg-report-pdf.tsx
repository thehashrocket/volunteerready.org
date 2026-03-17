// ---------------------------------------------------------------------------
// ESG Report — PDF rendering (presentation layer only)
//
// Data flow:
//   ESGReportSummary → <ESGReportDocument /> → renderToBuffer → Buffer
//
// Colors from DESIGN.md:
//   Primary:     #1B3C2A  (header bar, table header)
//   Sand light:  #E8DCC8  (stat boxes, totals row)
//   Neutral 50:  #FAFAF8  (alternating rows)
//   Neutral 800: #252422  (body text)
//   Neutral 500: #787571  (footer, muted labels)
// ---------------------------------------------------------------------------

import path from 'node:path';
import {
	Document,
	Font,
	Page,
	renderToBuffer,
	StyleSheet,
	Text,
	View,
} from '@react-pdf/renderer';
import type { ESGReportSummary } from './esg-report';

// ---- Fonts ----------------------------------------------------------------

const fontsDir = path.join(process.cwd(), 'public', 'fonts');

Font.register({
	family: 'Fraunces',
	src: path.join(fontsDir, 'fraunces-bold.ttf'),
	fontWeight: 'bold',
});

Font.register({
	family: 'Geist',
	fonts: [
		{ src: path.join(fontsDir, 'geist-regular.ttf'), fontWeight: 'normal' },
		{
			src: path.join(fontsDir, 'geist-semibold.ttf'),
			fontWeight: 'semibold',
		},
		{ src: path.join(fontsDir, 'geist-bold.ttf'), fontWeight: 'bold' },
	],
});

// ---- Colors ---------------------------------------------------------------

const C = {
	primary: '#1B3C2A',
	sandLight: '#E8DCC8',
	neutral50: '#FAFAF8',
	neutral200: '#E8E6E1',
	neutral500: '#787571',
	neutral800: '#252422',
	white: '#FFFFFF',
} as const;

// ---- Styles ---------------------------------------------------------------

const s = StyleSheet.create({
	page: {
		fontFamily: 'Geist',
		fontSize: 10,
		color: C.neutral800,
		paddingTop: 0,
		paddingBottom: 48,
		paddingHorizontal: 0,
	},

	// Header bar
	header: {
		backgroundColor: C.primary,
		paddingVertical: 24,
		paddingHorizontal: 40,
	},
	headerTitle: {
		fontFamily: 'Fraunces',
		fontSize: 22,
		fontWeight: 'bold',
		color: C.white,
	},
	headerSub: {
		fontSize: 10,
		color: C.sandLight,
		marginTop: 4,
	},

	// Summary stat boxes
	summaryRow: {
		flexDirection: 'row',
		gap: 12,
		paddingHorizontal: 40,
		paddingVertical: 20,
	},
	statBox: {
		flex: 1,
		backgroundColor: C.sandLight,
		borderRadius: 6,
		paddingVertical: 12,
		paddingHorizontal: 10,
		alignItems: 'center',
	},
	statValue: {
		fontSize: 20,
		fontWeight: 'bold',
		color: C.primary,
	},
	statLabel: {
		fontSize: 8,
		fontWeight: 'semibold',
		color: C.neutral500,
		marginTop: 4,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},

	// Table
	tableContainer: {
		paddingHorizontal: 40,
		marginTop: 8,
	},
	tableHeaderRow: {
		flexDirection: 'row',
		backgroundColor: C.primary,
		borderTopLeftRadius: 4,
		borderTopRightRadius: 4,
		paddingVertical: 8,
		paddingHorizontal: 8,
	},
	tableRow: {
		flexDirection: 'row',
		paddingVertical: 7,
		paddingHorizontal: 8,
		borderBottomWidth: 1,
		borderBottomColor: C.neutral200,
	},
	tableRowAlt: {
		backgroundColor: C.neutral50,
	},
	tableTotalsRow: {
		flexDirection: 'row',
		backgroundColor: C.sandLight,
		paddingVertical: 8,
		paddingHorizontal: 8,
		borderBottomLeftRadius: 4,
		borderBottomRightRadius: 4,
	},
	thText: {
		fontSize: 8,
		fontWeight: 'bold',
		color: C.white,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	tdText: {
		fontSize: 9,
	},
	tdBold: {
		fontSize: 9,
		fontWeight: 'bold',
	},
	colOrg: { width: '35%' },
	colNum: { width: '16.25%', textAlign: 'right' },

	// Footer
	footer: {
		position: 'absolute',
		bottom: 20,
		left: 40,
		right: 40,
		flexDirection: 'row',
		justifyContent: 'space-between',
		fontSize: 7,
		color: C.neutral500,
	},
});

// ---- Helpers --------------------------------------------------------------

function fmtDate(d: Date | null): string {
	if (!d) return 'All time';
	return d.toISOString().split('T')[0] ?? '';
}

function fmtHours(h: number): string {
	return (Math.round(h * 100) / 100).toLocaleString('en-US', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});
}

// ---- Document -------------------------------------------------------------

function ESGReportDocument({ summary }: { summary: ESGReportSummary }) {
	const dateLabel =
		summary.dateRange.from || summary.dateRange.to
			? `${fmtDate(summary.dateRange.from)} — ${fmtDate(summary.dateRange.to)}`
			: 'All time';

	const stats = [
		{ value: summary.totalEmployeesActive, label: 'Employees' },
		{ value: summary.totalOrgsSupported, label: 'Organizations' },
		{ value: summary.totalShifts, label: 'Shifts' },
		{ value: fmtHours(summary.totalHours), label: 'Hours' },
		{ value: summary.totalVerifiedCredentials, label: 'Credentials' },
	];

	return (
		<Document
			title={`ESG Report — ${summary.companyName}`}
			author="VolunteerReady"
		>
			<Page size="A4" style={s.page}>
				{/* Header */}
				<View style={s.header}>
					<Text style={s.headerTitle}>ESG Volunteer Impact Report</Text>
					<Text style={s.headerSub}>
						{summary.companyName} | {dateLabel} | Generated{' '}
						{summary.generatedAt.toISOString().split('T')[0]}
					</Text>
				</View>

				{/* Summary stats */}
				<View style={s.summaryRow}>
					{stats.map((st) => (
						<View key={st.label} style={s.statBox}>
							<Text style={s.statValue}>{st.value}</Text>
							<Text style={s.statLabel}>{st.label}</Text>
						</View>
					))}
				</View>

				{/* Organization breakdown table */}
				<View style={s.tableContainer}>
					{/* Header row */}
					<View style={s.tableHeaderRow}>
						<Text style={[s.thText, s.colOrg]}>Organization</Text>
						<Text style={[s.thText, s.colNum]}>Employees</Text>
						<Text style={[s.thText, s.colNum]}>Shifts</Text>
						<Text style={[s.thText, s.colNum]}>Hours</Text>
						<Text style={[s.thText, s.colNum]}>Credentials</Text>
					</View>

					{/* Data rows */}
					{summary.rows.map((row, i) => (
						<View
							key={row.orgId}
							style={i % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow}
						>
							<Text style={[s.tdText, s.colOrg]}>{row.orgName}</Text>
							<Text style={[s.tdText, s.colNum]}>{row.employeeCount}</Text>
							<Text style={[s.tdText, s.colNum]}>{row.shiftCount}</Text>
							<Text style={[s.tdText, s.colNum]}>
								{fmtHours(row.totalHours)}
							</Text>
							<Text style={[s.tdText, s.colNum]}>
								{row.verifiedCredentialCount}
							</Text>
						</View>
					))}

					{/* Totals row */}
					<View style={s.tableTotalsRow}>
						<Text style={[s.tdBold, s.colOrg]}>Total</Text>
						<Text style={[s.tdBold, s.colNum]}>
							{summary.totalEmployeesActive}
						</Text>
						<Text style={[s.tdBold, s.colNum]}>{summary.totalShifts}</Text>
						<Text style={[s.tdBold, s.colNum]}>
							{fmtHours(summary.totalHours)}
						</Text>
						<Text style={[s.tdBold, s.colNum]}>
							{summary.totalVerifiedCredentials}
						</Text>
					</View>

					{/* Empty state */}
					{summary.rows.length === 0 && (
						<View
							style={{
								paddingVertical: 24,
								alignItems: 'center',
							}}
						>
							<Text style={{ color: C.neutral500, fontSize: 10 }}>
								No volunteer activity recorded for this period.
							</Text>
						</View>
					)}
				</View>

				{/* Footer */}
				<View style={s.footer} fixed>
					<Text>VolunteerReady | Confidential</Text>
					<Text
						render={({ pageNumber, totalPages }) =>
							`Page ${pageNumber} of ${totalPages}`
						}
					/>
				</View>
			</Page>
		</Document>
	);
}

// ---- Public API -----------------------------------------------------------

/**
 * Render ESG report summary to a PDF buffer.
 * Pure presentation — data in, PDF buffer out.
 */
export async function formatESGPdf(summary: ESGReportSummary): Promise<Buffer> {
	const buf = await renderToBuffer(<ESGReportDocument summary={summary} />);
	return Buffer.from(buf);
}
