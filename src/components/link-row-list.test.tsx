// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
	default: ({
		children,
		href,
		className,
	}: {
		children: React.ReactNode;
		href: string;
		className?: string;
	}) => (
		<a href={href} className={className}>
			{children}
		</a>
	),
}));

import { LinkRowList } from './link-row-list';

describe('LinkRowList', () => {
	it('renders one row per item with correct href, heading, and description', () => {
		render(
			<LinkRowList
				items={[
					{ href: '/a', heading: 'First thing', description: 'First body' },
					{ href: '/b', heading: 'Second thing', description: 'Second body' },
				]}
			/>,
		);

		const first = screen.getByRole('link', { name: /First thing/ });
		expect(first).toHaveAttribute('href', '/a');
		expect(screen.getByText('First body')).toBeTruthy();

		const second = screen.getByRole('link', { name: /Second thing/ });
		expect(second).toHaveAttribute('href', '/b');
		expect(screen.getByText('Second body')).toBeTruthy();
	});

	it('renders headings as level-2 (not the level-3 EditorialList uses)', () => {
		render(
			<LinkRowList
				items={[
					{ href: '/a', heading: 'Only thing', description: 'Only body' },
				]}
			/>,
		);

		expect(
			screen.getByRole('heading', { level: 2, name: 'Only thing' }),
		).toBeTruthy();
	});

	it('applies the alternating stripe class on odd-indexed rows only', () => {
		const { container } = render(
			<LinkRowList
				items={[
					{ href: '/a', heading: 'A', description: 'a' },
					{ href: '/b', heading: 'B', description: 'b' },
					{ href: '/c', heading: 'C', description: 'c' },
				]}
			/>,
		);

		const rows = container.querySelectorAll('a');
		expect(rows[0].className).not.toContain('bg-muted/30');
		expect(rows[1].className).toContain('bg-muted/30');
		expect(rows[2].className).not.toContain('bg-muted/30');
	});

	it('renders nothing and does not throw when items is empty', () => {
		const { container } = render(<LinkRowList items={[]} />);

		expect(container.querySelectorAll('a').length).toBe(0);
	});

	it('renders items in the supplied order', () => {
		render(
			<LinkRowList
				items={[
					{ href: '/alpha', heading: 'Alpha', description: 'A' },
					{ href: '/beta', heading: 'Beta', description: 'B' },
					{ href: '/gamma', heading: 'Gamma', description: 'C' },
				]}
			/>,
		);

		const headings = screen
			.getAllByRole('heading', { level: 2 })
			.map((h) => h.textContent);
		expect(headings).toEqual(['Alpha', 'Beta', 'Gamma']);
	});
});
