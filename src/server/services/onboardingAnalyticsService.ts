import { prisma } from '@/server/repositories/prisma';

/**
 * Onboarding funnel analytics for platform admins.
 * Measures how many orgs have completed each step of the 4-step funnel:
 *   1. Account created (org exists)
 *   2. Screener set up (≥1 active screener question)
 *   3. Opportunity published (≥1 published opportunity)
 *   4. First application received (firstApplicationReceivedAt is set)
 */
export async function getOnboardingFunnel() {
	const [
		totalOrgs,
		orgsWithScreener,
		orgsWithOpportunity,
		orgsWithApplication,
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
		].filter(Boolean).length,
		hasScreener: org._count.screenerQuestions > 0,
		hasOpportunity: org._count.opportunities > 0,
		hasApplication: org.firstApplicationReceivedAt !== null,
	}));

	return { funnel, orgDetails };
}
