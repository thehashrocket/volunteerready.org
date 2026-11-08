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

describe('ConsentedAnalytics', () => {
	let gtag: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		localStorage.clear();
		// gtag is normally defined by the inline init script; stub it so we can
		// assert the Consent Mode update calls fired by the component.
		gtag = vi.fn();
		(window as unknown as Record<string, unknown>).gtag = gtag;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete (window as unknown as Record<string, unknown>).gtag;
	});

	it('always renders the gtag script (for Google detection)', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(getByTestId('script')).toBeDefined();
	});

	it('sets Consent Mode default to denied in the init script', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		const init = getByTestId('gtag-init').textContent ?? '';
		expect(init).toContain("gtag('consent', 'default'");
		expect(init).toContain("analytics_storage: 'denied'");
	});

	it('updates Consent Mode to denied when consent is not given', () => {
		render(<ConsentedAnalytics />);
		expect(gtag).toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'denied',
		});
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

	it('updates Consent Mode to granted when consent is granted', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);

		render(<ConsentedAnalytics />);
		expect(gtag).toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});
	});

	// Vercel Analytics is cookieless and disclosed as running for everyone
	// (/privacy section 6). It used to be consent-gated, which hid almost every
	// visitor arriving from an outreach email: they never touch the banner.
	it('renders Vercel Analytics with no stored consent at all', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('vercel-analytics')).toBeDefined();
	});

	it('renders Vercel Analytics but keeps GA denied when consent is false', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: false }),
		);

		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('vercel-analytics')).toBeDefined();
		expect(gtag).toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'denied',
		});
		expect(gtag).not.toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});
	});

	it('keeps GA denied when stored JSON is invalid', () => {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '{bad json');

		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(gtag).not.toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});
	});

	it('responds to cookie-consent-changed events', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(gtag).not.toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});

		// Grant consent via localStorage + event
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);

		act(() => {
			window.dispatchEvent(new Event('cookie-consent-changed'));
		});

		expect(getByTestId('gtag-init')).toBeDefined();
		expect(gtag).toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});
	});
});
