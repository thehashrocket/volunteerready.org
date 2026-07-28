/**
 * Integration test setup — connects to the real test database.
 * Requires DATABASE_URL to point to a test database instance.
 * The local dev Postgres (Docker: volunteermatch_db) is used.
 *
 * Env vars are loaded via vitest.integration.config.mts (dotenv at config time).
 */
import { afterAll } from 'vitest';
import { prisma } from '@/server/repositories/prisma';

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Refuse to run against a non-local database.
 *
 * These specs create fixture rows and clean up with prefix-scoped `deleteMany`
 * sweeps (safe between files only because `fileParallelism: false` serializes
 * them). Pointed at a shared staging database, those sweeps would delete real
 * rows whose ids happen to share a prefix. `e2e/utils/db.ts` has had this guard
 * since it started minting sessions; the integration suite ran unguarded, which
 * mattered more once CI started supplying `DATABASE_URL` from the environment
 * rather than from a developer's `.env.local`.
 *
 * Runs at module scope, so it fails before any spec's `beforeAll` can write.
 */
const datasourceUrl = process.env.DATABASE_URL;

if (!datasourceUrl) {
	throw new Error(
		'DATABASE_URL is not set — integration specs need .env.local or a CI-provided database',
	);
}

const host = new URL(datasourceUrl).hostname;

if (
	!LOCAL_DB_HOSTS.has(host) &&
	process.env.INTEGRATION_ALLOW_REMOTE_DB !== '1'
) {
	throw new Error(
		`Refusing to run integration specs against non-local host "${host}" — ` +
			'they delete rows by prefix. Set INTEGRATION_ALLOW_REMOTE_DB=1 to override.',
	);
}

afterAll(async () => {
	await prisma.$disconnect();
});
