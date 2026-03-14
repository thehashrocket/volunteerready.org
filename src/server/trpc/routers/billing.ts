import { z } from 'zod';
import {
	createBillingPortalSession,
	createCheckoutSession,
} from '@/server/services/billingService';
import { createTRPCRouter, orgProcedure } from '../init';

export const billingRouter = createTRPCRouter({
	/** Initiate a Stripe Checkout session to upgrade the org's plan. */
	createCheckoutSession: orgProcedure
		.input(z.object({ tier: z.enum(['STARTER', 'PRO']) }))
		.mutation(async ({ ctx, input }) => {
			const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
			return createCheckoutSession({
				orgId: ctx.orgId,
				email: ctx.session?.user?.email ?? '',
				tier: input.tier,
				successUrl: `${appUrl}/app/billing?upgraded=1`,
				cancelUrl: `${appUrl}/app/billing`,
			});
		}),

	/**
	 * Get the org's current billing status.
	 * Never exposes raw stripeCustomerId — returns a boolean presence flag.
	 */
	getBillingStatus: orgProcedure.query(async ({ ctx }) => {
		const org = await ctx.prisma.organization.findUniqueOrThrow({
			where: { id: ctx.orgId },
			select: {
				planTier: true,
				trialEndsAt: true,
				stripeCustomerId: true,
			},
		});
		return {
			planTier: org.planTier,
			trialEndsAt: org.trialEndsAt,
			hasStripeCustomer: org.stripeCustomerId !== null,
		};
	}),

	/** Open the Stripe Billing Portal so the org can manage their subscription. */
	createPortalSession: orgProcedure.mutation(async ({ ctx }) => {
		const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
		return createBillingPortalSession({
			orgId: ctx.orgId,
			returnUrl: `${appUrl}/app/billing`,
		});
	}),
});
