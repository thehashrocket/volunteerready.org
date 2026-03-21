/**
 * Case Study PDF rendering — presentation layer only.
 *
 * Reuses the ESG report pattern: React PDF components → renderToBuffer.
 * Colors from DESIGN.md.
 */

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
import type { CaseStudyData } from './case-study';

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
		{ src: path.join(fontsDir, 'geist-semibold.ttf'), fontWeight: 'semibold' },
		{ src: path.join(fontsDir, 'geist-bold.ttf'), fontWeight: 'bold' },
	],
});

// ---- Colors ---------------------------------------------------------------

const C = {
	primary: '#1B3C2A',
	sand: '#C4A882',
	sandLight: '#E8DCC8',
	neutral50: '#FAFAF8',
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
		paddingBottom: 48,
	},
	header: {
		backgroundColor: C.primary,
		paddingVertical: 28,
		paddingHorizontal: 40,
	},
	headerTitle: {
		fontFamily: 'Fraunces',
		fontSize: 24,
		fontWeight: 'bold',
		color: C.white,
	},
	headerSub: {
		fontSize: 11,
		color: C.sandLight,
		marginTop: 6,
	},
	section: {
		paddingHorizontal: 40,
		paddingVertical: 16,
	},
	sectionAlt: {
		paddingHorizontal: 40,
		paddingVertical: 16,
		backgroundColor: C.neutral50,
	},
	sectionTitle: {
		fontFamily: 'Geist',
		fontSize: 8,
		fontWeight: 'semibold',
		color: C.neutral500,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 8,
	},
	quote: {
		borderLeftWidth: 4,
		borderLeftColor: C.sand,
		paddingLeft: 12,
		marginVertical: 12,
	},
	quoteText: {
		fontSize: 12,
		fontStyle: 'italic',
		color: C.neutral800,
		lineHeight: 1.5,
	},
	metricsRow: {
		flexDirection: 'row',
		gap: 12,
		marginTop: 4,
	},
	metricBox: {
		flex: 1,
		backgroundColor: C.sandLight,
		borderRadius: 6,
		paddingVertical: 10,
		paddingHorizontal: 10,
		alignItems: 'center',
	},
	metricValue: {
		fontFamily: 'Fraunces',
		fontSize: 20,
		fontWeight: 'bold',
		color: C.primary,
	},
	metricLabel: {
		fontSize: 7,
		fontWeight: 'semibold',
		color: C.neutral500,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginTop: 3,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 4,
		borderBottomWidth: 1,
		borderBottomColor: '#E8E6E1',
	},
	label: { fontSize: 10 },
	value: { fontSize: 10, fontWeight: 'bold' },
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
	cta: {
		marginTop: 20,
		paddingVertical: 14,
		backgroundColor: C.primary,
		borderRadius: 8,
		alignItems: 'center',
	},
	ctaText: {
		fontSize: 12,
		fontWeight: 'bold',
		color: C.white,
	},
});

// ---- Document -------------------------------------------------------------

function CaseStudyDocument({ data }: { data: CaseStudyData }) {
	const savedHours = data.baseline?.hoursPerWeek
		? Math.max(0, Math.round(data.baseline.hoursPerWeek * 0.6))
		: null;

	const retentionPct =
		data.retention && data.retention.activeVolunteers > 0
			? Math.round(
					(data.retention.returningVolunteers /
						data.retention.activeVolunteers) *
						100,
				)
			: null;

	return (
		<Document title={`Case Study — ${data.orgName}`} author="VolunteerReady">
			<Page size="A4" style={s.page}>
				{/* Header */}
				<View style={s.header}>
					<Text style={s.headerTitle}>{data.orgName}</Text>
					<Text style={s.headerSub}>
						{data.daysOnPlatform} days with VolunteerReady | Generated{' '}
						{new Date().toISOString().split('T')[0]}
					</Text>
				</View>

				{/* Pull quote */}
				{data.pullQuote && (
					<View style={s.section}>
						<View style={s.quote}>
							<Text style={s.quoteText}>"{data.pullQuote}"</Text>
						</View>
					</View>
				)}

				{/* Before/After */}
				{data.baseline && (
					<View style={s.sectionAlt}>
						<Text style={s.sectionTitle}>Before VolunteerReady</Text>
						{data.baseline.volunteerCount != null && (
							<View style={s.row}>
								<Text style={s.label}>Volunteers managed</Text>
								<Text style={s.value}>{data.baseline.volunteerCount}</Text>
							</View>
						)}
						{data.baseline.hoursPerWeek != null && (
							<View style={s.row}>
								<Text style={s.label}>Admin hours/week</Text>
								<Text style={s.value}>{data.baseline.hoursPerWeek}</Text>
							</View>
						)}
						{data.baseline.currentProcess && (
							<View style={s.row}>
								<Text style={s.label}>Process</Text>
								<Text style={s.value}>{data.baseline.currentProcess}</Text>
							</View>
						)}
					</View>
				)}

				{/* Platform metrics */}
				<View style={s.section}>
					<Text style={s.sectionTitle}>With VolunteerReady</Text>
					<View style={s.metricsRow}>
						<View style={s.metricBox}>
							<Text style={s.metricValue}>
								{data.summary.applicationsSubmitted}
							</Text>
							<Text style={s.metricLabel}>Applications</Text>
						</View>
						<View style={s.metricBox}>
							<Text style={s.metricValue}>
								{data.summary.applicationsApproved}
							</Text>
							<Text style={s.metricLabel}>Approved</Text>
						</View>
						<View style={s.metricBox}>
							<Text style={s.metricValue}>
								{data.summary.backgroundChecksCompleted}
							</Text>
							<Text style={s.metricLabel}>BG Checks</Text>
						</View>
						<View style={s.metricBox}>
							<Text style={s.metricValue}>
								{data.summary.credentialsIssued}
							</Text>
							<Text style={s.metricLabel}>Credentials</Text>
						</View>
					</View>
				</View>

				{/* Additional metrics */}
				<View style={s.sectionAlt}>
					<View style={s.metricsRow}>
						{savedHours !== null && (
							<View style={s.metricBox}>
								<Text style={s.metricValue}>{savedHours}</Text>
								<Text style={s.metricLabel}>Hrs Saved/Week</Text>
							</View>
						)}
						{data.avgFillRate > 0 && (
							<View style={s.metricBox}>
								<Text style={s.metricValue}>{data.avgFillRate}%</Text>
								<Text style={s.metricLabel}>Fill Rate</Text>
							</View>
						)}
						{retentionPct !== null && (
							<View style={s.metricBox}>
								<Text style={s.metricValue}>{retentionPct}%</Text>
								<Text style={s.metricLabel}>Retention</Text>
							</View>
						)}
					</View>
				</View>

				{/* CTA */}
				<View style={[s.section, { marginTop: 8 }]}>
					<View style={s.cta}>
						<Text style={s.ctaText}>
							Ready to automate your volunteer management?
						</Text>
					</View>
					<Text
						style={{
							textAlign: 'center',
							fontSize: 9,
							color: C.neutral500,
							marginTop: 6,
						}}
					>
						volunteerready.org/screening
					</Text>
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

export async function formatCaseStudyPdf(data: CaseStudyData): Promise<Buffer> {
	const buf = await renderToBuffer(<CaseStudyDocument data={data} />);
	return Buffer.from(buf);
}
