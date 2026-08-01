// @vitest-environment jsdom

// ---------------------------------------------------------------------------
// PageHeader had 38 consumers and no tests.
//
// It gained `min-w-0 flex-wrap` on its actions row as part of the app-shell
// overflow fix, because it had the SAME bug the shell did: a flex item's
// default `min-width: auto` is its content's intrinsic width, so an actions row
// wider than its column forced itself wider than its own parent instead of
// reflowing. On `/app/opportunities` at 375px that was a `w-44` Select beside a
// "New opportunity" button — 343px of content in a 311px column — and the row
// ran 32px past the page padding to sit flush against the viewport edge.
//
// It did not even trip a `documentElement.scrollWidth` assertion, because the
// overhang happened to stop at exactly 375. One more character in the label and
// it would have. That is why this is pinned by class assertion here as well as
// by the container-bounds geometry check in `staff-tables-mobile.spec.ts`: the
// e2e covers ONE page at ONE viewport, and this component is on 38 of them.
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';

describe('PageHeader layout discipline', () => {
	it('lets the actions row shrink and wrap rather than overflow its column', () => {
		render(
			<PageHeader
				title="Volunteer Opportunities"
				actions={<button type="button">New opportunity</button>}
			/>,
		);

		const actions = screen.getByRole('button').parentElement;
		expect(actions).toHaveClass('min-w-0', 'flex-wrap');
	});

	it('lets the title block shrink too', () => {
		// Without `min-w-0` a long unbreakable title does to this side exactly
		// what the actions row did to the other.
		render(<PageHeader title="Volunteer Opportunities" />);

		const titleBlock = screen.getByRole('heading', { level: 1 }).parentElement;
		expect(titleBlock).toHaveClass('min-w-0');
	});

	it('renders no actions wrapper when there are no actions', () => {
		// The wrapper is conditional; an always-rendered empty flex row would add
		// a gap to every page that passes no actions.
		const { container } = render(<PageHeader title="Shifts" />);

		expect(container.querySelectorAll('div.flex-wrap')).toHaveLength(0);
	});

	it('renders the description only when given one', () => {
		const { rerender } = render(
			<PageHeader title="Shifts" description="12 shifts" />,
		);
		expect(screen.getByText('12 shifts')).toBeInTheDocument();

		rerender(<PageHeader title="Shifts" />);
		expect(screen.queryByText('12 shifts')).not.toBeInTheDocument();
	});
});
