import { track } from '@vercel/analytics';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';

declare global {
	interface Window {
		gtag?: (...args: unknown[]) => void;
	}
}

/**
 * Consent-aware analytics event tracking.
 * Only fires gtag events when the user has consented to analytics cookies.
 * Reads the same storage key the cookie banner writes (a hand-typed
 * 'cookie-consent' here once meant no event ever fired).
 */
export function trackEvent(
	name: string,
	params?: Record<string, string | number>,
) {
	if (typeof window === 'undefined') return;
	try {
		const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
		if (!raw) return;
		const prefs = JSON.parse(raw);
		if (prefs.analytics && typeof window.gtag === 'function') {
			window.gtag('event', name, params);
		}
	} catch {
		// silently ignore — consent or gtag not available
	}
}

/**
 * The few funnel events worth counting for every visitor, consent or not.
 * Sent only to Vercel Analytics, which sets no cookies and stores no personal
 * identifiers (disclosed in /privacy, section 6). Most visitors arriving from
 * an outreach email never touch the cookie banner, so the consent-gated GA
 * copy of these events alone undercounts them close to zero.
 *
 * Keep this list short and the params free of anything about the person:
 * a path, never a name, email, search text or org a volunteer belongs to.
 */
export type AnonymousEventName = 'walkthrough_play' | 'book_setup_call';

export function trackAnonymousEvent(
	name: AnonymousEventName,
	params: { page_path: string },
) {
	if (typeof window === 'undefined') return;
	try {
		track(name, params);
	} catch {
		// analytics must never break the page
	}
}

/**
 * Fires `book_setup_call` for a click on any link to the founder booking page.
 * Installed once as a document-level listener (ConsentedAnalytics) so the
 * many server-rendered "Book a setup call" CTAs need no client code each.
 */
export function trackBookingLinkClick(event: MouseEvent): void {
	const target = event.target;
	if (!(target instanceof Element)) return;
	const link = target.closest('a[href]');
	if (!link) return;
	const href = link.getAttribute('href') ?? '';
	if (!href.startsWith(FOUNDER_BOOKING_URL)) return;
	const params = { page_path: window.location.pathname };
	trackEvent('book_setup_call', params);
	trackAnonymousEvent('book_setup_call', params);
}
