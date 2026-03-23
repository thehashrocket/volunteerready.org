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

	// Disable Google Analytics in-memory when consent is revoked
	useEffect(() => {
		(window as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] =
			!enabled;
	}, [enabled]);

	if (!enabled) return null;
	return (
		<>
			<Script
				src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
				strategy="afterInteractive"
			/>
			<Script id="gtag-init" strategy="afterInteractive">
				{`
					window.dataLayer = window.dataLayer || [];
					function gtag(){dataLayer.push(arguments);}
					gtag('js', new Date());
					gtag('config', '${GA_MEASUREMENT_ID}');
				`}
			</Script>
			<Analytics />
		</>
	);
}
