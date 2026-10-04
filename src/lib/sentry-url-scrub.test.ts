import { describe, expect, it } from 'vitest';
import {
	isSecretUrl,
	scrubBreadcrumb,
	scrubSecrets,
	scrubSentryEvent,
	scrubSpan,
} from './sentry-url-scrub';

const F = '[Filtered]';

describe('scrubSecrets', () => {
	it.each([
		['/invite/abc123', `/invite/${F}`],
		['/invite/company/abc123', `/invite/company/${F}`],
		['/credentials/claim/abc123?x=1', `/credentials/claim/${F}?x=1`],
		[
			'https://volunteerready.org/invite/abc123#top',
			`https://volunteerready.org/invite/${F}#top`,
		],
		['GET /invite/company/abc123', `GET /invite/company/${F}`],
	])('masks the token path segment in %s', (input, expected) => {
		expect(scrubSecrets(input)).toBe(expected);
	});

	it.each([
		['/apply/status?token=abc', `/apply/status?token=${F}`],
		[
			'/api/unsubscribe/digest?userId=u1&token=abc',
			`/api/unsubscribe/digest?userId=u1&token=${F}`,
		],
		[
			'/api/checkr/oauth/callback?code=abc&state=xyz',
			`/api/checkr/oauth/callback?code=${F}&state=${F}`,
		],
		[
			'/api/auth/callback/email?callbackUrl=%2Finvite%2Fabc&token=t&email=a%40b.c',
			`/api/auth/callback/email?callbackUrl=${F}&token=${F}&email=${F}`,
		],
		[
			'/api/trpc/invite.get?batch=1&input=%7B%220%22%3A%7B%22token%22%3A%22abc%22%7D%7D',
			`/api/trpc/invite.get?batch=1&input=${F}`,
		],
		['/login?TOKEN=abc', `/login?TOKEN=${F}`],
		// Vercel rewrites dynamic routes with a prefixed key; Next's raw
		// http.target carries it.
		['/invite/[token]?nxtPtoken=abc', `/invite/${F}?nxtPtoken=${F}`],
		// HTML-escaped and fragment forms.
		['/x?a=1&amp;token=abc', `/x?a=1&amp;token=${F}`],
		['/x#token=abc', `/x#token=${F}`],
		// A log line rather than a URL.
		['got state=org_123 back', `got state=${F} back`],
		// A percent-encoded token path under a key outside the list.
		['/login?next=%2Finvite%2Fabc123', `/login?next=%2Finvite%2F${F}`],
		[
			'/login?next=%2Fcredentials%2Fclaim%2Fabc',
			`/login?next=%2Fcredentials%2Fclaim%2F${F}`,
		],
	])('masks secret query values in %s', (input, expected) => {
		expect(scrubSecrets(input)).toBe(expected);
	});

	it.each([
		'/invite/company',
		'/invite/company?x=1',
		'/app/volunteers?page=2',
		'/opportunities/helping-hands',
		'/api/trpc/opportunity.list?batch=1',
		'/login?next=%2Finvite%2Fcompany',
	])('leaves %s alone', (input) => {
		expect(scrubSecrets(input)).toBe(input);
	});
});

describe('isSecretUrl', () => {
	it.each([
		'/invite/abc',
		'/invite/company/abc',
		'/credentials/claim/abc',
		'https://x.test/apply/status?token=abc',
		'/login?callbackUrl=%2Finvite%2Fabc',
		'/api/checkr/oauth/callback?code=abc&state=org',
		'/verify?email=a%40b.c',
	])('flags %s', (url) => {
		expect(isSecretUrl(url)).toBe(true);
	});

	it.each([
		'/',
		'/invite/company',
		'/app',
		'/apply/helping-hands',
		// Harmless pages the broad scrubber would still mask parts of: replay
		// must stay on for them.
		'/login?callbackUrl=%2Fapp%2Fonboarding',
		'/opportunities?state=CA',
		'/opportunities?zipcode=94110',
	])('does not flag %s', (url) => {
		expect(isSecretUrl(url)).toBe(false);
	});
});

