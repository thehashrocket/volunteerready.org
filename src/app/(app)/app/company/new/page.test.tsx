// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/trpc/client', () => ({
	trpc: {
		company: {
			create: {
				useMutation: () => ({ mutate: vi.fn(), isPending: false }),
			},
		},
	},
}));

vi.mock('next/link', () => ({
	default: ({
		children,
		href,
	}: {
		children: React.ReactNode;
		href: string;
	}) => <a href={href}>{children}</a>,
}));

const { default: NewCompanyPage } = await import('./page');

describe('NewCompanyPage', () => {
	it('cross-links to organization onboarding for a user who landed here by mistake', () => {
		render(<NewCompanyPage />);

		const link = screen.getByText('Set up an organization');
		expect(link.closest('a')).toHaveAttribute('href', '/app/onboarding');
	});
});
