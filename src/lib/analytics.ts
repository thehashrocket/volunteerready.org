declare global {
	interface Window {
		gtag?: (...args: unknown[]) => void;
	}
}

/**
 * Consent-aware analytics event tracking.
 * Only fires gtag events when the user has consented to analytics cookies.
 */
export function trackEvent(
	name: string,
	params?: Record<string, string | number>,
) {
	if (typeof window === 'undefined') return;
	try {
		const raw = localStorage.getItem('cookie-consent');
		if (!raw) return;
		const prefs = JSON.parse(raw);
		if (prefs.analytics && typeof window.gtag === 'function') {
			window.gtag('event', name, params);
		}
	} catch {
		// silently ignore — consent or gtag not available
	}
}
