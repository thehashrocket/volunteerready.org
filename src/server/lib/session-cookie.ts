/**
 * session-cookie.ts — which NextAuth session cookie this deployment uses.
 *
 * NextAuth v4 names the cookie `__Secure-next-auth.session-token` when its
 * base URL is https and `next-auth.session-token` otherwise (`defaultCookies`
 * in next-auth/core/lib/cookie, base URL from `detectOrigin`). Reading that one
 * cookie, and nothing else, keeps every server-side lookup on the session row
 * NextAuth itself authenticated.
 */

const SECURE_NAME = '__Secure-next-auth.session-token';
const PLAIN_NAME = 'next-auth.session-token';

/**
 * Mirrors next-auth's detectOrigin: NEXTAUTH_URL when set; on Vercel (or with
 * AUTH_TRUST_HOST) the request's forwarded protocol; otherwise plain http.
 */
export function sessionCookieName(requestProtocol?: string | null): string {
	const configured = process.env.NEXTAUTH_URL;
	const secure = configured
		? isHttpsLikeNextAuth(configured)
		: (process.env.VERCEL ?? process.env.AUTH_TRUST_HOST)
			? requestProtocol !== 'http'
			: false;
	return secure ? SECURE_NAME : PLAIN_NAME;
}

/**
 * next-auth's parseUrl: a URL that does not start with "http" gets "https://"
 * in front, then the parsed protocol decides.
 */
function isHttpsLikeNextAuth(url: string): boolean {
	try {
		return (
			new URL(url.startsWith('http') ? url : `https://${url}`).protocol ===
			'https:'
		);
	} catch {
		return false;
	}
}

/**
 * The value of cookie `name` in a Cookie header, or null. Follows Next's
 * parser (@edge-runtime/cookies parseCookie) where a session token can
 * differ: split on "; *", exact key match, the last value wins, and a value
 * that is not valid percent-encoding is skipped. Unlike Next, an empty or
 * valueless cookie gives null rather than "" or "true": neither is a token.
 */
export function readCookie(header: string | null, name: string): string | null {
	if (!header) return null;
	let value: string | null = null;
	for (const pair of header.split(/; */)) {
		const splitAt = pair.indexOf('=');
		if (splitAt === -1 || pair.slice(0, splitAt) !== name) continue;
		try {
			value = decodeURIComponent(pair.slice(splitAt + 1));
		} catch {
			// Malformed percent-encoding: Next skips it, so do we.
		}
	}
	return value || null;
}
