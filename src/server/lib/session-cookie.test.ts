// Value: protects=server code reads the same session cookie NextAuth does;
// fails_when=the name rule drifts from next-auth's detectOrigin or the parser
// keeps the first of repeated values; why_new=new module; seam=none
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCookie, sessionCookieName } from './session-cookie';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('sessionCookieName', () => {
	it.each([
		[
			'https NEXTAUTH_URL',
			{ NEXTAUTH_URL: 'https://volunteerready.org' },
			null,
			'__Secure-next-auth.session-token',
		],
		[
			'http NEXTAUTH_URL',
			{ NEXTAUTH_URL: 'http://localhost:3005' },
			'https',
			'next-auth.session-token',
		],
		[
			'Vercel over https',
			{ NEXTAUTH_URL: '', VERCEL: '1' },
			'https',
			'__Secure-next-auth.session-token',
		],
		[
			'Vercel over http',
			{ NEXTAUTH_URL: '', VERCEL: '1' },
			'http',
			'next-auth.session-token',
		],
		[
			'no configuration',
			{ NEXTAUTH_URL: '', VERCEL: '', AUTH_TRUST_HOST: '' },
			'https',
			'next-auth.session-token',
		],
		[
			'scheme-less NEXTAUTH_URL',
			{ NEXTAUTH_URL: 'volunteerready.org' },
			null,
			'__Secure-next-auth.session-token',
		],
		[
			'uppercase scheme',
			{ NEXTAUTH_URL: 'HTTPS://volunteerready.org' },
			null,
			'__Secure-next-auth.session-token',
		],
		[
			'empty VERCEL with AUTH_TRUST_HOST (next-auth uses ??)',
			{ NEXTAUTH_URL: '', VERCEL: '', AUTH_TRUST_HOST: '1' },
			'https',
			'next-auth.session-token',
		],
	] as const)('%s', (_label, env, proto, expected) => {
		for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
		expect(sessionCookieName(proto)).toBe(expected);
	});
});

describe('readCookie', () => {
	it('returns the last value of a repeated cookie', () => {
		expect(readCookie('a=1; b=2; a=3', 'a')).toBe('3');
	});

	it('reads pairs as Next does: no trimming of tabs', () => {
		expect(readCookie('a=1;\ta=2', 'a')).toBe('1');
	});

	it('keeps the earlier value when a later one is malformed', () => {
		expect(readCookie('a=1; a=%E0%A4%A', 'a')).toBe('1');
	});

	it('does not match a cookie whose name only ends the same', () => {
		expect(
			readCookie(
				'__Secure-next-auth.session-token=x',
				'next-auth.session-token',
			),
		).toBeNull();
	});

	it.each([null, '', 'other=1'])('returns null for %j', (header) => {
		expect(readCookie(header, 'a')).toBeNull();
	});

	it('ignores a value that is not valid percent-encoding', () => {
		expect(readCookie('a=%E0%A4%A', 'a')).toBeNull();
	});

	it('decodes a percent-encoded value', () => {
		expect(readCookie('a=x%3Dy', 'a')).toBe('x=y');
	});
});
