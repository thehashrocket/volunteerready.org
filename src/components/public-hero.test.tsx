// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublicHero } from './public-hero';

const baseProps = {
	heading: 'Test heading',
	description: 'Test description copy.',
};

describe('PublicHero', () => {
	it('renders single-column layout when no `side` prop is passed', () => {
		const { container } = render(<PublicHero {...baseProps} />);

		const grid = container.querySelector('[class*="grid-cols-[7fr_5fr]"]');
		expect(grid).toBeNull();

		expect(screen.getByText('Test heading')).toBeInTheDocument();
		expect(screen.getByText('Test description copy.')).toBeInTheDocument();
	});

	it('renders structured `{ label, note }` side with mono label and bordered note', () => {
		const { container } = render(
			<PublicHero
				{...baseProps}
				side={{
					label: 'Coordinators say',
					note: (
						<>
							We saved{' '}
							<em className="italic" data-testid="emphasis">
								six hours a week
							</em>{' '}
							on screening.
						</>
					),
				}}
			/>,
		);

		const grid = container.querySelector('[class*="grid-cols-[7fr_5fr]"]');
		expect(grid).not.toBeNull();
		expect(grid?.className).toMatch(/max-w-\[1040px\]/);

		const label = screen.getByText('Coordinators say');
		expect(label.className).toMatch(/text-muted-foreground/);
		expect(label.className).toMatch(/uppercase/);

		const noteContainer = container.querySelector(
			'[class*="border-l-2"][class*="border-accent"]',
		);
		expect(noteContainer).not.toBeNull();
		expect(noteContainer?.textContent).toContain('six hours a week');

		expect(screen.getByTestId('emphasis')).toHaveClass('italic');
	});

	it('renders an arbitrary ReactNode `side` as a 7/5 right column', () => {
		const { container } = render(
			<PublicHero
				{...baseProps}
				side={<div data-testid="custom-side">Arbitrary node</div>}
			/>,
		);

		const grid = container.querySelector('[class*="grid-cols-[7fr_5fr]"]');
		expect(grid).not.toBeNull();

		const customSide = screen.getByTestId('custom-side');
		expect(customSide).toBeInTheDocument();
		expect(customSide.textContent).toBe('Arbitrary node');

		expect(
			container.querySelector('[class*="border-l-2"][class*="border-accent"]'),
		).toBeNull();
	});
});
