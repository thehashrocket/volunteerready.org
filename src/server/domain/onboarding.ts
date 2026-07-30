/**
 * Onboarding status — shared domain logic for the getting started checklist
 * and onboarding wizard. Pure function: no DB calls, no side effects.
 *
 * Steps:
 *   1. Org basics     — name + slug are set (always true after signup)
 *   2. Screener setup — at least one screener question exists
 *   3. Opportunity     — at least one opportunity is published
 *   4. First volunteer — at least one application received
 *   5. Roster          — >= ROSTER_POPULATED_THRESHOLD volunteers on the roster,
 *                        and only when the roster is enabled for this org
 */

import { ROSTER_POPULATED_THRESHOLD } from './org-volunteer';

export interface OnboardingInput {
	orgName: string;
	orgSlug: string;
	screenerQuestionCount: number;
	publishedOpportunityCount: number;
	firstApplicationReceivedAt: Date | null;
	onboardingDismissedAt: Date | null;
	/** Live roster rows, any source. */
	rosterVolunteerCount: number;
	/** `staff_created_volunteers` for this org. Hides the step when false. */
	rosterEnabled: boolean;
}

export interface OnboardingStep {
	key: 'org_basics' | 'screener' | 'opportunity' | 'first_volunteer' | 'roster';
	label: string;
	description: string;
	complete: boolean;
	href: string;
}

export interface OnboardingStatus {
	steps: OnboardingStep[];
	completedCount: number;
	totalCount: number;
	allComplete: boolean;
	dismissed: boolean;
}

export function computeOnboardingStatus(
	input: OnboardingInput,
): OnboardingStatus {
	const steps: OnboardingStep[] = [
		{
			key: 'org_basics',
			label: 'Set up your organization',
			description: 'Add your organization name and URL slug.',
			complete: Boolean(input.orgName && input.orgSlug),
			href: '/app/settings',
		},
		{
			key: 'screener',
			label: 'Create screener questions',
			description:
				'Add at least one question to screen volunteer applications.',
			complete: input.screenerQuestionCount > 0,
			href: '/app/screener',
		},
		{
			key: 'opportunity',
			label: 'Publish an opportunity',
			description:
				'Create and publish a volunteer opportunity for people to apply to.',
			complete: input.publishedOpportunityCount > 0,
			href: '/app/opportunities',
		},
		{
			key: 'first_volunteer',
			label: 'Receive your first application',
			description:
				'Share your public apply page and wait for your first volunteer!',
			complete: input.firstApplicationReceivedAt !== null,
			href: '/app/applications',
		},
	];

	// Appended, not inserted: it is the only step an org can complete before
	// publishing anything, so it must not sit between two steps that do have an
	// order.
	//
	// OMITTED ENTIRELY, not shown-and-incomplete, when the flag is off. The step
	// links to `/app/volunteers`, which `volunteers/layout.tsx` redirects away
	// from for a non-pilot org — so showing it would be an instruction the
	// product refuses to let the reader follow. Omitting also keeps `totalCount`
	// honest, instead of pinning every non-pilot org at "4 of 5" forever.
	if (input.rosterEnabled) {
		steps.push({
			key: 'roster',
			label: 'Add your volunteers',
			description: `Add the ${ROSTER_POPULATED_THRESHOLD} volunteers you already work with so you can schedule them and track their hours.`,
			complete: input.rosterVolunteerCount >= ROSTER_POPULATED_THRESHOLD,
			href: '/app/volunteers',
		});
	}

	const completedCount = steps.filter((s) => s.complete).length;

	return {
		steps,
		completedCount,
		totalCount: steps.length,
		allComplete: completedCount === steps.length,
		dismissed: input.onboardingDismissedAt !== null,
	};
}
