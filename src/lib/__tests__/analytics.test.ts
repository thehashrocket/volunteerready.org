// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from '../analytics';

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
			'cookie-consent',
			JSON.stringify({ analytics: true }),
		);
		trackEvent('test_event', { location_slug: 'stockton' });
		expect(gtagMock).toHaveBeenCalledWith('event', 'test_event', {
			location_slug: 'stockton',
		});
	});

	it('does not fire gtag when analytics consent is false', () => {
		localStorage.setItem(
			'cookie-consent',
			JSON.stringify({ analytics: false }),
		);
		trackEvent('test_event');
		expect(gtagMock).not.toHaveBeenCalled();
	});

	it('handles corrupted localStorage JSON gracefully', () => {
		localStorage.setItem('cookie-consent', 'not-json');
		trackEvent('test_event');
		expect(gtagMock).not.toHaveBeenCalled();
	});

	it('does not fire when gtag is not available', () => {
		localStorage.setItem(
			'cookie-consent',
			JSON.stringify({ analytics: true }),
		);
		delete (window as unknown as Record<string, unknown>).gtag;
		trackEvent('test_event');
		// Should not throw
	});
});