describe('scrubSentryEvent', () => {
	it('scrubs the request, transaction, breadcrumbs, exception messages and replay urls', () => {
		const event = {
			transaction: '/invite/abc',
			request: {
				url: 'https://x.test/invite/abc',
				query_string: 'token=abc',
				headers: {
					Referer: 'https://x.test/credentials/claim/abc',
					'content-type': 'text/html',
				},
			},
			breadcrumbs: [
				{
					category: 'navigation',
					data: { from: '/invite/abc', to: '/apply/status?token=abc' },
				},
			],
			exception: {
				values: [
					{
						type: 'Error',
						value: 'Failed to load /invite/company/abc',
						stacktrace: {
							frames: [{ filename: 'app:///app/invite/[token]/page.js' }],
						},
					},
				],
			},
			urls: ['https://x.test/invite/abc', 'https://x.test/app'],
		};

		const out = scrubSentryEvent(event as never) as typeof event;

		expect(out.transaction).toBe(`/invite/${F}`);
		expect(out.request.url).toBe(`https://x.test/invite/${F}`);
		expect(out.request.query_string).toBe(`token=${F}`);
		expect(out.request.headers.Referer).toBe(
			`https://x.test/credentials/claim/${F}`,
		);
		expect(out.request.headers['content-type']).toBe('text/html');
		expect(out.breadcrumbs[0].data).toEqual({
			from: `/invite/${F}`,
			to: `/apply/status?token=${F}`,
		});
		expect(out.exception.values[0].value).toBe(
			`Failed to load /invite/company/${F}`,
		);
		// Stack frames are left alone: rewriting a filename breaks source maps.
		expect(out.exception.values[0].stacktrace.frames[0].filename).toBe(
			'app:///app/invite/[token]/page.js',
		);
		expect(out.urls).toEqual([
			`https://x.test/invite/${F}`,
			'https://x.test/app',
		]);
	});

	it('scrubs a query string sent as key/value pairs', () => {
		const event = {
			request: {
				query_string: [
					['token', 'abc'],
					['page', '2'],
				],
			},
		};

		const out = scrubSentryEvent(event as never) as typeof event;

		expect(out.request.query_string).toEqual([
			['token', F],
			['page', '2'],
		]);
	});

	it('scrubs a query string sent as an object', () => {
		const event = {
			request: {
				query_string: { token: 'abc', next: '/invite/abc', page: '2' },
			},
		};

		const out = scrubSentryEvent(event as never) as typeof event;

		expect(out.request.query_string).toEqual({
			token: F,
			next: `/invite/${F}`,
			page: '2',
		});
	});

	it('scrubs contexts, extra and tags, where captureRequestError puts the path', () => {
		const event = {
			contexts: {
				nextjs: { request_path: '/invite/abc?x=1', router_kind: 'App Router' },
			},
			extra: { url: '/credentials/claim/abc' },
			tags: { url: '/apply/status?token=abc' },
		};

		const out = scrubSentryEvent(event as never) as typeof event;

		expect(out.contexts.nextjs).toEqual({
			request_path: `/invite/${F}?x=1`,
			router_kind: 'App Router',
		});
		expect(out.extra.url).toBe(`/credentials/claim/${F}`);
		expect(out.tags.url).toBe(`/apply/status?token=${F}`);
	});

	it('scrubs every request header and drops the opaque route-param ones', () => {
		const event = {
			request: {
				headers: {
					'next-url': '/invite/abc',
					'next-router-state-tree': '%5B%22token%22%2C%22abc%22%5D',
					'x-now-route-matches': 'nxtPtoken=abc',
					accept: 'text/html',
				},
			},
		};

		const out = scrubSentryEvent(event as never) as typeof event;

		expect(out.request.headers).toEqual({
			'next-url': `/invite/${F}`,
			'next-router-state-tree': F,
			'x-now-route-matches': F,
			accept: 'text/html',
		});
	});

	it('scrubs a stack frame named after the page, but never a bundle path', () => {
		const event = {
			exception: {
				values: [
					{
						value: 'boom',
						stacktrace: {
							frames: [
								{ filename: 'https://x.test/apply/status?token=abc' },
								{ abs_path: 'https://x.test/invite/abc' },
								{
									filename: 'https://x.test/_next/static/chunks/invite/abc.js',
								},
							],
						},
					},
				],
			},
		};

		const out = scrubSentryEvent(event as never) as typeof event;

		expect(out.exception.values[0].stacktrace.frames).toEqual([
			{ filename: `https://x.test/apply/status?token=${F}` },
			{ abs_path: `https://x.test/invite/${F}` },
			{ filename: 'https://x.test/_next/static/chunks/invite/abc.js' },
		]);
	});

	it('leaves an event without these fields unchanged', () => {
		const event = { message: 'hello', level: 'info' };
		expect(scrubSentryEvent(event as never)).toEqual(event);
	});
});

