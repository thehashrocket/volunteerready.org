/**
 * Pure domain function for computing org health score.
 *
 * Health Score (0-100):
 *   Screener questions configured  → 25 pts
 *   Opportunities published        → 25 pts
 *   Shifts with signups            → 25 pts
 *   Credentials issued             → 25 pts
 *
 * Tip priority follows natural onboarding sequence:
 *   screener → opportunity → shift signup → credential
 */

export interface OrgHealthInput {
	screenerQuestionCount: number;
	publishedOpportunityCount: number;
	shiftsWithSignupsCount: number;
	credentialsIssuedCount: number;
}

export interface OrgHealthResult {
	score: number;
	tip: string | null;
}

const METRICS: {
	key: keyof OrgHealthInput;
	points: number;
	tip: string;
	nextScore: (current: number) => number;
}[] = [
	{
		key: 'screenerQuestionCount',
		points: 25,
		tip: 'Add a screener question to reach',
		nextScore: (c) => c + 25,
	},
	{
		key: 'publishedOpportunityCount',
		points: 25,
		tip: 'Publish an opportunity to reach',
		nextScore: (c) => c + 25,
	},
	{
		key: 'shiftsWithSignupsCount',
		points: 25,
		tip: 'Get a volunteer signup on a shift to reach',
		nextScore: (c) => c + 25,
	},
	{
		key: 'credentialsIssuedCount',
		points: 25,
		tip: 'Issue a credential to reach',
		nextScore: (c) => c + 25,
	},
];

export function computeOrgHealth(input: OrgHealthInput): OrgHealthResult {
	let score = 0;

	for (const metric of METRICS) {
		if (input[metric.key] >= 1) {
			score += metric.points;
		}
	}

	if (score === 100) {
		return { score, tip: null };
	}

	// Find the first incomplete metric (priority order: screener → opp → shift → credential)
	for (const metric of METRICS) {
		if (input[metric.key] < 1) {
			return {
				score,
				tip: `${metric.tip} ${metric.nextScore(score)}`,
			};
		}
	}

	return { score, tip: null };
}
