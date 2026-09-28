import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The precedence rules are tested in cli-database-url.test.ts. This file pins
// only the wiring: that prisma.config.ts actually routes through the resolver
// and declares no `directUrl`, which Prisma 7's config silently ignores.
//
// dotenv is mocked so a developer's .env.local cannot leak into the result.
vi.mock('dotenv', () => ({ config: vi.fn() }));

const POOLED = 'postgresql://app:pw@ep-x-pooler.us-east-2.aws.neon.tech/neondb';
const DIRECT = 'postgresql://app:pw@ep-x.us-east-2.aws.neon.tech/neondb';

async function loadConfig(env: Record<string, string | undefined>) {
	for (const key of [
		'DATABASE_URL',
		'DATABASE_URL_UNPOOLED',
		'DIRECT_DATABASE_URL',
		'VERCEL_ENV',
	]) {
		vi.stubEnv(key, env[key]);
	}
	return (await import('../prisma.config')).default;
}

describe('prisma.config datasource', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('hands the Prisma CLI the direct URL', async () => {
		const config = await loadConfig({
			DATABASE_URL: POOLED,
			DATABASE_URL_UNPOOLED: DIRECT,
		});
		expect(config.datasource?.url).toBe(DIRECT);
	});

	it('refuses to load in a production build with no direct URL', async () => {
		await expect(
			loadConfig({ DATABASE_URL: POOLED, VERCEL_ENV: 'production' }),
		).rejects.toThrow(/DATABASE_URL_UNPOOLED is not set/);
	});

	it('still loads with every URL unset, so `prisma generate` works without a database', async () => {
		const config = await loadConfig({});
		expect(config.datasource?.url).toBeUndefined();
	});

	it('declares no directUrl, which Prisma 7 silently ignores', async () => {
		const config = await loadConfig({ DATABASE_URL: POOLED });
		expect(config.datasource).not.toHaveProperty('directUrl');
	});
});
