import { beforeEach, describe, expect, it, vi } from 'vitest';

// The admin page's Continue button only works if the router forwards the
// cursor: `cursor` is optional, so dropping it still type-checks and Continue
// would re-read the newest page forever.

vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

const mocks = vi.hoisted(() => ({
	isPlatformAdmin: vi.fn(async () => true),
	reconcileStripeEvents: vi.fn(async () => ({
		eventsChecked: 0,
		eventsReplayed: 0,
		eventsFailed: 0,
		alreadyProcessed: 0,
		details: [],
		nextCursor: null,
	})),
}));

vi.mock('@/server/domain/platform-admin', () => ({
	isPlatformAdmin: mocks.isPlatformAdmin,
}));
vi.mock('@/server/services/billingService', () => ({
	reconcileStripeEvents: mocks.reconcileStripeEvents,
}));
vi.mock('@/server/services/onboardingAnalyticsService', () => ({
	getOnboardingFunnel: vi.fn(),
}));

import { createMockTrpcContext } from '@/server/trpc/__tests__/trpc-context-helpers';
import { t } from '@/server/trpc/init';
import { adminRouter } from '@/server/trpc/routers/admin';

const caller = t.createCallerFactory(adminRouter)(
	createMockTrpcContext({
		session: { user: { id: 'admin-1' } } as never,
		realSession: { user: { id: 'admin-1' } } as never,
		realUserId: 'admin-1',
	}),
);

beforeEach(() => {
	vi.clearAllMocks();
});

describe('admin.stripeReconcile', () => {
	it('forwards the cursor so Continue moves through the window', async () => {
		await caller.stripeReconcile({
			windowHours: 24,
			cursor: { startingAfter: 'evt_2', since: 1_700_000_000 },
		});

		expect(mocks.reconcileStripeEvents).toHaveBeenCalledWith({
			windowHours: 24,
			cursor: { startingAfter: 'evt_2', since: 1_700_000_000 },
		});
	});

	it('rejects a cursor without an event id', async () => {
		await expect(
			caller.stripeReconcile({
				windowHours: 24,
				cursor: { startingAfter: '', since: 1_700_000_000 },
			}),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mocks.reconcileStripeEvents).not.toHaveBeenCalled();
	});
});
