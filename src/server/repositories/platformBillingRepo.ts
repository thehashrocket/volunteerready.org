import { prisma } from './prisma';

export const PAYMENT_FAILED_EVENT_TYPE = 'invoice.payment_failed';

export type RecentPaymentFailedEvent = {
	id: string;
	stripeId: string;
	processedAt: Date;
	payload: unknown;
};

/**
 * Returns recent `invoice.payment_failed` webhook events newest-first. The
 * caller groups by Stripe customer ID and resolves orgs.
 */
export async function listRecentPaymentFailedEvents(opts: {
	limit?: number;
}): Promise<RecentPaymentFailedEvent[]> {
	const take = Math.min(opts.limit ?? 200, 500);
	return prisma.stripeWebhookEvent.findMany({
		where: { type: PAYMENT_FAILED_EVENT_TYPE },
		orderBy: { processedAt: 'desc' },
		take,
		select: {
			id: true,
			stripeId: true,
			processedAt: true,
			payload: true,
		},
	});
}

export async function listOrgsByStripeCustomerIds(customerIds: string[]) {
	if (customerIds.length === 0) return [];
	return prisma.organization.findMany({
		where: { stripeCustomerId: { in: customerIds } },
		select: {
			id: true,
			slug: true,
			name: true,
			planTier: true,
			stripeCustomerId: true,
			stripeSubscriptionId: true,
			suspendedAt: true,
		},
	});
}
