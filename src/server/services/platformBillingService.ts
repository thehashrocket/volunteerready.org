import {
	listOrgsByStripeCustomerIds,
	listRecentPaymentFailedEvents,
} from '@/server/repositories/platformBillingRepo';

export type DelinquentOrgRow = {
	orgId: string;
	slug: string;
	name: string;
	planTier: string;
	stripeCustomerId: string;
	stripeSubscriptionId: string | null;
	suspendedAt: Date | null;
	lastFailureAt: Date;
	lastFailureAmount: number | null;
	lastFailureCurrency: string | null;
	failureCount: number;
	stripeEventId: string;
};

type InvoicePayload = {
	data?: {
		object?: {
			customer?: string;
			amount_due?: number;
			currency?: string;
		};
	};
};

function extractInvoice(payload: unknown): {
	customerId: string | null;
	amountDue: number | null;
	currency: string | null;
} {
	const p = payload as InvoicePayload;
	const obj = p?.data?.object;
	return {
		customerId: typeof obj?.customer === 'string' ? obj.customer : null,
		amountDue: typeof obj?.amount_due === 'number' ? obj.amount_due : null,
		currency: typeof obj?.currency === 'string' ? obj.currency : null,
	};
}

export async function listDelinquentOrgs(
	opts: { limit?: number } = {},
): Promise<DelinquentOrgRow[]> {
	const events = await listRecentPaymentFailedEvents({ limit: opts.limit });
	if (events.length === 0) return [];

	type Aggregate = {
		latest: (typeof events)[number];
		amountDue: number | null;
		currency: string | null;
		count: number;
	};

	const byCustomer = new Map<string, Aggregate>();
	for (const evt of events) {
		const { customerId, amountDue, currency } = extractInvoice(evt.payload);
		if (!customerId) continue;
		const existing = byCustomer.get(customerId);
		if (!existing) {
			byCustomer.set(customerId, {
				latest: evt,
				amountDue,
				currency,
				count: 1,
			});
		} else {
			existing.count += 1;
		}
	}

	const customerIds = Array.from(byCustomer.keys());
	const orgs = await listOrgsByStripeCustomerIds(customerIds);

	const rows: DelinquentOrgRow[] = [];
	for (const org of orgs) {
		if (!org.stripeCustomerId) continue;
		const agg = byCustomer.get(org.stripeCustomerId);
		if (!agg) continue;
		rows.push({
			orgId: org.id,
			slug: org.slug,
			name: org.name,
			planTier: org.planTier,
			stripeCustomerId: org.stripeCustomerId,
			stripeSubscriptionId: org.stripeSubscriptionId,
			suspendedAt: org.suspendedAt,
			lastFailureAt: agg.latest.processedAt,
			lastFailureAmount: agg.amountDue,
			lastFailureCurrency: agg.currency,
			failureCount: agg.count,
			stripeEventId: agg.latest.stripeId,
		});
	}

	rows.sort((a, b) => b.lastFailureAt.getTime() - a.lastFailureAt.getTime());
	return rows;
}
