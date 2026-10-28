import { describe, expect, it } from 'vitest';
import { pinVerifyFullSslMode } from './pg-connection-string';

const NEON =
	'postgresql://user:p%40ss@ep-x-pooler.us-east-1.aws.neon.tech/db?sslmode=require&channel_binding=require';

describe('pinVerifyFullSslMode', () => {
	it.each(['prefer', 'require', 'verify-ca'])(
		'pins sslmode=%s to verify-full',
		(mode) => {
			const out = new URL(
				pinVerifyFullSslMode(
					NEON.replace('sslmode=require', `sslmode=${mode}`),
				),
			);
			expect(out.searchParams.get('sslmode')).toBe('verify-full');
		},
	);

	it('keeps credentials, host, database and other params intact', () => {
		const out = new URL(pinVerifyFullSslMode(NEON));
		expect(out.username).toBe('user');
		expect(decodeURIComponent(out.password)).toBe('p@ss');
		expect(out.host).toBe('ep-x-pooler.us-east-1.aws.neon.tech');
		expect(out.pathname).toBe('/db');
		expect(out.searchParams.get('channel_binding')).toBe('require');
	});

	it.each([
		['no sslmode (local Postgres)', 'postgresql://u:p@localhost:5432/db'],
		['sslmode=disable', 'postgresql://u:p@localhost:5432/db?sslmode=disable'],
		['already verify-full', 'postgresql://u:p@h/db?sslmode=verify-full'],
		[
			'uselibpqcompat opt-in',
			'postgresql://u:p@h/db?uselibpqcompat=true&sslmode=require',
		],
		['unparseable', 'not a url'],
	])('leaves %s unchanged', (_label, input) => {
		expect(pinVerifyFullSslMode(input)).toBe(input);
	});
});
