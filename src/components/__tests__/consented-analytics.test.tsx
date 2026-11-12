// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/script to render a simple span with the src/id
vi.mock('next/script', () => ({
	default: ({
		src,
		id,
		children,
	}: {
		src?: string;
		id?: string;
		children?: string;
	}) => (
		<span data-testid={id ?? 'script'} data-src={src}>
			{children}
		</span>
	),
}));

// Mock @vercel/analytics/next, keeping the props it was given.
const analyticsProps = vi.hoisted(() => ({
	last: undefined as undefined | { beforeSend?: unknown },
}));
vi.mock('@vercel/analytics/next', () => ({
	Analytics: (props: { beforeSend?: unknown }) => {
		analyticsProps.last = props;
		return <span data-testid="vercel-analytics" />;
	},
}));

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { isSecretUrl, scrubSecrets } from '@/lib/sentry-url-scrub';
import { ConsentedAnalytics, dropSecretUrls } from '../consented-analytics';
import { COOKIE_CONSENT_STORAGE_KEY } from '../cookie-consent-banner';

describe('ConsentedAnalytics', () => {
	let gtag: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		localStorage.clear();
		nav.pathname = '/';
		// gtag is normally defined by the inline init script; stub it so we can
		// assert the Consent Mode update calls fired by the component. In the
		// browser that script has also configured GA by the time the component's
		// effects run (the Script child's effect runs first).
		gtag = vi.fn();
		(window as unknown as Record<string, unknown>).gtag = gtag;
		(window as unknown as Record<string, unknown>).vrGaConfigured = true;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete (window as unknown as Record<string, unknown>).gtag;
		delete (window as unknown as Record<string, unknown>).vrGaConfigured;
	});

	it('always renders the gtag script (for Google detection)', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(getByTestId('script')).toBeDefined();
	});

	// Runs the real inline init script and returns the analytics_storage value
	// of its consent default. config sends page_view right after this default,
	// before any React effect, so the default is what the first hit carries.
	function runInitScriptEntries(init: string): unknown[][] {
		const w = window as unknown as { dataLayer?: unknown[] };
		delete w.dataLayer;
		new Function(init)();
		return (w.dataLayer ?? []).map((args) =>
			Array.from(args as ArrayLike<unknown>),
		);
	}

	function consentDefault(entries: unknown[][]): Record<string, unknown> {
		const entry = entries.find((a) => a[0] === 'consent' && a[1] === 'default');
		return (entry?.[2] ?? {}) as Record<string, unknown>;
	}

	function runInitScript(init: string): unknown {
		return consentDefault(runInitScriptEntries(init)).analytics_storage;
	}

	// Value: protects=ads consent is never granted without a separate ads choice (privacy promise); fails_when=the vrAnalyticsGranted ternary is applied to the ad_* fields or they are dropped; why_new=the removed string-match test covered this, nothing asserted ad_* after it; seam=none; no_claim=does not prove gtag.js honours the flags
	it('keeps every ad_* consent denied even when analytics is granted', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);
		const { getByTestId } = render(<ConsentedAnalytics />);
		const consent = consentDefault(
			runInitScriptEntries(getByTestId('gtag-init').textContent ?? ''),
		);
		expect(consent.analytics_storage).toBe('granted');
		expect(consent.ad_storage).toBe('denied');
		expect(consent.ad_user_data).toBe('denied');
		expect(consent.ad_personalization).toBe('denied');
	});

	// Value: protects=the first page_view carries the stored consent state, the bug this branch fixes; fails_when=gtag('config') is queued before the consent default; why_new=runInitScript uses find() and ignores order; seam=none; no_claim=does not observe the network hit
	it('queues the consent default before config sends page_view', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		const entries = runInitScriptEntries(
			getByTestId('gtag-init').textContent ?? '',
		);
		const defaultIdx = entries.findIndex(
			(a) => a[0] === 'consent' && a[1] === 'default',
		);
		const configIdx = entries.findIndex((a) => a[0] === 'config');
		expect(defaultIdx).toBeGreaterThanOrEqual(0);
		expect(configIdx).toBeGreaterThan(defaultIdx);
	});

	// Value: protects=visitors with blocked storage (Safari private mode, strict settings) still get gtag initialised, with analytics denied; fails_when=the try/catch is removed or narrowed so getItem sits outside it, which aborts the whole init including config; why_new=only the JSON.parse throw path was tested; seam=none; no_claim=does not prove behaviour in a real Safari
	it('defaults analytics consent to denied when localStorage throws', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		const init = getByTestId('gtag-init').textContent ?? '';
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('SecurityError');
		});
		let entries: unknown[][] = [];
		expect(() => {
			entries = runInitScriptEntries(init);
		}).not.toThrow();
		expect(consentDefault(entries).analytics_storage).toBe('denied');
		expect(entries.some((a) => a[0] === 'config')).toBe(true);
	});

	it('defaults analytics consent to denied with no stored choice', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(runInitScript(getByTestId('gtag-init').textContent ?? '')).toBe(
			'denied',
		);
	});

	it('defaults analytics consent to granted when the visitor already accepted', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);
		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(runInitScript(getByTestId('gtag-init').textContent ?? '')).toBe(
			'granted',
		);
	});

	it('defaults analytics consent to denied when the visitor declined or storage is corrupt', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		const init = getByTestId('gtag-init').textContent ?? '';
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: false }),
		);
		expect(runInitScript(init)).toBe('denied');
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '{bad json');
		expect(runInitScript(init)).toBe('denied');
	});

	it('updates Consent Mode to denied when consent is not given', () => {
		render(<ConsentedAnalytics />);
		expect(gtag).toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'denied',
		});
	});

	it('renders scripts when analytics consent is true', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);

		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(getByTestId('vercel-analytics')).toBeDefined();
	});

	it('updates Consent Mode to granted when consent is granted', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);

		render(<ConsentedAnalytics />);
		expect(gtag).toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});
	});

	// Vercel Analytics is cookieless and disclosed as running for everyone
	// (/privacy section 6). It used to be consent-gated, which hid almost every
	// visitor arriving from an outreach email: they never touch the banner.
	it('renders Vercel Analytics with no stored consent at all', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('vercel-analytics')).toBeDefined();
	});

	it('renders Vercel Analytics but keeps GA denied when consent is false', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: false }),
		);

		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('vercel-analytics')).toBeDefined();
		expect(gtag).toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'denied',
		});
		expect(gtag).not.toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});
	});

	it('keeps GA denied when stored JSON is invalid', () => {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '{bad json');

		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(gtag).not.toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});
	});

	it('responds to cookie-consent-changed events', () => {
		const { getByTestId } = render(<ConsentedAnalytics />);
		expect(getByTestId('gtag-init')).toBeDefined();
		expect(gtag).not.toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});

		// Grant consent via localStorage + event
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);

		act(() => {
			window.dispatchEvent(new Event('cookie-consent-changed'));
		});

		expect(getByTestId('gtag-init')).toBeDefined();
		expect(gtag).toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});
	});

	function grantViaBanner() {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);
		act(() => {
			window.dispatchEvent(new Event('cookie-consent-changed'));
		});
	}

	function pageViewCalls() {
		return gtag.mock.calls.filter(
			(c) => c[0] === 'event' && c[1] === 'page_view',
		);
	}

	// Value: protects=the page a visitor accepts cookies on is counted in GA;
	// fails_when=the resend is removed, or sent before consent is granted;
	// why_new=the page's first page_view went out denied and GA4 drops it;
	// seam=none; no_claim=gtag.js stubbed, not the real network hit
	it('resends page_view after consent is granted when a visitor accepts', () => {
		render(<ConsentedAnalytics />);
		expect(pageViewCalls()).toHaveLength(0);

		grantViaBanner();

		expect(pageViewCalls()).toHaveLength(1);
		const grantAt = gtag.mock.calls.findIndex(
			(c) =>
				c[0] === 'consent' &&
				c[1] === 'update' &&
				(c[2] as { analytics_storage?: string }).analytics_storage ===
					'granted',
		);
		const viewAt = gtag.mock.calls.findIndex(
			(c) => c[0] === 'event' && c[1] === 'page_view',
		);
		expect(grantAt).toBeGreaterThanOrEqual(0);
		expect(grantAt).toBeLessThan(viewAt);
	});

	// Value: protects=no double-counted page views; fails_when=page_view is
	// sent on every consent event or on mount; why_new=the resend must fire
	// only on a denied -> granted change; seam=none; no_claim=gtag.js stubbed
	it('does not resend page_view when consent was already granted or is declined', () => {
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: true }),
		);
		render(<ConsentedAnalytics />);
		grantViaBanner();
		expect(pageViewCalls()).toHaveLength(0);

		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: false }),
		);
		act(() => {
			window.dispatchEvent(new Event('cookie-consent-changed'));
		});
		expect(pageViewCalls()).toHaveLength(0);
	});

	// Value: protects=one page counted once in GA; fails_when=the resend is
	// keyed only on the last consent state, so grant -> revoke -> grant on the
	// same page resends twice; why_new=other tests start from one state only;
	// seam=none; no_claim=gtag.js stubbed
	it('resends page_view only once per page across revoke and re-grant', () => {
		render(<ConsentedAnalytics />);
		grantViaBanner();
		localStorage.setItem(
			COOKIE_CONSENT_STORAGE_KEY,
			JSON.stringify({ essential: true, analytics: false }),
		);
		act(() => {
			window.dispatchEvent(new Event('cookie-consent-changed'));
		});
		grantViaBanner();
		expect(pageViewCalls()).toHaveLength(1);
	});

	// Value: protects=a visitor's Accept still applies when storage is blocked
	// (Safari private mode); fails_when=the listener re-reads localStorage
	// instead of the banner event's detail; why_new=other consent-change tests
	// write storage first; seam=none; no_claim=gtag.js stubbed
	it('applies Accept from the banner event when storage is blocked', () => {
		render(<ConsentedAnalytics />);
		act(() => {
			window.dispatchEvent(
				new CustomEvent('cookie-consent-changed', {
					detail: { essential: true, analytics: true },
				}),
			);
		});
		expect(gtag).toHaveBeenCalledWith('consent', 'update', {
			analytics_storage: 'granted',
		});
		expect(pageViewCalls()).toHaveLength(1);
	});

	describe('secret URLs', () => {
		const SECRET_PAGES = [
			'/credentials/claim/abc123',
			'/invite/abc123',
			'/invite/company/abc123',
			'/apply/status?token=t0k3n',
			'/login?callbackUrl=%2Finvite%2Fcompany%2Fabc123',
		];
		const SAFE_PAGES = ['/', '/pricing', '/invite/company', '/login'];

		afterEach(() => {
			window.history.replaceState({}, '', '/');
			Reflect.deleteProperty(document, 'referrer');
		});

		function initScript(): string {
			const { getByTestId } = render(<ConsentedAnalytics />);
			return getByTestId('gtag-init').textContent ?? '';
		}

		function configCalls(entries: unknown[][]) {
			return entries.filter((a) => a[0] === 'config');
		}

		// Value: protects=the inline copy of the rules matches Sentry's source
		// of truth; fails_when=the data export or the inline rebuild drifts from
		// isSecretUrl/scrubSecrets; why_new=the inline script cannot import the
		// module; seam=none; no_claim=covers these URLs, not every pattern
		it('decides and masks URLs exactly as sentry-url-scrub does', () => {
			const inline = new Function(
				`${initScript()}; return { vrIsSecret, vrScrub };`,
			)() as {
				vrIsSecret: (u: string) => boolean;
				vrScrub: (u: string) => string;
			};
			for (const path of [...SECRET_PAGES, ...SAFE_PAGES]) {
				const url = `https://www.volunteerready.org${path}`;
				expect(inline.vrIsSecret(url), url).toBe(isSecretUrl(url));
				expect(inline.vrScrub(url), url).toBe(scrubSecrets(url));
			}
		});

		// Value: protects=no GA hit (not even the cookieless ping) carries a
		// token URL; fails_when=config runs on a secret page; why_new=GA sent the
		// full URL on every page before; seam=none; no_claim=gtag.js history
		// page_views after an in-app navigation INTO a secret URL
		it('never configures GA on a page whose URL carries a secret', () => {
			const init = initScript();
			for (const path of SECRET_PAGES) {
				window.history.replaceState({}, '', path);
				expect(configCalls(runInitScriptEntries(init)), path).toHaveLength(0);
			}
			for (const path of SAFE_PAGES) {
				window.history.replaceState({}, '', path);
				expect(configCalls(runInitScriptEntries(init)), path).toHaveLength(1);
			}
		});

		// Value: protects=a token in the previous page's URL does not reach GA as
		// the referrer; fails_when=config passes document.referrer through
		// unmasked; why_new=no test covered referrers; seam=none; no_claim=none
		// beyond protects
		it('masks a secret referrer and leaves a safe one to GA', () => {
			const init = initScript();
			Object.defineProperty(document, 'referrer', {
				configurable: true,
				value: 'https://www.volunteerready.org/credentials/claim/abc123',
			});
			const [masked] = configCalls(runInitScriptEntries(init));
			const referrer = (masked[2] as { page_referrer?: string }).page_referrer;
			expect(referrer).toBe(
				'https://www.volunteerready.org/credentials/claim/[Filtered]',
			);

			Object.defineProperty(document, 'referrer', {
				configurable: true,
				value: 'https://www.google.com/',
			});
			const [plain] = configCalls(runInitScriptEntries(init));
			expect(plain[2]).toEqual({});
		});

		// Value: protects=Accept on a token page sends no page_view; fails_when=
		// the resend ignores the secret-URL rule; why_new=resend tests run on
		// '/'; seam=none; no_claim=gtag.js stubbed
		it('does not resend page_view on a secret page', () => {
			window.history.replaceState({}, '', '/credentials/claim/abc123');
			render(<ConsentedAnalytics />);
			grantViaBanner();
			expect(pageViewCalls()).toHaveLength(0);
		});

		function gaConfigCalls() {
			return gtag.mock.calls.filter((c) => c[0] === 'config');
		}

		// Value: protects=a visit that starts on a claim or invite link is
		// counted from the first safe page on; fails_when=GA is only ever
		// configured by the full-load init script; why_new=no test moved between
		// pages; seam=none; no_claim=GA's own history page_views (gtag.js stubbed)
		it('configures GA once on the first safe page after a token page', () => {
			delete (window as unknown as Record<string, unknown>).vrGaConfigured;
			window.history.replaceState({}, '', '/credentials/claim/abc123');
			nav.pathname = '/credentials/claim/abc123';
			const { rerender } = render(<ConsentedAnalytics />);
			expect(gaConfigCalls()).toHaveLength(0);

			window.history.replaceState({}, '', '/app');
			nav.pathname = '/app';
			rerender(<ConsentedAnalytics />);
			expect(gaConfigCalls()).toHaveLength(1);
			expect(gaConfigCalls()[0][1]).toBe('G-8EYQH68KXC');

			window.history.replaceState({}, '', '/app/shifts');
			nav.pathname = '/app/shifts';
			rerender(<ConsentedAnalytics />);
			expect(gaConfigCalls()).toHaveLength(1);
		});

		// Value: protects=no second GA config (double page_view) on a normal
		// load; fails_when=the route hook ignores the init script's flag;
		// why_new=the hook is new; seam=none; no_claim=gtag.js stubbed
		it('leaves GA alone when the init script already configured it', () => {
			render(<ConsentedAnalytics />);
			expect(gaConfigCalls()).toHaveLength(0);
		});

		// Value: protects=token URLs never reach Vercel Analytics, other URLs
		// are masked like Sentry's; fails_when=beforeSend is not wired or lets
		// a secret page through; why_new=Vercel Analytics had no beforeSend;
		// seam=none; no_claim=the Vercel script itself is mocked
		it('drops token pages from Vercel Analytics and masks other URLs', () => {
			render(<ConsentedAnalytics />);
			expect(analyticsProps.last?.beforeSend).toBe(dropSecretUrls);

			const base = 'https://www.volunteerready.org';
			for (const path of SECRET_PAGES) {
				expect(
					dropSecretUrls({ type: 'pageview', url: `${base}${path}` }),
					path,
				).toBeNull();
			}
			expect(
				dropSecretUrls({ type: 'pageview', url: `${base}/pricing` }),
			).toEqual({ type: 'pageview', url: `${base}/pricing` });
			expect(
				dropSecretUrls({ type: 'pageview', url: `${base}/app?state=open` }),
			).toEqual({ type: 'pageview', url: `${base}/app?state=[Filtered]` });
		});
	});
});
