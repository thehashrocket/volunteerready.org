'use client';

import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { COOKIE_CONSENT_STORAGE_KEY } from '@/components/cookie-consent-banner';

const GA_MEASUREMENT_ID = 'G-8EYQH68KXC';

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

	// Gate data collection via the ga-disable flag — the script always loads
	// so Google's detection tool can find it, but no hits are sent until
	// the user grants analytics consent.
	useEffect(() => {
		(window as unknown as Record<string, unknown>)[
			`ga-disable-${GA_MEASUREMENT_ID}`
		] = !enabled;
	}, [enabled]);

	return (
		<>
			{/* Load gtag unconditionally so Google can detect the tag.
			    The ga-disable-* flag above prevents data collection until consent. */}
			<Script
				src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
				strategy="afterInteractive"
			/>
			<Script id="gtag-init" strategy="afterInteractive">
				{`
					window['ga-disable-${GA_MEASUREMENT_ID}'] = true;
					window.dataLayer = window.dataLayer || [];
					function gtag(){dataLayer.push(arguments);}
					gtag('js', new Date());
					gtag('config', '${GA_MEASUREMENT_ID}');
				`}
			</Script>
			{enabled && <Analytics />}
		</>
	);
}
