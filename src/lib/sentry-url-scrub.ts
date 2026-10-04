// Removes secrets carried in URLs before anything reaches Sentry.
//
// Several routes put a live secret in the URL: invite and claim tokens as a
// path segment, and status, consent, unsubscribe and sign-in tokens, OAuth
// codes and tRPC GET input as query values. Sentry records URLs in many places
// that `dataCollection` does not filter: browser error events, breadcrumbs,
// replay, span names and attributes (including Next's raw `http.target` and
// the segment name Sentry copies onto every span), and the
// `contexts.nextjs.request_path` that `captureRequestError` sets on server
// errors. Key-based filtering cannot see a token that is a path segment, so
// these rewrite the strings themselves.
//
// Over-masking only costs telemetry, so matching is deliberately broad: a key
// that merely ends in a secret name is masked too (`zipcode=`, and Vercel's
// rewritten `nxtPtoken=`), and so is an unrelated `?state=` filter and every
// tRPC GET input.

const FILTERED = '[Filtered]';

// A path segment ends at the next separator, quote or whitespace.
const SEGMENT = String.raw`[^/?#&\s"'<>]+`;
// Inside a percent-encoded URL (e.g. a `callbackUrl` value) a segment ends at
// the next escape.
const ENCODED_SEGMENT = '[A-Za-z0-9._~-]+';

const SECRET_PATHS: RegExp[] = [
	new RegExp(`(/invite/company/)${SEGMENT}`, 'g'),
	// `/invite/company` itself is a page, not a token.
	new RegExp(
		String.raw`(/invite/)(?!company(?:[/?#&\s"'<>]|$))${SEGMENT}`,
		'g',
	),
	new RegExp(`(/credentials/claim/)${SEGMENT}`, 'g'),
	new RegExp(`(%2Finvite%2Fcompany%2F)${ENCODED_SEGMENT}`, 'gi'),
	new RegExp(
		`(%2Finvite%2F)(?!company(?:%2F|[^A-Za-z0-9._~-]|$))${ENCODED_SEGMENT}`,
		'gi',
	),
	new RegExp(`(%2Fcredentials%2Fclaim%2F)${ENCODED_SEGMENT}`, 'gi'),
];

const SECRET_QUERY_KEYS = [
	'token',
	'code',
	'state',
	'email',
	'callbackUrl',
	'input',
];

// A key/value pair starts a string or follows `?`, `&`, `#`, `;` (the end of
// an HTML-escaped `&amp;`) or whitespace (a log line such as `got state=…`).
// Any prefix on the key is kept and masked with it: `nxtPtoken=`.
const SECRET_QUERY = new RegExp(
	String.raw`(^|[?&#;\s])([^=&#\s"'<>?;]*?(?:${SECRET_QUERY_KEYS.join('|')}))=[^&#\s"'<>]*`,
	'gi',
);

const SECRET_QUERY_KEY = new RegExp(`(${SECRET_QUERY_KEYS.join('|')})$`, 'i');

// Request headers that carry route params in a form no pattern can match: the
// RSC router state tree holds each dynamic segment's raw value as URL-encoded
// JSON, and Vercel's route-matches header holds the params as a query string.
const OPAQUE_ROUTE_HEADERS = /next-router-state-tree|route-matches/i;

/** Masks secret path segments and secret query values anywhere in `text`. */
export function scrubSecrets(text: string): string {
	let out = text;
	for (const pattern of SECRET_PATHS) {
		out = out.replace(pattern, `$1${FILTERED}`);
	}
	return out.replace(SECRET_QUERY, `$1$2=${FILTERED}`);
}