describe('scrubBreadcrumb', () => {
	it('scrubs the message and every string in data, however deep', () => {
		const out = scrubBreadcrumb({
			category: 'fetch',
			message: 'GET /invite/abc',
			data: {
				url: '/api/trpc/x?input=%7B%7D',
				nested: { href: '/credentials/claim/abc' },
				status_code: 200,
			},
		});

		expect(out).toEqual({
			category: 'fetch',
			message: `GET /invite/${F}`,
			data: {
				url: `/api/trpc/x?input=${F}`,
				nested: { href: `/credentials/claim/${F}` },
				status_code: 200,
			},
		});
	});
});

describe('scrubBreadcrumb with console arguments', () => {
	it('copies an Error with its message scrubbed, leaving the original alone', () => {
		const err = new Error('failed on /invite/abc');
		const cyclic: Record<string, unknown> = { name: 'node' };
		cyclic.self = cyclic;
		const date = new Date(0);

		const out = scrubBreadcrumb({
			category: 'console',
			data: { arguments: [err, cyclic, date] },
		}) as { data: { arguments: unknown[] } };

		const [outErr, outCyclic, outDate] = out.data.arguments;
		expect(outErr).toMatchObject({
			name: 'Error',
			message: `failed on /invite/${F}`,
		});
		expect((outErr as { stack: string }).stack).not.toContain('/invite/abc');
		// The app may still be holding this Error.
		expect(err.message).toBe('failed on /invite/abc');
		expect(outCyclic).toMatchObject({ name: 'node' });
		expect(outDate).toBe(date);
	});

	it('keeps a breadcrumb whose argument is a DOMException (read-only message)', () => {
		const abort = new DOMException('aborted /invite/abc', 'AbortError');

		const out = scrubBreadcrumb({
			category: 'console',
			data: { arguments: [abort] },
		}) as { data: { arguments: unknown[] } };

		expect(out.data.arguments[0]).toMatchObject({
			name: 'AbortError',
			message: `aborted /invite/${F}`,
		});
	});
});

describe('scrubSpan', () => {
	it('scrubs the name and every string attribute, raw or wrapped', () => {
		const span = {
			name: 'GET /invite/abc',
			attributes: {
				'url.full': 'https://x.test/invite/abc?token=t',
				'http.target': '/apply/status?token=abc',
				'sentry.segment.name': 'GET /credentials/claim/abc',
				'url.query': { value: 'code=abc&state=xyz', type: 'string' },
				'http.response.status_code': 200,
				'http.request.header.next-router-state-tree':
					'%5B%22token%22%2C%22abc%22%5D',
			},
		};

		const out = scrubSpan(span as never) as typeof span;

		expect(out.name).toBe(`GET /invite/${F}`);
		expect(out.attributes).toEqual({
			'url.full': `https://x.test/invite/${F}?token=${F}`,
			'http.target': `/apply/status?token=${F}`,
			'sentry.segment.name': `GET /credentials/claim/${F}`,
			'url.query': { value: `code=${F}&state=${F}`, type: 'string' },
			'http.response.status_code': 200,
			'http.request.header.next-router-state-tree': F,
		});
	});
});
