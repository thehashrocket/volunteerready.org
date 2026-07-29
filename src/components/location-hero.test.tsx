// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';
import { LocationHero } from './location-hero';

const PROPS = {
	region: 'Central Valley',
	headline: 'FCRA-Compliant Background Checks',
	description: 'Stockton nonprofits managing volunteers through spreadsheets.',
};

describe('LocationHero', () => {
	it('renders the region, headline, and description', () => {
		render(<LocationHero {...PROPS} />);

		// Assert against PROPS rather than re-typed literals, so the fixture and
		// the expectations cannot drift apart.
		expect(screen.getByText(PROPS.region)).toBeTruthy();
		expect(screen.getByRole('heading', { name: PROPS.headline })).toBeTruthy();
		expect(screen.getByText(PROPS.description)).toBeTruthy();
	});

	// The hero previously pointed at a hardcoded `/images/dashboard-screenshot.png`
	// that has never existed on disk. `onError` fired and the guard blanked the
	// hero's right column on all six location pages — quietly, with no broken
	// icon, which is why it survived from the day the location pages shipped
	// until this change. Asserting against the MANIFEST (not a literal path) is
	// the point: marketing-screenshots.test.ts separately asserts every manifest
	// entry exists on disk, so the two together make "the hero points at a real
	// file" a CI-enforced invariant. A literal string here would re-admit exactly
	// the bug it is meant to catch.
	it('sources the screenshot from the marketing manifest, not a hardcoded path', () => {
		const { container } = render(<LocationHero {...PROPS} />);

		const img = container.querySelector('img');
		expect(img).not.toBeNull();
		// next/image rewrites src into `/_next/image?url=<encoded>`, so assert the
		// encoded manifest path is contained in src rather than comparing for
		// equality.
		expect(img?.getAttribute('src')).toContain(
			encodeURIComponent(MARKETING_SCREENSHOTS.dashboard.src),
		);
	});

	// The other half of the FINDING-001 invariant. The opacity assertion below
	// still passes if someone deletes `priority`, which would silently turn the
	// above-the-fold LCP hero into a lazy-loaded image and falsify the
	// component's own justification comment. next/image omits `loading` entirely
	// for priority images and sets `loading="lazy"` otherwise, so the two halves
	// now fail together.
	it('loads the above-the-fold hero eagerly, not lazily', () => {
		const { container } = render(<LocationHero {...PROPS} />);

		expect(container.querySelector('img')?.getAttribute('loading')).not.toBe(
			'lazy',
		);
	});

	// FINDING-001 regression test, mirroring the one in screenshot-section.test.tsx.
	// FadeInOnScroll holds children at `opacity-0` until an IntersectionObserver
	// reports 15% visibility. This hero image is the above-the-fold LCP candidate
	// and is eagerly preloaded via `priority`, so wrapping it would paint it
	// invisible on viewport heights where that threshold never fires (~<820px) —
	// and it briefly did, with a `delay={200}` on top. jsdom's IntersectionObserver
	// polyfill (src/test-setup.ts) never invokes its callback, so `isVisible`
	// stays false and `opacity-0` persists for anything still wrapped. That makes
	// the absence of `.opacity-0` a faithful proxy for "not wrapped".
	it('never starts the priority hero image at opacity-0', () => {
		const { container } = render(<LocationHero {...PROPS} />);

		expect(container.querySelector('.opacity-0')).toBeNull();
	});

	// The guard is the reason the original bug was invisible rather than loud.
	// It stays (a broken-image icon in the hero is worse than an empty column),
	// so it gets a test pinning what it actually does.
	it('hides the screenshot column when the image fails to load', () => {
		const { container } = render(<LocationHero {...PROPS} />);

		const img = container.querySelector('img');
		expect(img).not.toBeNull();

		fireEvent.error(img as HTMLImageElement);

		expect(container.querySelector('img')).toBeNull();
		// The text column survives — only the screenshot is dropped.
		expect(screen.getByText('Central Valley')).toBeTruthy();
	});
});