// Narrower than the scrubbing above, which over-masks on purpose: deciding
// whether to record a page for replay should not switch replay off for a
// harmless `?state=` filter or `?callbackUrl=/app`. A callbackUrl that points
// at a token path is still caught by the encoded path patterns.
const SECRET_PAGE_QUERY = /(?:^|[?&#;])(?:token|code|email)=[^&#\s]/i;

/**
 * True when a page URL carries a secret: a token path segment (plain or
 * percent-encoded) or a `token`, `code` or `email` value. Used to keep replay
 * off such pages.
 */
export function isSecretUrl(url: string): boolean {
	const onSecretPath = SECRET_PATHS.some((pattern) => {
		pattern.lastIndex = 0;
		const hit = pattern.test(url);
		pattern.lastIndex = 0;
		return hit;
	});
	return onSecretPath || SECRET_PAGE_QUERY.test(url);
}

const MAX_DEPTH = 20;

function isPlainObject(value: object): value is Record<string, unknown> {
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/**
 * Scrubs every string in a value: inside arrays and plain objects, however
 * deep. An Error becomes a plain scrubbed copy of its name, message and stack:
 * the app may still be holding the original (console breadcrumbs get the live
 * arguments), and some errors, such as DOMException, have a read-only message.
 * Other objects (DOM nodes, Dates, class instances) pass through untouched;
 * Sentry serializes them later. Cycles and very deep values stop the walk
 * rather than overflowing the stack.
 */
function scrubDeep<T>(value: T, seen = new WeakSet<object>(), depth = 0): T {
	if (typeof value === 'string') return scrubSecrets(value) as T;
	if (value === null || typeof value !== 'object') return value;
	if (seen.has(value) || depth > MAX_DEPTH) return value;
	seen.add(value);
	if (value instanceof Error) {
		return {
			name: value.name,
			message: scrubSecrets(String(value.message)),
			stack: value.stack === undefined ? undefined : scrubSecrets(value.stack),
		} as T;
	}
	if (Array.isArray(value)) {
		return value.map((inner) => scrubDeep(inner, seen, depth + 1)) as T;
	}
	if (!isPlainObject(value)) return value;
	const out: Record<string, unknown> = {};
	for (const [key, inner] of Object.entries(value)) {
		out[key] = scrubDeep(inner, seen, depth + 1);
	}
	return out as T;
}

type QueryString =
	| string
	| Array<[string, string]>
	| Record<string, string>
	| undefined;

function scrubQueryString(query: QueryString): QueryString {
	if (typeof query === 'string') return scrubSecrets(query);
	if (Array.isArray(query)) {
		return query.map(([key, value]) => [
			key,
			SECRET_QUERY_KEY.test(key) ? FILTERED : scrubSecrets(value),
		]);
	}
	if (query && typeof query === 'object') {
		const out: Record<string, string> = {};
		for (const [key, value] of Object.entries(query)) {
			out[key] = SECRET_QUERY_KEY.test(key) ? FILTERED : scrubSecrets(value);
		}
		return out;
	}
	return query;
}

function scrubHeaders(headers: Record<string, string>): void {
	for (const key of Object.keys(headers)) {
		headers[key] = OPAQUE_ROUTE_HEADERS.test(key)
			? FILTERED
			: scrubSecrets(String(headers[key]));
	}
}

// A browser frame thrown from an inline script names the page itself as its
// file. Bundle and server paths are left alone: rewriting a filename such as
// `app/invite/[token]/page.js` would break source-map resolution.
function isPageUrl(filename: string): boolean {
	return /^https?:\/\//i.test(filename) && !filename.includes('/_next/');
}

type Frame = { filename?: string; abs_path?: string };

type ScrubbableEvent = {
	transaction?: string;
	request?: {
		url?: string;
		query_string?: QueryString;
		headers?: Record<string, string>;
	};
	breadcrumbs?: unknown[];
	exception?: {
		values?: Array<{ value?: string; stacktrace?: { frames?: Frame[] } }>;
	};
	contexts?: Record<string, unknown>;
	extra?: Record<string, unknown>;
	tags?: Record<string, unknown>;
	urls?: string[];
};

/** Scrubs an error, transaction or replay event in place and returns it. */
export function scrubSentryEvent<T>(event: T): T {
	const e = event as ScrubbableEvent;
	if (e.transaction) e.transaction = scrubSecrets(e.transaction);
	if (e.request) {
		if (e.request.url) e.request.url = scrubSecrets(e.request.url);
		if (e.request.query_string !== undefined) {
			e.request.query_string = scrubQueryString(e.request.query_string);
		}
		if (e.request.headers) scrubHeaders(e.request.headers);
	}
	if (e.breadcrumbs) e.breadcrumbs = scrubDeep(e.breadcrumbs);
	for (const exception of e.exception?.values ?? []) {
		if (exception.value) exception.value = scrubSecrets(exception.value);
		for (const frame of exception.stacktrace?.frames ?? []) {
			if (frame.filename && isPageUrl(frame.filename)) {
				frame.filename = scrubSecrets(frame.filename);
			}
			if (frame.abs_path && isPageUrl(frame.abs_path)) {
				frame.abs_path = scrubSecrets(frame.abs_path);
			}
		}
	}
	// `captureRequestError` puts the raw request path (query included) in
	// `contexts.nextjs.request_path`.
	if (e.contexts) e.contexts = scrubDeep(e.contexts);
	if (e.extra) e.extra = scrubDeep(e.extra);
	if (e.tags) e.tags = scrubDeep(e.tags);
	// Replay events list the URLs the session visited.
	if (Array.isArray(e.urls)) e.urls = scrubDeep(e.urls);
	return event;
}

type ScrubbableBreadcrumb = { message?: string; data?: unknown };

export function scrubBreadcrumb<T extends ScrubbableBreadcrumb>(
	breadcrumb: T,
): T {
	if (breadcrumb.message) {
		breadcrumb.message = scrubSecrets(breadcrumb.message);
	}
	if (breadcrumb.data !== undefined) {
		breadcrumb.data = scrubDeep(breadcrumb.data);
	}
	return breadcrumb;
}

type ScrubbableSpan = { name: string; attributes?: Record<string, unknown> };

/**
 * For `beforeSendSpan`. Every string attribute is scrubbed, not just the URL
 * ones: Sentry copies the (unscrubbed) segment name onto each span as
 * `sentry.segment.name` before this callback runs. Values arrive either raw or
 * wrapped as `{ value, type }`; `scrubDeep` handles both. Request headers
 * recorded as `http.request.header.*` that carry route params opaquely are
 * replaced outright.
 */
export function scrubSpan<T extends ScrubbableSpan>(span: T): T {
	span.name = scrubSecrets(span.name);
	if (span.attributes) {
		const attributes = scrubDeep(span.attributes);
		for (const key of Object.keys(attributes)) {
			if (OPAQUE_ROUTE_HEADERS.test(key)) attributes[key] = FILTERED;
		}
		span.attributes = attributes;
	}
	return span;
}

/**
 * For replay's `beforeAddRecordingEvent`: scrubs the custom events Replay adds
 * (navigation, breadcrumbs, performance spans). The DOM recording's own meta
 * event, which holds `location.href`, never reaches this hook, so replay is
 * not started on a secret URL at all (see src/instrumentation-client.ts).
 */
export function scrubRecordingEvent<T>(event: T): T {
	return scrubDeep(event);
}
