import { z } from 'zod';
import {
	createBillingPortalSession,
	createCheckoutSession,
	getOrgBillingStatus,
	getOrgPlanStatus,
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
	getBillingStatus: orgProcedure.query(({ ctx }) =>
		getOrgPlanStatus(ctx.orgId),
	),

	/**
	 * The billing page's status: asks Stripe which subscriptions could still
	 * bill, so the page never offers a checkout that would be refused. Only
	 * /app/billing uses it; everything else reads `getBillingStatus`, which does
	 * not call Stripe.
	 */
	getBillingPageStatus: orgProcedure.query(({ ctx }) =>
		getOrgBillingStatus(ctx.orgId),
	),

	/** Open the Stripe Billing Portal so the org can manage their subscription. */
	createPortalSession: orgProcedure.mutation(async ({ ctx }) => {
		const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
		return createBillingPortalSession({
			orgId: ctx.orgId,
			returnUrl: `${appUrl}/app/billing`,
		});
	}),
});
