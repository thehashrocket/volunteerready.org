import { z } from 'zod';
import {
	getAllOrgsForCaseStudies,
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
		return getAllOrgsForCaseStudies();
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
