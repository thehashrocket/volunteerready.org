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

	// Consent Mode v2: gtag loads with analytics storage denied by default, so
	// it still sends a cookieless ping (which Google's tag detection requires)
	// without setting cookies or collecting analytics. When the user grants
	// consent we upgrade the state, which unlocks full measurement.
	useEffect(() => {
		const w = window as unknown as {
			gtag?: (...args: unknown[]) => void;
		};
		w.gtag?.('consent', 'update', {
			analytics_storage: enabled ? 'granted' : 'denied',
		});
	}, [enabled]);

	return (
		<>
			{/* Load gtag unconditionally so Google can detect the tag. Consent Mode
			    (set in gtag-init below) keeps analytics storage denied until the
			    user opts in, so no cookies are set and no analytics data is
			    collected before consent — only a cookieless detection ping. */}
			<Script
				src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
				strategy="afterInteractive"
			/>
			<Script id="gtag-init" strategy="afterInteractive">
				{`
					window.dataLayer = window.dataLayer || [];
					function gtag(){dataLayer.push(arguments);}
					gtag('consent', 'default', {
						ad_storage: 'denied',
						ad_user_data: 'denied',
						ad_personalization: 'denied',
						analytics_storage: 'denied',
					});
					gtag('js', new Date());
					gtag('config', '${GA_MEASUREMENT_ID}');
				`}
			</Script>
			{enabled && <Analytics />}
		</>
	);
}
