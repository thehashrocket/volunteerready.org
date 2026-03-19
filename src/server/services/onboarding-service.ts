import {
	computeOnboardingStatus,
	type OnboardingInput,
} from '@/server/domain/onboarding';
import { prisma } from '@/server/repositories/prisma';

export async function getOnboardingStatus(orgId: string) {
	const [org, screenerCount, publishedCount] = await Promise.all([
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
	]);

	const input: OnboardingInput = {
		orgName: org.name,
		orgSlug: org.slug,
		screenerQuestionCount: screenerCount,
		publishedOpportunityCount: publishedCount,
		firstApplicationReceivedAt: org.firstApplicationReceivedAt,
		onboardingDismissedAt: org.onboardingDismissedAt,
	};

	return computeOnboardingStatus(input);
}

export async function dismissOnboarding(orgId: string) {
	await prisma.organization.update({
		where: { id: orgId },
		data: { onboardingDismissedAt: new Date() },
	});
}
