// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/script to render a simple span with the src/id
vi.mock('next/script', () => ({
	default: ({
		src,
		id,
		children,
	}: {
		src?: string;
		id?: string;
		children?: string;
	}) => (
		<span data-testid={id ?? 'script'} data-src={src}>
			{children}
		</span>
	),
}));

// Mock @vercel/analytics/next
vi.mock('@vercel/analytics/next', () => ({
	Analytics: () => <span data-testid="vercel-analytics" />,
}));

import { ConsentedAnalytics } from '../consented-analytics';
import { COOKIE_CONSENT_STORAGE_KEY } from '../cookie-consent-banner';

const GA_MEASUREMENT_ID = 'G-8EYQH68KXC';

describe('ConsentedAnalytics', () => {
	beforeEach(() => {
		localStorage.clear();
		delete (window as Record<string, unknown>)[
			`ga-disable-${GA_MEASUREMENT_ID}`
		];
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('always renders the gtag script (for Google detection)', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(getByTestId('script')).toBeDefined();
	});

	it('sets ga-disable flag to true when consent is not given', () => {
		render(<ConsentedAnalytics />);
		expect(
			(window as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`],
		).toBe(true);
	});

	it('renders scripts when analytics consent is true', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);

		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(getByTestId('vercel-analytics')).toBeDefined();
	});

	it('sets ga-disable flag to false when consent is granted', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);

		render(<ConsentedAnalytics />);
		expect(
			(window as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`],
		).toBe(false);
	});

	it('renders scripts but not Vercel Analytics when consent is false', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: false }),
		);

		const { getByTestId, queryByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(queryByTestId('vercel-analytics')).toBeNull();
	});

	it('renders scripts but not Vercel Analytics when stored JSON is invalid', () => {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '{bad json');

		const { getByTestId, queryByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(queryByTestId('vercel-analytics')).toBeNull();
	});

	it('responds to cookie-consent-changed events', () => {
		const { getByTestId, queryByTestId } = render(<ConsentedAnalytics />);
		// Script always present, but Vercel Analytics not yet
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(queryByTestId('vercel-analytics')).toBeNull();

		// Grant consent via localStorage + event
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);

		act(() => {
			window.dispatchEvent(new Event('cookie-consent-changed'));
		});

		expect(getByTestId('gtag-init')).toBeDefined();
		expect(getByTestId('vercel-analytics')).toBeDefined();
	});
});
