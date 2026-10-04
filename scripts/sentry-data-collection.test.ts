import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Why this exists: Sentry 11 deleted `sendDefaultPii` and replaced it with
 * `dataCollection`, whose DEFAULTS are permissive (user info, IPs, every header,
 * request bodies). So the privacy posture of the server and edge runtimes now
 * rests entirely on two root config files passing the right options to
 * `Sentry.init`. Deleting one line there type-checks, builds, and silently
 * starts shipping volunteer form payloads and client IPs to a third party.
 *
 * The assertions run against what each config file ACTUALLY passes to
 * `Sentry.init` (captured via a mocked `@sentry/nextjs`, so no client is
 * created and nothing is sent), not against the exported constant alone — an
 * inlined object or a dropped `dataCollection:` key is caught the same way as
 * a flipped field. `beforeSend` is checked by behaviour, not identity.
 *
 * The browser config (`src/instrumentation-client.ts`) is deliberately not
 * guarded here: it collects user info, cookies and headers by decision, so
 * there is no withheld field to protect.
 *
 * Lives in `scripts/` with the other root-config guards
 * (`next-config-images.test.ts`, `lint-gate.test.ts`).
 */

const { init } = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ init }));

// Header/cookie/query-key snippets that must be denied on the server side:
// v10's own PII deny-list (deleted in v11), 'proxied' for Vercel's
// `x-vercel-proxied-for` client-IP header, and 'signature' for the Checkr and
// Stripe webhook signature headers, which reach spans where beforeSend can't.
const REQUIRED_DENY = [
	'forwarded',
	'-ip',
	'remote-',
	'via',
	'-user',
	'proxied',
	'signature',
	'router-state',
	'route-matches',
];

// Query strings additionally hide the magic-link `email=` and the OAuth
// `code=` / `state=` (Sentry matches deny terms as case-insensitive substrings).
const REQUIRED_QUERY_DENY = [...REQUIRED_DENY, 'email', 'code', 'state'];

type InitOptions = {
	dataCollection?: Record<string, unknown>;
	beforeSend?: (event: unknown, hint: unknown) => unknown;
	beforeSendSpan?: (span: unknown) => unknown;
};

const captured: Record<string, InitOptions> = {};

beforeAll(async () => {
	const { SERVER_DATA_COLLECTION } = await import(
		'../src/lib/sentry-data-collection'
	);
	captured['SERVER_DATA_COLLECTION constant'] = {
		dataCollection: SERVER_DATA_COLLECTION as Record<string, unknown>,
	};
	for (const [name, load] of [
		['sentry.server.config.ts', () => import('../sentry.server.config')],
		['sentry.edge.config.ts', () => import('../sentry.edge.config')],
	] as const) {
		init.mockClear();
		await load();
		expect(init, `${name} must call Sentry.init once`).toHaveBeenCalledTimes(1);
		captured[name] = init.mock.calls[0][0] as InitOptions;
	}
});

const SERVER_SOURCES = [
	'SERVER_DATA_COLLECTION constant',
	'sentry.server.config.ts',
	'sentry.edge.config.ts',
];

describe.each(SERVER_SOURCES)('server-side data collection: %s', (source) => {
	const dc = () => {
		const value = captured[source].dataCollection;
		// Missing means v11's permissive defaults apply.
		expect(value, 'dataCollection must be set explicitly').toBeDefined();
		return value as Record<string, unknown>;
	};

	it('collects no user info (user id/email/IP)', () => {
		expect(dc().userInfo).toBe(false);
	});

	it('collects no request or response bodies', () => {
		expect(dc().httpBodies).toEqual([]);
	});

	it('collects no database query data, queue args or local variables', () => {
		expect(dc().databaseQueryData).toBe(false);
		expect(dc().queues).toBe(false);
		expect(dc().stackFrameVariables).toBe(false);
	});

	it.each(['cookies', 'httpHeaders', 'urlQueryParams'])(
		'%s is a deny-list covering every required snippet',
		(key) => {
			const setting = dc()[key] as { deny?: unknown } | boolean | undefined;
			// `true`/undefined would collect everything; `false` would also satisfy
			// privacy but is a different decision — fail so a human looks.
			expect(typeof setting, `${key} must be { deny: [...] }`).toBe('object');
			const deny = (setting as { deny?: unknown }).deny;
			expect(Array.isArray(deny), `${key}.deny must be an array`).toBe(true);
			expect(deny).toEqual(
				expect.arrayContaining(
					key === 'urlQueryParams' ? REQUIRED_QUERY_DENY : REQUIRED_DENY,
				),
			);
		},
	);
});

describe.each(['sentry.server.config.ts', 'sentry.edge.config.ts'])(
	'%s beforeSend',
	(name) => {
		it('scrubs credentials and session cookies from error events', () => {
			const beforeSend = captured[name].beforeSend;
			expect(typeof beforeSend, 'beforeSend must be set').toBe('function');
			const event = {
				request: {
					headers: {
						authorization: 'Bearer secret',
						cookie: 'next-auth.session-token=abc',
						'stripe-signature': 't=1,v1=abc',
						'content-type': 'application/json',
					},
					cookies: { 'next-auth.session-token': 'abc' },
				},
			};
			const out = beforeSend?.(event, {}) as typeof event & {
				request: { cookies?: unknown };
			};
			expect(out.request.headers).toEqual({
				'content-type': 'application/json',
			});
			expect(out.request.cookies).toBeUndefined();
		});
	},
);

describe.each(['sentry.server.config.ts', 'sentry.edge.config.ts'])(
	'%s keeps URL secrets out of Sentry',
	(name) => {
		it('scrubs secret URLs from error events', () => {
			const event = {
				request: { url: 'https://x.test/invite/abc123?token=t' },
				transaction: 'GET /credentials/claim/abc123',
				// Set by captureRequestError from Next's raw req.url.
				contexts: { nextjs: { request_path: '/apply/status?token=t' } },
			};
			const out = captured[name].beforeSend?.(event, {}) as typeof event;
			expect(out.request.url).toBe(
				'https://x.test/invite/[Filtered]?token=[Filtered]',
			);
			expect(out.transaction).toBe('GET /credentials/claim/[Filtered]');
			expect(out.contexts.nextjs.request_path).toBe(
				'/apply/status?token=[Filtered]',
			);
		});

		it('keeps streamed spans, the mode beforeSendSpan was written for', () => {
			// In 'static' mode spans are sent inside transaction events, which
			// never reach beforeSendSpan, and nothing here scrubs them.
			expect(
				(captured[name] as { traceLifecycle?: string }).traceLifecycle ??
					'stream',
			).toBe('stream');
		});

		it('scrubs the name and attributes of every span', () => {
			const beforeSendSpan = captured[name].beforeSendSpan;
			expect(typeof beforeSendSpan, 'beforeSendSpan must be set').toBe(
				'function',
			);
			const out = beforeSendSpan?.({
				name: 'GET /invite/company/abc123',
				attributes: {
					'http.target': '/apply/status?token=abc',
					'url.full': 'https://x.test/api/checkr/oauth/callback?code=c',
				},
			}) as { name: string; attributes: Record<string, string> };
			expect(out.name).toBe('GET /invite/company/[Filtered]');
			expect(out.attributes).toEqual({
				'http.target': '/apply/status?token=[Filtered]',
				'url.full': 'https://x.test/api/checkr/oauth/callback?code=[Filtered]',
			});
		});
	},
);
