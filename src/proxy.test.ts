import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

/**
 * proxy.ts is the signed-out gate on /app/**. It had no tests until the
 * Next.js 16.2.12 security bump, one of whose advisories
 * (GHSA-6gpp-xcg3-4w24) is a middleware/proxy bypass in App Router apps.
 *
 * The bypass itself lives in the framework and cannot be reproduced from here —
 * what these tests pin is OUR half of the contract, so a framework bump that
 * changes how NextRequest reports pathname or cookies fails loudly instead of
 * quietly opening every authenticated route to anonymous traffic.
 */

function request(url: string, cookie?: string): NextRequest {
	return new NextRequest(url, {
		headers: cookie ? { cookie } : undefined,
	});
}

/** NextResponse.next() marks itself with this header; a redirect does not. */
function isPassThrough(res: Response): boolean {
	return res.headers.get('x-middleware-next') === '1';
}

describe('proxy', () => {
	describe('paths outside /app are not gated', () => {
		it.each([
			'http://localhost/',
			'http://localhost/opportunities',
			'http://localhost/login',
			'http://localhost/api/auth/callback/email',
			'http://localhost/stories/helping-hands',
		])('passes through %s untouched', (url) => {
			const res = proxy(request(url));

			expect(isPassThrough(res)).toBe(true);
			expect(res.headers.get('location')).toBeNull();
		});

		it('does not stamp x-pathname on a non-/app request', () => {
			// The header is only meaningful for the authenticated shell; leaking it
			// onto public responses would be a behaviour change, not a no-op.
			const res = proxy(request('http://localhost/opportunities'));

			expect(res.headers.get('x-pathname')).toBeNull();
		});

		// ---------------------------------------------------------------------
		// The two gates DISAGREE, and one live public route sits in the gap.
		//
		//   config.matcher       '/app/:path*'        → segment match
		//   proxy() internally   startsWith('/app')   → prefix match
		//
		// `/apply/[orgSlug]` is the public volunteer application flow — a route
		// anonymous users are *supposed* to reach, and the platform's main
		// conversion path. The matcher is the only thing keeping proxy() away
		// from it: `/apply/x` has first segment `apply`, which `/app/:path*`
		// does not match. But if proxy() is ever called for it — a widened
		// matcher, a Next change in how matchers resolve, someone adding
		// '/apply/:path*' for an unrelated reason — the prefix test inside
		// redirects every applicant to /login.
		//
		// These tests pin the disagreement rather than paper over it, so the
		// day someone touches the matcher this is a red test naming the exact
		// route at risk instead of a support ticket about applications
		// disappearing. Fixing it properly means matching on a segment
		// boundary (`/app` or `/app/`), which is a behaviour change and is
		// deliberately not bundled into a security-patch PR. Tracked as #188.
		// ---------------------------------------------------------------------
		it.each([
			['http://localhost/apply/helping-hands', 'the public apply flow'],
			['http://localhost/application-status', 'a hypothetical sibling'],
		])('would gate %s if the matcher ever reached it (%s)', (url) => {
			const res = proxy(request(url));

			expect(isPassThrough(res)).toBe(false);
			expect(res.status).toBe(307);
		});

		it('is kept away from /apply today by the matcher, not by proxy()', () => {
			// The load-bearing half of the pair above. If this ever changes,
			// `/apply/**` starts being evaluated by the prefix test.
			//
			// Verified empirically rather than assumed: the compiled matcher in
			// `.next/server/functions-config-manifest.json` after a 16.2.12 build
			// is
			//   ^(?:\/(_next\/data\/[^/]{1,}))?\/app(?:\/(...))?...[\/#\?]?$
			// which matches /app, /app/volunteers and /app/company/x/esg, and does
			// NOT match /apply, /apply/helping-hands or /application-status. That
			// artifact is a build output and so cannot be asserted from CI (CI does
			// not run `next build`), which is why the assertion here is on the
			// source matcher instead.
			expect(config.matcher).toEqual(['/app/:path*']);
			expect('/apply/helping-hands'.startsWith('/app')).toBe(true);
		});
	});

	describe('signed-out requests to /app redirect to /login', () => {
		it('redirects with a 307 and preserves the path as callbackUrl', () => {
			const res = proxy(request('http://localhost/app/volunteers'));

			expect(res.status).toBe(307);
			const location = new URL(res.headers.get('location') as string);
			expect(location.pathname).toBe('/login');
			expect(location.searchParams.get('callbackUrl')).toBe('/app/volunteers');
		});

		it('preserves a deeply nested path', () => {
			const res = proxy(request('http://localhost/app/company/cmp_123/esg'));

			const location = new URL(res.headers.get('location') as string);
			expect(location.searchParams.get('callbackUrl')).toBe(
				'/app/company/cmp_123/esg',
			);
		});

		it('gates the /app root itself', () => {
			const res = proxy(request('http://localhost/app'));

			expect(res.status).toBe(307);
			const location = new URL(res.headers.get('location') as string);
			expect(location.searchParams.get('callbackUrl')).toBe('/app');
		});

		it('drops the query string from callbackUrl', () => {
			// Characterization of a known limitation: only `pathname` is copied, so
			// /app/applications?status=PENDING returns the user to the unfiltered
			// page after login. Pinned rather than fixed — changing it is a UX
			// decision, and an open redirect is the risk on the other side.
			const res = proxy(
				request('http://localhost/app/applications?status=PENDING'),
			);

			const location = new URL(res.headers.get('location') as string);
			expect(location.searchParams.get('callbackUrl')).toBe(
				'/app/applications',
			);
		});

		it('ignores a cookie that merely resembles the session cookie', () => {
			const res = proxy(
				request('http://localhost/app', 'next-auth.session-token-x=forged'),
			);

			expect(res.status).toBe(307);
		});

		it('ignores the CSRF and callback-url cookies next-auth also sets', () => {
			// These are present for anonymous visitors on the login page, so
			// matching on the wrong name would admit every signed-out user.
			const res = proxy(
				request(
					'http://localhost/app',
					'next-auth.csrf-token=abc; next-auth.callback-url=http%3A%2F%2Flocalhost%2Fapp',
				),
			);

			expect(res.status).toBe(307);
		});
	});

	describe('requests carrying a session cookie are admitted', () => {
		it.each([
			['next-auth.session-token', 'dev / http'],
			['__Secure-next-auth.session-token', 'production / https'],
		])('admits %s (%s)', (cookieName) => {
			const res = proxy(
				request('http://localhost/app/volunteers', `${cookieName}=abc123`),
			);

			expect(isPassThrough(res)).toBe(true);
			expect(res.headers.get('location')).toBeNull();
		});

		it('stamps x-pathname so the shell can resolve the active route', () => {
			const res = proxy(
				request(
					'http://localhost/app/settings/team',
					'next-auth.session-token=abc123',
				),
			);

			expect(res.headers.get('x-pathname')).toBe('/app/settings/team');
		});

		it('stamps the pathname only — not the query string', () => {
			const res = proxy(
				request(
					'http://localhost/app/shifts?week=2026-08-10',
					'next-auth.session-token=abc123',
				),
			);

			expect(res.headers.get('x-pathname')).toBe('/app/shifts');
		});

		it('admits on cookie PRESENCE alone — it is not a validity check', () => {
			// The proxy is a cheap first pass; the session is actually verified
			// server-side. An empty forged cookie value gets past this gate by
			// design, and stating that here stops a reader mistaking it for auth.
			const res = proxy(
				request('http://localhost/app', 'next-auth.session-token='),
			);

			expect(isPassThrough(res)).toBe(true);
		});
	});

	describe('matcher', () => {
		it('scopes the proxy to /app/** only', () => {
			// If this widens, every public page starts paying the proxy hop; if it
			// narrows or disappears, the gate stops running at all.
			expect(config.matcher).toEqual(['/app/:path*']);
		});
	});
});
