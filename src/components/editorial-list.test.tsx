// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorialList } from './editorial-list';

describe('EditorialList', () => {
	it('renders a heading and body for every item', () => {
		render(
			<EditorialList
				items={[
					{ heading: 'First thing', body: 'First description' },
					{ heading: 'Second thing', body: 'Second description' },
				]}
			/>,
		);

		expect(screen.getByText('First thing')).toBeTruthy();
		expect(screen.getByText('First description')).toBeTruthy();
		expect(screen.getByText('Second thing')).toBeTruthy();
		expect(screen.getByText('Second description')).toBeTruthy();
	});

	it('renders one row per item with the left accent border style', () => {
		const { container } = render(
			<EditorialList items={[{ heading: 'Only thing', body: 'Only body' }]} />,
		);

		const rows = container.querySelectorAll('.border-l-2.border-accent');
		expect(rows.length).toBe(1);
	});

	it('renders nothing and does not throw when items is empty', () => {
		const { container } = render(<EditorialList items={[]} />);

		expect(container.querySelectorAll('.border-l-2.border-accent').length).toBe(
			0,
		);
	});

	it('renders items in the supplied order', () => {
		render(
			<EditorialList
				items={[
					{ heading: 'Alpha', body: 'A' },
					{ heading: 'Beta', body: 'B' },
					{ heading: 'Gamma', body: 'C' },
				]}
			/>,
		);

		const headings = screen
			.getAllByRole('heading', { level: 3 })
			.map((h) => h.textContent);
		expect(headings).toEqual(['Alpha', 'Beta', 'Gamma']);
	});
});
