// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		marketplace: {
			getMyInterests: {
				useQuery: () => ({ data: undefined, isLoading: false }),
			},
			toggleInterest: {
				useMutation: () => ({
					mutate: vi.fn(),
					isPending: false,
				}),
			},
			searchOpportunities: {
				useQuery: () => ({
					data: undefined,
					isFetching: false,
					refetch: vi.fn(),
				}),
			},
		},
	},
}));

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

vi.mock('next/link', () => ({
	default: ({
		children,
		href,
	}: {
		children: React.ReactNode;
		href: string;
	}) => <a href={href}>{children}</a>,
}));

import { MarketplaceListing } from './MarketplaceListing';

describe('MarketplaceListing', () => {
	it('renders "Browse organizations" link in the empty-state when there are no opportunities', () => {
		render(
			<MarketplaceListing
				initialItems={[]}
				initialNextCursor={null}
				thisWeekend={[]}
			/>,
		);

		const link = screen.getByRole('link', { name: /browse organizations/i });
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute('href', '/organizations');
	});
});
