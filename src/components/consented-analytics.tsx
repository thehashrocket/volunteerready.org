'use client';

import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { COOKIE_CONSENT_STORAGE_KEY } from '@/components/cookie-consent-banner';
import { trackBookingLinkClick } from '@/lib/analytics';

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

	// One listener covers every "Book a setup call" link, most of which are
	// server-rendered. trackEvent itself checks consent.
	useEffect(() => {
		document.addEventListener('click', trackBookingLinkClick);
		return () => document.removeEventListener('click', trackBookingLinkClick);
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
				// lazyOnload: gtag.js is ~150 KB and was on mobile Lighthouse's
				// unused-JS list. The inline init below still runs early, so
				// dataLayer (consent default first) queues until it arrives.
				strategy="lazyOnload"
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
			{/* Vercel Analytics sets no cookies and stores no personal identifiers,
			    so it runs for every visitor (disclosed in /privacy, section 6).
			    Google Analytics above stays consent-gated. Gating this one too
			    hid nearly every visitor from an outreach email, since most never
			    touch the cookie banner. */}
			<Analytics />
		</>
	);
}
