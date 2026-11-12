'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { COOKIE_CONSENT_STORAGE_KEY } from '@/components/cookie-consent-banner';
import { trackBookingLinkClick } from '@/lib/analytics';
import {
	isSecretUrl,
	SECRET_URL_RULES,
	scrubSecrets,
} from '@/lib/sentry-url-scrub';

const GA_MEASUREMENT_ID = 'G-8EYQH68KXC';

// `<` escaped so the data can never close the inline <script>.
const SECRET_URL_RULES_JSON = JSON.stringify(SECRET_URL_RULES).replace(
	/</g,
	'\\u003c',
);

type GtagWindow = {
	gtag?: (...args: unknown[]) => void;
	// Set by gtag-init once it has configured GA for this document.
	vrGaConfigured?: boolean;
};

/**
 * Vercel Analytics records every visitor's page URL. A page whose URL carries
 * a token is not recorded at all; anything else is masked with the same rules
 * as Sentry and GA.
 */
export function dropSecretUrls(event: BeforeSendEvent): BeforeSendEvent | null {
	if (isSecretUrl(event.url)) return null;
	return { ...event, url: scrubSecrets(event.url) };
}

export function ConsentedAnalytics() {
	const [enabled, setEnabled] = useState(false);
	const pathname = usePathname();

	// gtag-init skips GA on a page whose URL carries a token. When the visitor
	// then moves inside the app to a safe page (a claim link landing on the
	// dashboard), configure GA there, so the rest of the visit is counted.
	// Known gap: an in-app navigation INTO a token page after GA is configured
	// would still be tracked by GA's own history page_view. Nothing in the app
	// links to a token page; they are opened from email, as full page loads.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs per route change; reads the live URL
	useEffect(() => {
		const w = window as unknown as GtagWindow;
		if (!w.gtag || w.vrGaConfigured || isSecretUrl(window.location.href)) {
			return;
		}
		const config: Record<string, string> = {};
		const referrer = document.referrer;
		if (referrer && scrubSecrets(referrer) !== referrer) {
			config.page_referrer = scrubSecrets(referrer);
		}
		w.gtag('config', GA_MEASUREMENT_ID, config);
		w.vrGaConfigured = true;
	}, [pathname]);

	useEffect(() => {
		function readConsent(): boolean {
			try {
				const stored = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
				return stored ? JSON.parse(stored).analytics === true : false;
			} catch {
				return false;
			}
		}

		let granted = readConsent();
		setEnabled(granted);

		// Re-check when consent changes. The page a visitor accepts on already
		// sent its page_view while consent was denied, and GA4 leaves that hit
		// out of reports; granting consent does not resend it. So on a
		// denied -> granted change, grant first, then send this page's view again
		// (once per page: revoking and re-granting must not count it twice).
		let resentFor: string | null = null;
		function onConsentChanged(event: Event) {
			// The banner's event carries the choice. Prefer it: when storage is
			// blocked (Safari private mode) the write fails but the choice still
			// applies for this page, and re-reading storage would drop it.
			const detail = (event as CustomEvent<{ analytics?: unknown } | null>)
				.detail;
			const next =
				typeof detail?.analytics === 'boolean'
					? detail.analytics
					: readConsent();
			const page = window.location.pathname + window.location.search;
			// A page whose URL carries a secret never configured GA (see
			// gtag-init), so there is no view to resend.
			if (
				next &&
				!granted &&
				resentFor !== page &&
				!isSecretUrl(window.location.href)
			) {
				const w = window as unknown as {
					gtag?: (...args: unknown[]) => void;
				};
				w.gtag?.('consent', 'update', { analytics_storage: 'granted' });
				w.gtag?.('event', 'page_view');
				resentFor = page;
			}
			granted = next;
			setEnabled(next);
		}

		window.addEventListener('cookie-consent-changed', onConsentChanged);
		return () =>
			window.removeEventListener('cookie-consent-changed', onConsentChanged);
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
			{/* The consent default must reflect a visitor's STORED choice: config
			    sends page_view immediately, before the React effect above can run
			    its update, so a hard-coded 'denied' default made every page_view a
			    cookieless ping (gcs=G100) that GA4 leaves out of its reports, even
			    for visitors who had accepted analytics cookies.
			    Every GA hit carries the page URL, and invite, claim and status
			    links carry live tokens. On such a page GA is not configured, so
			    nothing is sent (the route hook above configures it on the next
			    safe page); elsewhere a secret referrer is masked. The rules
			    are Sentry's (src/lib/sentry-url-scrub.ts), passed in as data. */}
			<Script id="gtag-init" strategy="afterInteractive">
				{`
					window.dataLayer = window.dataLayer || [];
					function gtag(){dataLayer.push(arguments);}
					var vrRules = ${SECRET_URL_RULES_JSON};
					function vrRe(r){return new RegExp(r[0], r[1]);}
					function vrIsSecret(u){
						for (var i = 0; i < vrRules.paths.length; i++) {
							if (vrRe(vrRules.paths[i]).test(u)) return true;
						}
						return vrRe(vrRules.pageQuery).test(u);
					}
					function vrScrub(u){
						for (var i = 0; i < vrRules.paths.length; i++) {
							u = u.replace(vrRe(vrRules.paths[i]), '$1' + vrRules.filtered);
						}
						return u.replace(vrRe(vrRules.query), '$1$2=' + vrRules.filtered);
					}
					var vrAnalyticsGranted = false;
					try {
						var vrConsent = JSON.parse(localStorage.getItem(${JSON.stringify(COOKIE_CONSENT_STORAGE_KEY)}) || 'null');
						vrAnalyticsGranted = !!vrConsent && vrConsent.analytics === true;
					} catch (e) {}
					gtag('consent', 'default', {
						ad_storage: 'denied',
						ad_user_data: 'denied',
						ad_personalization: 'denied',
						analytics_storage: vrAnalyticsGranted ? 'granted' : 'denied',
					});
					gtag('js', new Date());
					if (!vrIsSecret(location.href)) {
						var vrConfig = {};
						var vrRef = document.referrer;
						if (vrRef && vrScrub(vrRef) !== vrRef) vrConfig.page_referrer = vrScrub(vrRef);
						gtag('config', '${GA_MEASUREMENT_ID}', vrConfig);
						window.vrGaConfigured = true;
					}
				`}
			</Script>
			{/* Vercel Analytics sets no cookies and stores no personal identifiers,
			    so it runs for every visitor (disclosed in /privacy, section 6).
			    Google Analytics above stays consent-gated. Gating this one too
			    hid nearly every visitor from an outreach email, since most never
			    touch the cookie banner. */}
			<Analytics beforeSend={dropSecretUrls} />
		</>
	);
}
