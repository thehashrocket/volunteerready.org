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

// heroDescription deliberately contains a mid-sentence period ("U.S.") and
// summary deliberately differs from what heroDescription.split('.')[0] would
// produce, so this fixture fails if page.tsx ever reverts to deriving the
// row description from heroDescription instead of using summary directly.
const { FIXTURE_LOCATION } = vi.hoisted(() => ({
	FIXTURE_LOCATION: {
		slug: 'test-city',
		name: 'Test City, CA',
		heroDescription:
			'Test City nonprofits work with the U.S. Fish and Wildlife Service on habitat volunteer programs every spring.',
		summary:
			'A hand-authored summary, deliberately different from the hero copy.',
	},
}));

vi.mock('@/lib/locations', () => ({
	LOCATIONS: [FIXTURE_LOCATION],
}));

import LocationsIndexPage from './page';

describe('LocationsIndexPage', () => {
	it('renders the row description from the explicit summary field, not derived from heroDescription', () => {
		render(<LocationsIndexPage />);

		expect(screen.getByText(FIXTURE_LOCATION.summary)).toBeTruthy();

		const splitDerivedText = `${FIXTURE_LOCATION.heroDescription.split('.')[0]}.`;
		expect(screen.queryByText(splitDerivedText)).toBeNull();
	});
});
