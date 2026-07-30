import {
	computeOnboardingStatus,
	type OnboardingInput,
} from '@/server/domain/onboarding';
import { countOrgVolunteers } from '@/server/repositories/orgVolunteerRepo';
import { prisma } from '@/server/repositories/prisma';
import { isRosterEnabledForOrg } from './featureFlagService';

export async function getOnboardingStatus(orgId: string) {
	const [org, screenerCount, publishedCount, rosterCount, rosterEnabled] =
		await Promise.all([
			prisma.organization.findUniqueOrThrow({
				where: { id: orgId },
				select: {
					name: true,
					slug: true,
					firstApplicationReceivedAt: true,
					onboardingDismissedAt: true,
				},
			}),
			prisma.screenerQuestion.count({ where: { orgId, isActive: true } }),
			prisma.volunteerOpportunity.count({
				where: { orgId, status: 'PUBLISHED' },
			}),
			// Same count the roster page and the concierge offer use, so the
			// checklist cannot congratulate an org the page is still nudging.
			countOrgVolunteers(orgId),
			isRosterEnabledForOrg(orgId),
		]);

	const input: OnboardingInput = {
		orgName: org.name,
		orgSlug: org.slug,
		screenerQuestionCount: screenerCount,
		publishedOpportunityCount: publishedCount,
		firstApplicationReceivedAt: org.firstApplicationReceivedAt,
		onboardingDismissedAt: org.onboardingDismissedAt,
		rosterVolunteerCount: rosterCount,
		rosterEnabled,
	};

	return computeOnboardingStatus(input);
}

export async function dismissOnboarding(orgId: string) {
	await prisma.organization.update({
		where: { id: orgId },
		data: { onboardingDismissedAt: new Date() },
	});
}
