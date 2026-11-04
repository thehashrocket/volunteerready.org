// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';
import { trackBookingLinkClick, trackEvent } from '../analytics';

describe('trackEvent', () => {
	const gtagMock = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		(window as unknown as Record<string, unknown>).gtag = gtagMock;
	});

	afterEach(() => {
		delete (window as unknown as Record<string, unknown>).gtag;
	});

	it('does nothing when no consent is stored', () => {
		trackEvent('test_event');
		expect(gtagMock).not.toHaveBeenCalled();
	});

	it('fires gtag when analytics consent is granted', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ analytics: true }),
		);
		trackEvent('test_event', { location_slug: 'stockton' });
		expect(gtagMock).toHaveBeenCalledWith('event', 'test_event', {
			location_slug: 'stockton',
		});
	});

	it('does not fire gtag when analytics consent is false', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ analytics: false }),
		);
		trackEvent('test_event');
		expect(gtagMock).not.toHaveBeenCalled();
	});

	it('handles corrupted localStorage JSON gracefully', () => {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'not-json');
		trackEvent('test_event');
		expect(gtagMock).not.toHaveBeenCalled();
	});

	it('does not fire when gtag is not available', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ analytics: true }),
		);
		delete (window as unknown as Record<string, unknown>).gtag;
		trackEvent('test_event');
		// Should not throw
	});

	it('ignores the old hand-typed key the banner never wrote', () => {
		localStorage.setItem('cookie-consent', JSON.stringify({ analytics: true }));
		trackEvent('test_event');
		expect(gtagMock).not.toHaveBeenCalled();
	});
});

describe('trackBookingLinkClick', () => {
	const gtagMock = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ analytics: true }),
		);
		(window as unknown as Record<string, unknown>).gtag = gtagMock;
	});

	afterEach(() => {
		localStorage.clear();
		delete (window as unknown as Record<string, unknown>).gtag;
	});

	function clickInside(href: string) {
		document.body.innerHTML = `<a href="${href}"><span id="inner">Book</span></a>`;
		const inner = document.getElementById('inner') as HTMLElement;
		// Same wiring as ConsentedAnalytics: one document-level listener.
		document.addEventListener('click', trackBookingLinkClick);
		// jsdom does not navigate, so clicking the link is safe.
		inner.click();
		document.removeEventListener('click', trackBookingLinkClick);
	}

	it('tracks a click anywhere inside a booking link', () => {
		clickInside(FOUNDER_BOOKING_URL);
		expect(gtagMock).toHaveBeenCalledTimes(1);
		expect(gtagMock).toHaveBeenCalledWith('event', 'book_setup_call', {
			page_path: window.location.pathname,
		});
	});

	it('ignores other links', () => {
		clickInside('/pricing');
		expect(gtagMock).not.toHaveBeenCalled();
	});
});
