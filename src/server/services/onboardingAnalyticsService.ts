import {
	ROSTER_ACTIVATION_WINDOW_DAYS,
	ROSTER_POPULATED_THRESHOLD,
} from '@/server/domain/org-volunteer';
import { prisma } from '@/server/repositories/prisma';
import { countOrgsWithPopulatedRoster } from '@/server/repositories/rosterMetricsRepo';

/**
 * Onboarding funnel analytics for platform admins.
 * Measures how many orgs have completed each step of the 5-step funnel:
 *   1. Account created (org exists)
 *   2. Screener set up (≥1 active screener question)
 *   3. Opportunity published (≥1 published opportunity)
 *   4. First application received (firstApplicationReceivedAt is set)
 *   5. Roster populated (≥ ROSTER_POPULATED_THRESHOLD live roster rows)
 *
 * Step 5 counts live roster rows of ANY source, matching the checklist and the
 * concierge offer. That is deliberately looser than the roster launch's primary
 * success metric, which is reported separately below — see `rosterActivation`.
 */
export async function getOnboardingFunnel() {
	const [
		totalOrgs,
		orgsWithScreener,
		orgsWithOpportunity,
		orgsWithApplication,
		orgsWithRoster,
		rosterActivation,
		recentOrgs,
	] = await Promise.all([
		// Step 1: All orgs = accounts created
		prisma.organization.count(),

		// Step 2: Orgs with at least one active screener question
		prisma.organization.count({
			where: {
				screenerQuestions: { some: { isActive: true } },
			},
		}),

		// Step 3: Orgs with at least one published opportunity
		prisma.organization.count({
			where: {
				opportunities: { some: { status: 'PUBLISHED' } },
			},
		}),

		// Step 4: Orgs that received at least one application
		prisma.organization.count({
			where: { firstApplicationReceivedAt: { not: null } },
		}),

		// Step 5: Orgs whose roster reached the threshold, any source, ever.
		countOrgsWithPopulatedRoster({ threshold: ROSTER_POPULATED_THRESHOLD }),

		// The roster launch's PRIMARY success metric, stated in the design doc:
		// orgs reaching the threshold in STAFF_ADDED rows within 7 days of
		// signing up. Narrower than step 5 on both axes — source and window —
		// because it measures whether the concierge motion works, not whether a
		// roster eventually filled up.
		countOrgsWithPopulatedRoster({
			threshold: ROSTER_POPULATED_THRESHOLD,
			source: 'STAFF_ADDED',
			withinDaysOfSignup: ROSTER_ACTIVATION_WINDOW_DAYS,
		}),

		// Recent orgs with their onboarding progress (last 20)
		prisma.organization.findMany({
			orderBy: { createdAt: 'desc' },
			take: 20,
			select: {
				id: true,
				name: true,
				slug: true,
				createdAt: true,
				firstApplicationReceivedAt: true,
				_count: {
					select: {
						screenerQuestions: { where: { isActive: true } },
						opportunities: { where: { status: 'PUBLISHED' } },
						// Soft-deleted rows excluded: a roster someone emptied is
						// not a populated roster.
						orgVolunteers: { where: { deletedAt: null } },
					},
				},
			},
		}),
	]);

	const funnel = [
		{ step: 1, label: 'Account created', count: totalOrgs },
		{ step: 2, label: 'Screener set up', count: orgsWithScreener },
		{ step: 3, label: 'Opportunity published', count: orgsWithOpportunity },
		{
			step: 4,
			label: 'First application received',
			count: orgsWithApplication,
		},
		{
			step: 5,
			label: `Roster populated (${ROSTER_POPULATED_THRESHOLD}+)`,
			count: orgsWithRoster,
		},
	];

	const orgDetails = recentOrgs.map((org) => ({
		id: org.id,
		name: org.name,
		slug: org.slug,
		createdAt: org.createdAt,
		stepsCompleted: [
			true, // account created
			org._count.screenerQuestions > 0,
			org._count.opportunities > 0,
			org.firstApplicationReceivedAt !== null,
			org._count.orgVolunteers >= ROSTER_POPULATED_THRESHOLD,
		].filter(Boolean).length,
		hasScreener: org._count.screenerQuestions > 0,
		hasOpportunity: org._count.opportunities > 0,
		hasApplication: org.firstApplicationReceivedAt !== null,
		hasRoster: org._count.orgVolunteers >= ROSTER_POPULATED_THRESHOLD,
		rosterVolunteerCount: org._count.orgVolunteers,
	}));

	return {
		funnel,
		orgDetails,
		// Deliberately NOT paired with `totalOrgs` as a ratio. That denominator is
		// every org ever created, which includes orgs that predate the roster
		// table, orgs whose `staff_created_volunteers` flag is off (they cannot
		// enter the numerator at all — `addVolunteer` is behind `rosterProcedure`),
		// and orgs still inside their own 7-day window. Rendering N/M would read as
		// a rate that deflates over time whether or not the concierge motion works.
		// Reported as a raw count until the eligible cohort is computed — see the
		// P2 in docs/TODOS.md.
		rosterActivation: {
			orgs: rosterActivation,
			threshold: ROSTER_POPULATED_THRESHOLD,
			withinDays: ROSTER_ACTIVATION_WINDOW_DAYS,
		},
	};
}
