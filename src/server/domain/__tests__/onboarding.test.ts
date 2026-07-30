import { describe, expect, it } from 'vitest';
import { computeOnboardingStatus, type OnboardingInput } from '../onboarding';
import { ROSTER_POPULATED_THRESHOLD } from '../org-volunteer';

const input = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
	orgName: 'Riverside Animal Shelter',
	orgSlug: 'riverside',
	screenerQuestionCount: 0,
	publishedOpportunityCount: 0,
	firstApplicationReceivedAt: null,
	onboardingDismissedAt: null,
	rosterVolunteerCount: 0,
	rosterEnabled: false,
	...over,
});

function step(status: ReturnType<typeof computeOnboardingStatus>, key: string) {
	return status.steps.find((s) => s.key === key);
}

describe('computeOnboardingStatus', () => {
	it('marks org basics complete once name and slug exist', () => {
		expect(step(computeOnboardingStatus(input()), 'org_basics')?.complete).toBe(
			true,
		);
	});

	it('completes each step from its own signal', () => {
		const status = computeOnboardingStatus(
			input({
				screenerQuestionCount: 1,
				publishedOpportunityCount: 1,
				firstApplicationReceivedAt: new Date(),
			}),
		);
		expect(step(status, 'screener')?.complete).toBe(true);
		expect(step(status, 'opportunity')?.complete).toBe(true);
		expect(step(status, 'first_volunteer')?.complete).toBe(true);
		expect(status.allComplete).toBe(true);
	});

	it('reports dismissal without changing completion', () => {
		const status = computeOnboardingStatus(
			input({ onboardingDismissedAt: new Date() }),
		);
		expect(status.dismissed).toBe(true);
		expect(status.allComplete).toBe(false);
	});
});

describe('the roster step', () => {
	it('is absent entirely when the roster is not enabled for the org', () => {
		// Not "present and incomplete". The step links to /app/volunteers, which
		// redirects a non-pilot org straight back to the dashboard — so showing it
		// would be an instruction the product refuses to let them follow.
		const status = computeOnboardingStatus(input({ rosterEnabled: false }));
		expect(step(status, 'roster')).toBeUndefined();
		expect(status.totalCount).toBe(4);
	});

	it('does not hold a non-pilot org permanently short of complete', () => {
		// The consequence of the above: an org that finishes the four real steps
		// must read as done, not as "4 of 5" forever.
		const status = computeOnboardingStatus(
			input({
				rosterEnabled: false,
				screenerQuestionCount: 1,
				publishedOpportunityCount: 1,
				firstApplicationReceivedAt: new Date(),
			}),
		);
		expect(status.allComplete).toBe(true);
	});

	it('appears, incomplete, for a pilot org with an empty roster', () => {
		const status = computeOnboardingStatus(input({ rosterEnabled: true }));
		expect(step(status, 'roster')?.complete).toBe(false);
		expect(status.totalCount).toBe(5);
	});

	it('completes at the threshold', () => {
		// The T20 verify step: a roster at the threshold reports complete.
		const status = computeOnboardingStatus(
			input({
				rosterEnabled: true,
				rosterVolunteerCount: ROSTER_POPULATED_THRESHOLD,
			}),
		);
		expect(step(status, 'roster')?.complete).toBe(true);
	});

	it('does NOT complete one row short of the threshold', () => {
		const status = computeOnboardingStatus(
			input({
				rosterEnabled: true,
				rosterVolunteerCount: ROSTER_POPULATED_THRESHOLD - 1,
			}),
		);
		expect(step(status, 'roster')?.complete).toBe(false);
	});

	it('agrees with the concierge offer on the same number', () => {
		// The roster page hides "send us your spreadsheet" at exactly this count.
		// If these two drifted, the product would congratulate an org for
		// finishing something it is still nagging them about on the next screen.
		const status = computeOnboardingStatus(
			input({
				rosterEnabled: true,
				rosterVolunteerCount: ROSTER_POPULATED_THRESHOLD,
			}),
		);
		expect(step(status, 'roster')?.description).toContain(
			String(ROSTER_POPULATED_THRESHOLD),
		);
	});

	it('comes last, so it does not interrupt the ordered steps', () => {
		const status = computeOnboardingStatus(input({ rosterEnabled: true }));
		expect(status.steps[status.steps.length - 1]?.key).toBe('roster');
	});
});
