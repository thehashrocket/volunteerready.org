import { beforeEach, describe, expect, it, vi } from 'vitest';

// `getBillingStatus` backs PlanGate and the background-checks page, which
// refetch on every focus, so it must stay a database read. Only the billing
// page's own procedure may ask Stripe. Both service functions take the same
// argument, so swapping them would still type-check.

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: { findUnique: vi.fn(async () => ({ suspendedAt: null })) },
	},
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

const mocks = vi.hoisted(() => ({
	getOrgPlanStatus: vi.fn(async () => ({ planTier: 'FREE' })),
	getOrgBillingStatus: vi.fn(async () => ({ planTier: 'FREE' })),
}));

vi.mock('@/server/services/billingService', () => ({
	getOrgPlanStatus: mocks.getOrgPlanStatus,
	getOrgBillingStatus: mocks.getOrgBillingStatus,
	createCheckoutSession: vi.fn(),
	createBillingPortalSession: vi.fn(),
}));

import { createMockTrpcContext } from '@/server/trpc/__tests__/trpc-context-helpers';
import { t } from '@/server/trpc/init';
import { billingRouter } from '@/server/trpc/routers/billing';

const caller = t.createCallerFactory(billingRouter)(
	createMockTrpcContext({
		session: { user: { id: 'u1' } } as never,
		realSession: { user: { id: 'u1' } } as never,
		realUserId: 'u1',
		orgId: 'org-1',
	}),
);

beforeEach(() => {
	vi.clearAllMocks();
});

describe('billing status procedures', () => {
	it('getBillingStatus reads the plan without asking Stripe', async () => {
		await caller.getBillingStatus();

		expect(mocks.getOrgPlanStatus).toHaveBeenCalledWith('org-1');
		expect(mocks.getOrgBillingStatus).not.toHaveBeenCalled();
	});

	it('getBillingPageStatus asks Stripe for the billing page', async () => {
		await caller.getBillingPageStatus();

		expect(mocks.getOrgBillingStatus).toHaveBeenCalledWith('org-1');
		expect(mocks.getOrgPlanStatus).not.toHaveBeenCalled();
	});
});
