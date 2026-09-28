import { describe, expect, it } from 'vitest';
import { resolveCliDatabaseUrl } from './cli-database-url';

const NEON_POOLED =
	'postgresql://app:secret@ep-cool-bird-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
const NEON_DIRECT =
	'postgresql://app:secret@ep-cool-bird-123456.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const LOCAL = 'postgresql://postgres:postgres@localhost:5432/volunteeermatch';
const SCRATCH = 'postgresql://postgres:postgres@localhost:5432/scratch';

describe('resolveCliDatabaseUrl', () => {
	it('prefers the direct URL so migrate deploy never takes its advisory lock through PgBouncer', () => {
		expect(
			resolveCliDatabaseUrl({
				DATABASE_URL: NEON_POOLED,
				DATABASE_URL_UNPOOLED: NEON_DIRECT,
			}),
		).toBe(NEON_DIRECT);
	});

	it('accepts DIRECT_DATABASE_URL when DATABASE_URL_UNPOOLED is unset or empty', () => {
		expect(
			resolveCliDatabaseUrl({
				DATABASE_URL: NEON_POOLED,
				DATABASE_URL_UNPOOLED: '',
				DIRECT_DATABASE_URL: NEON_DIRECT,
			}),
		).toBe(NEON_DIRECT);
	});

	it('falls back to DATABASE_URL outside production when no direct URL is configured', () => {
		expect(resolveCliDatabaseUrl({ DATABASE_URL: LOCAL })).toBe(LOCAL);
		expect(
			resolveCliDatabaseUrl({
				DATABASE_URL: NEON_POOLED,
				VERCEL_ENV: 'preview',
			}),
		).toBe(NEON_POOLED);
	});

	it('returns undefined with nothing set, so `prisma generate` works without a database', () => {
		expect(resolveCliDatabaseUrl({})).toBeUndefined();
	});

	it('uses the direct URL alone when DATABASE_URL is unset', () => {
		expect(resolveCliDatabaseUrl({ DATABASE_URL_UNPOOLED: LOCAL })).toBe(LOCAL);
	});

	it('treats a percent-encoded database name as the same database', () => {
		expect(
			resolveCliDatabaseUrl({
				DATABASE_URL: 'postgresql://postgres:pw@localhost:5432/app',
				DATABASE_URL_UNPOOLED: 'postgresql://postgres:pw@localhost:5432/%61pp',
			}),
		).toBe('postgresql://postgres:pw@localhost:5432/%61pp');
	});

	it('ignores transport-only query differences between the pooled and direct URLs', () => {
		expect(
			resolveCliDatabaseUrl({
				DATABASE_URL: `${LOCAL}?pgbouncer=true`,
				DATABASE_URL_UNPOOLED: `${LOCAL}?sslmode=disable`,
			}),
		).toBe(`${LOCAL}?sslmode=disable`);
	});

	describe('refuses a direct URL that names a different database', () => {
		// The dangerous shape: `.env.local` holds a direct URL (possibly
		// production, via `vercel env pull`) and the developer overrides only
		// DATABASE_URL in the shell. Preferring the direct URL would run
		// `migrate reset` / `db execute` against the file's database.
		it.each([
			['a different database name', SCRATCH, LOCAL],
			['a different host', LOCAL, NEON_DIRECT],
			[
				'a different port',
				'postgresql://postgres:postgres@localhost:5433/volunteeermatch',
				LOCAL,
			],
			[
				'a different user',
				'postgresql://other:postgres@localhost:5432/volunteeermatch',
				LOCAL,
			],
			// Prisma treats `schema` as the target, so a reset aimed at
			// `scratch` must not land on `public`.
			['a different schema', `${LOCAL}?schema=scratch`, LOCAL],
			// `?host=` overrides the authority in Prisma, so two URLs with the
			// same authority can still reach different servers.
			[
				'a ?host= override pointing elsewhere',
				`${NEON_DIRECT}&host=127.0.0.1`,
				NEON_DIRECT,
			],
		])('%s', (_label, pooled, direct) => {
			expect(() =>
				resolveCliDatabaseUrl({
					DATABASE_URL: pooled,
					DATABASE_URL_UNPOOLED: direct,
				}),
			).toThrow(/name different databases/);
		});
	});

	describe('production never falls back to the pooler', () => {
		it('refuses a missing direct URL', () => {
			expect(() =>
				resolveCliDatabaseUrl({
					DATABASE_URL: NEON_POOLED,
					VERCEL_ENV: 'production',
				}),
			).toThrow(/DATABASE_URL_UNPOOLED is not set/);
		});

		it('refuses a direct URL that is actually the -pooler host', () => {
			expect(() =>
				resolveCliDatabaseUrl({
					DATABASE_URL: NEON_POOLED,
					DATABASE_URL_UNPOOLED: NEON_POOLED,
					VERCEL_ENV: 'production',
				}),
			).toThrow(/-pooler host/);
		});

		it.each([
			[
				'uppercase',
				NEON_POOLED.replace(
					'ep-cool-bird-123456-pooler',
					'EP-COOL-BIRD-123456-POOLER',
				),
			],
			[
				'reached through a ?host= override',
				`${NEON_DIRECT}&host=ep-cool-bird-123456-pooler.us-east-2.aws.neon.tech`,
			],
		])('refuses a -pooler host that is %s', (_label, direct) => {
			expect(() =>
				resolveCliDatabaseUrl({
					DATABASE_URL: NEON_POOLED,
					DATABASE_URL_UNPOOLED: direct,
					VERCEL_ENV: 'production',
				}),
			).toThrow(/-pooler host/);
		});

		it('accepts the direct host', () => {
			expect(
				resolveCliDatabaseUrl({
					DATABASE_URL: NEON_POOLED,
					DATABASE_URL_UNPOOLED: NEON_DIRECT,
					VERCEL_ENV: 'production',
				}),
			).toBe(NEON_DIRECT);
		});
	});

	it('never echoes a malformed URL, which would print its password', () => {
		const leaky = 'not a url but has secret-password-123';
		let message = '';
		try {
			resolveCliDatabaseUrl({
				DATABASE_URL: LOCAL,
				DATABASE_URL_UNPOOLED: leaky,
			});
		} catch (err) {
			message = (err as Error).message;
		}
		expect(message).toMatch(/not a valid URL/);
		expect(message).not.toContain('secret-password-123');
	});
});
