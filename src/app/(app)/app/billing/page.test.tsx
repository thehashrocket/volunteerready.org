// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useBillingStatus: vi.fn() }));

// Only `billing.getBillingPageStatus` drives what is under test; a Proxy keeps the
// mutations inert so this file does not break when the page gains another.
vi.mock('@/lib/trpc/client', () => {
	const inert = new Proxy(
		{},
		{
			get: (_t, prop) => {
				if (prop === 'useMutation')
					return () => ({ mutate: vi.fn(), isPending: false });
				if (prop === 'useQuery')
					return () => ({ data: undefined, isLoading: false, isError: false });
				return undefined;
			},
		},
	);
	return {
		trpc: new Proxy(
			{},
			{
				get: (_t, router) =>
					new Proxy(
						{},
						{
							get: (_r, proc) =>
								router === 'billing' && proc === 'getBillingPageStatus'
									? { useQuery: mocks.useBillingStatus }
									: inert,
						},
					),
			},
		),
	};
});

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));

import BillingPage from './page';

function withStatus(data: Record<string, unknown>) {
	mocks.useBillingStatus.mockReturnValue({
		data: {
			planTier: 'FREE',
			trialEndsAt: null,
			hasStripeCustomer: true,
			...data,
		},
		isLoading: false,
		isError: false,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('BillingPage', () => {
	it('offers upgrades when nothing could still bill', () => {
		withStatus({ hasSubscription: false, subscriptionStatus: null });

		render(<BillingPage />);

		expect(
			screen.getByRole('button', { name: 'Upgrade to Starter' }),
		).toBeInTheDocument();
	});

	it.each([
		['unpaid', /subscription is unpaid/i],
		['paused', /subscription is paused/i],
		['incomplete', /first payment hasn't been completed/i],
		['past_due', /payment didn't go through/i],
		['active', /to switch plans, open manage subscription/i],
		['unknown', /to switch plans, open manage subscription/i],
	])(
		'explains what to do for a %s subscription instead of offering checkout',
		(subscriptionStatus, guidance) => {
			withStatus({ hasSubscription: true, subscriptionStatus });

			render(<BillingPage />);

			expect(screen.getByText(guidance)).toBeInTheDocument();
			expect(
				screen.queryByRole('button', { name: /upgrade to/i }),
			).not.toBeInTheDocument();
		},
	);

	it('shows no upgrade buttons while the status is loading', () => {
		mocks.useBillingStatus.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});

		render(<BillingPage />);

		expect(screen.getByText(/loading your plan/i)).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: /upgrade to/i }),
		).not.toBeInTheDocument();
	});

	it('shows an error card, not upgrade buttons, when the status fails to load', () => {
		mocks.useBillingStatus.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			error: {
				message: 'internal boom',
				data: { code: 'INTERNAL_SERVER_ERROR' },
			},
			refetch: vi.fn(),
			isFetching: false,
		});

		render(<BillingPage />);

		expect(screen.getByText(/couldn't load your plan/i)).toBeInTheDocument();
		expect(screen.queryByText('internal boom')).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: /upgrade to/i }),
		).not.toBeInTheDocument();
	});
});
