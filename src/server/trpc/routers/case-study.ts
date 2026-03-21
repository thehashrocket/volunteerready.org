import { z } from 'zod';
import {
	getCaseStudy,
	getConsentedCaseStudies,
	getTestimonials,
	sendApprovalEmail,
	setOrgConsent,
} from '@/server/services/caseStudyService';
import {
	createTRPCRouter,
	platformAdminProcedure,
	publicProcedure,
} from '@/server/trpc/init';

export const caseStudyRouter = createTRPCRouter({
	getTestimonials: publicProcedure.query(async () => {
		return getTestimonials();
	}),

	getCaseStudies: platformAdminProcedure.query(async () => {
		return getConsentedCaseStudies();
	}),

	getAllOrgsForCaseStudies: platformAdminProcedure.query(async () => {
		const { prisma } = await import('@/server/repositories/prisma');
		const orgs = await prisma.organization.findMany({
			select: { id: true, name: true, slug: true, consentToPublicize: true },
			orderBy: { createdAt: 'desc' },
		});

		const results = await Promise.all(
			orgs.map(async (org) => {
				const data = await getCaseStudy(org.id);
				return data;
			}),
		);

		return results.filter((r) => r !== null);
	}),

	setConsent: platformAdminProcedure
		.input(z.object({ orgId: z.string(), consent: z.boolean() }))
		.mutation(async ({ input }) => {
			await setOrgConsent(input.orgId, input.consent);
		}),

	sendApprovalEmail: platformAdminProcedure
		.input(z.object({ orgId: z.string() }))
		.mutation(async ({ input }) => {
			return sendApprovalEmail(input.orgId);
		}),
});
