/**
 * Case Study domain — pure types and template rendering functions.
 *
 * Data flow: caseStudyService → CaseStudyData → renderMarkdown / formatCaseStudyPdf
 */

import type {
	RetentionStats,
	TopVolunteerRow,
} from '@/server/repositories/orgAnalyticsRepo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaseStudyBaseline = {
	volunteerCount?: number;
	hoursPerWeek?: number;
	currentProcess?: string;
};

export type CaseStudyData = {
	orgId: string;
	orgSlug: string;
	orgName: string;
	logoUrl: string | null;
	createdAt: Date;
	daysOnPlatform: number;
	baseline: CaseStudyBaseline | null;
	summary: {
		totalVolunteers: number;
		backgroundChecksCompleted: number;
		shiftsCreated: number;
		credentialsIssued: number;
		applicationsSubmitted: number;
		applicationsApproved: number;
	};
	retention: RetentionStats | null;
	avgFillRate: number;
	topVolunteers: TopVolunteerRow[];
	pullQuote: string | null;
	consentToPublicize: boolean;
};

// ---------------------------------------------------------------------------
// Markdown template
// ---------------------------------------------------------------------------

export function renderMarkdown(data: CaseStudyData): string {
	const lines: string[] = [];

	lines.push(
		`# ${data.orgName} — ${data.daysOnPlatform} days with VolunteerReady`,
	);
	lines.push('');

	if (data.pullQuote) {
		lines.push(`> "${data.pullQuote}"`);
		lines.push(`> — ${data.orgName}`);
		lines.push('');
	}

	if (data.baseline) {
		lines.push('## Before VolunteerReady');
		lines.push('');
		if (data.baseline.volunteerCount != null) {
			lines.push(`- **Volunteers managed:** ${data.baseline.volunteerCount}`);
		}
		if (data.baseline.hoursPerWeek != null) {
			lines.push(`- **Admin hours/week:** ${data.baseline.hoursPerWeek}`);
		}
		if (data.baseline.currentProcess) {
			lines.push(`- **Process:** ${data.baseline.currentProcess}`);
		}
		lines.push('');
	}

	lines.push('## With VolunteerReady');
	lines.push('');
	lines.push(
		`- **Applications processed:** ${data.summary.applicationsSubmitted}`,
	);
	lines.push(`- **Volunteers approved:** ${data.summary.applicationsApproved}`);
	lines.push(
		`- **Background checks completed:** ${data.summary.backgroundChecksCompleted}`,
	);
	lines.push(`- **Shifts created:** ${data.summary.shiftsCreated}`);
	lines.push(`- **Credentials issued:** ${data.summary.credentialsIssued}`);
	lines.push('');

	if (data.retention) {
		const retentionPct =
			data.retention.activeVolunteers > 0
				? Math.round(
						(data.retention.returningVolunteers /
							data.retention.activeVolunteers) *
							100,
					)
				: 0;
		lines.push(`- **Volunteer retention:** ${retentionPct}%`);
	}

	if (data.avgFillRate > 0) {
		lines.push(`- **Average shift fill rate:** ${data.avgFillRate}%`);
	}

	if (data.baseline?.hoursPerWeek) {
		const savedHours = Math.max(
			0,
			Math.round(data.baseline.hoursPerWeek * 0.6),
		);
		lines.push(`- **Estimated hours saved/week:** ${savedHours}`);
	}

	lines.push('');
	lines.push('---');
	lines.push('');
	lines.push(
		'Ready to automate your volunteer management? [Get started with VolunteerReady](https://www.volunteerready.org/screening)',
	);
	lines.push('');

	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Affirmative consent parsing (shared between backfill + live submission)
// ---------------------------------------------------------------------------

const AFFIRMATIVE_STRINGS = new Set([
	'yes',
	'yep',
	'sure',
	'absolutely',
	'ok',
	'of course',
	'yeah',
	'y',
]);

export function isAffirmativeConsent(value: unknown): boolean {
	if (typeof value !== 'string') return false;
	return AFFIRMATIVE_STRINGS.has(value.trim().toLowerCase());
}
