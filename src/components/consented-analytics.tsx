'use client';

import { Analytics } from '@vercel/analytics/next';
import { useEffect, useState } from 'react';
import { COOKIE_CONSENT_STORAGE_KEY } from '@/components/cookie-consent-banner';

export function ConsentedAnalytics() {
	const [enabled, setEnabled] = useState(false);

	useEffect(() => {
		function check() {
			try {
				const stored = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
				if (stored) {
					const prefs = JSON.parse(stored);
					setEnabled(prefs.analytics === true);
				} else {
					setEnabled(false);
				}
			} catch {
				setEnabled(false);
			}
		}

		check();

		// Re-check when consent changes
		window.addEventListener('cookie-consent-changed', check);
		return () => window.removeEventListener('cookie-consent-changed', check);
	}, []);

	if (!enabled) return null;
	return <Analytics />;
}
