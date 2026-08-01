// @vitest-environment jsdom

// ---------------------------------------------------------------------------
// `CardList` is the shared below-`lg` counterpart of a staff data table, used by
// four pages. Its whole reason for existing is a class string whose purpose is
// invisible at the call site, so reducing it to `cn(className)` — the obvious
// "simplification" — would break the dividers on four pages at once and redden
// nothing, since jsdom cannot see the visual result.
//
// These assert the contract instead: the three neutralising utilities survive,
// and a caller's own classes compose with them rather than replacing them.
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CARD_LIST, CardList } from './card-list';

describe('CardList', () => {
	it('neutralises the three Card base styles that fight divide-y', () => {
		// `Card` is `flex flex-col gap-6 … py-6`: the hairline draws on each row's
		// top edge while the 24px gap holds the rows apart, so the rule floats in
		// open space instead of separating anything.
		render(<CardList data-testid="list" />);

		expect(screen.getByTestId('list')).toHaveClass('gap-0', 'divide-y', 'py-0');
	});

	it('applies every token of the exported constant', () => {
		// Ties the component to the constant WITHOUT asserting the constant equals
		// itself — a first version did exactly that and proved nothing. `CARD_LIST`
		// is exported and named in CLAUDE.md, so a caller may compose it directly;
		// this fails if the component and the constant ever diverge.
		render(<CardList data-testid="list" />);

		const el = screen.getByTestId('list');
		for (const token of CARD_LIST.split(' ')) {
			expect(el).toHaveClass(token);
		}
	});

	it('composes a caller className instead of replacing the base', () => {
		render(<CardList className="mt-4" data-testid="list" />);

		const el = screen.getByTestId('list');
		expect(el).toHaveClass('mt-4');
		// The neutralisers must survive the merge — this is the regression that
		// would otherwise only show up as dividers in the wrong place.
		expect(el).toHaveClass('gap-0', 'divide-y', 'py-0');
	});

	it('still carries Card’s surface so it reads as one card, not loose rows', () => {
		render(<CardList data-testid="list" />);

		const el = screen.getByTestId('list');
		expect(el).toHaveAttribute('data-slot', 'card');
		expect(el).toHaveClass('rounded-xl', 'border');
	});

	it('renders its rows as direct children so divide-y applies between them', () => {
		// `divide-y` styles siblings. An implicit wrapper would collapse every
		// divider — the same class of bug as the gap, from the other direction.
		render(
			<CardList data-testid="list">
				<div data-testid="row-1">one</div>
				<div data-testid="row-2">two</div>
			</CardList>,
		);

		const list = screen.getByTestId('list');
		expect(screen.getByTestId('row-1').parentElement).toBe(list);
		expect(screen.getByTestId('row-2').parentElement).toBe(list);
	});
});
