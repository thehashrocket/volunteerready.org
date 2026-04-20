import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockListRecentEvents, mockListOrgsByCustomerIds } = vi.hoisted(() => ({
	mockListRecentEvents: vi.fn(),
	mockListOrgsByCustomerIds: vi.fn(),
}));

vi.mock('@/server/repositories/platformBillingRepo', () => ({
	listRecentPaymentFailedEvents: mockListRecentEvents,
	listOrgsByStripeCustomerIds: mockListOrgsByCustomerIds,
	PAYMENT_FAILED_EVENT_TYPE: 'invoice.payment_failed',
}));

import { listDelinquentOrgs } from '../platformBillingService';

function makeEvent(opts: {
	id: string;
	stripeId: string;
	processedAt: Date;
	customer: string;
	amount?: number;
	currency?: string;
}) {
	return {
		id: opts.id,
		stripeId: opts.stripeId,
		processedAt: opts.processedAt,
		payload: {
			data: {
				object: {
					customer: opts.customer,
					amount_due: opts.amount,
					currency: opts.currency,
				},
			},
		},
	};
}

describe('platformBillingService.listDelinquentOrgs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns empty list when no events exist', async () => {
		mockListRecentEvents.mockResolvedValueOnce([]);
		const result = await listDelinquentOrgs();
		expect(result).toEqual([]);
		expect(mockListOrgsByCustomerIds).not.toHaveBeenCalled();
	});

	it('groups events by customer, takes latest, counts failures', async () => {
		const newer = new Date('2026-04-19T12:00:00Z');
		const older = new Date('2026-04-15T12:00:00Z');

		mockListRecentEvents.mockResolvedValueOnce([
			makeEvent({
				id: 'e1',
				stripeId: 'evt_1',
				processedAt: newer,
				customer: 'cus_a',
				amount: 5000,
				currency: 'usd',
			}),
			makeEvent({
				id: 'e2',
				stripeId: 'evt_2',
				processedAt: older,
				customer: 'cus_a',
				amount: 4500,
				currency: 'usd',
			}),
			makeEvent({
				id: 'e3',
				stripeId: 'evt_3',
				processedAt: newer,
				customer: 'cus_b',
				amount: 9900,
				currency: 'usd',
			}),
		]);
		mockListOrgsByCustomerIds.mockResolvedValueOnce([
			{
				id: 'org-a',
				slug: 'orga',
				name: 'Org A',
				planTier: 'STARTER',
				stripeCustomerId: 'cus_a',
				stripeSubscriptionId: 'sub_a',
				suspendedAt: null,
			},
			{
				id: 'org-b',
				slug: 'orgb',
				name: 'Org B',
				planTier: 'PRO',
				stripeCustomerId: 'cus_b',
				stripeSubscriptionId: 'sub_b',
				suspendedAt: null,
			},
		]);

		const result = await listDelinquentOrgs();

		expect(result).toHaveLength(2);
		const orgA = result.find((r) => r.orgId === 'org-a');
		expect(orgA?.failureCount).toBe(2);
		expect(orgA?.lastFailureAt).toEqual(newer);
		expect(orgA?.lastFailureAmount).toBe(5000);
		expect(orgA?.stripeEventId).toBe('evt_1');

		const orgB = result.find((r) => r.orgId === 'org-b');
		expect(orgB?.failureCount).toBe(1);
		expect(orgB?.lastFailureAmount).toBe(9900);
	});

	it('skips events with no customer in payload', async () => {
		mockListRecentEvents.mockResolvedValueOnce([
			{
				id: 'e1',
				stripeId: 'evt_1',
				processedAt: new Date(),
				payload: { data: { object: {} } },
			},
		]);
		mockListOrgsByCustomerIds.mockResolvedValueOnce([]);

		const result = await listDelinquentOrgs();
		expect(result).toEqual([]);
		expect(mockListOrgsByCustomerIds).toHaveBeenCalledWith([]);
	});

	it('skips events whose customer is not linked to any org', async () => {
		mockListRecentEvents.mockResolvedValueOnce([
			makeEvent({
				id: 'e1',
				stripeId: 'evt_1',
				processedAt: new Date(),
				customer: 'cus_orphan',
				amount: 100,
				currency: 'usd',
			}),
		]);
		mockListOrgsByCustomerIds.mockResolvedValueOnce([]);

		const result = await listDelinquentOrgs();
		expect(result).toEqual([]);
	});
});
