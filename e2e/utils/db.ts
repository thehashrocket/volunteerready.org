// ---------------------------------------------------------------------------
// e2e database helper — lazy Prisma client for authenticated specs.
//
// Loads .env.local at module init (Playwright does not load env files), but
// defers client construction until first use so import hoisting can't race
// the dotenv call.
// ---------------------------------------------------------------------------

import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../src/prisma/generated/client';

config({ path: '.env.local' });

let client: PrismaClient | null = null;

// new URL().hostname keeps brackets on IPv6 literals — include both forms
const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function getPrisma(): PrismaClient {
	if (client) return client;

	const datasourceUrl = process.env.DATABASE_URL;
	if (!datasourceUrl) {
		throw new Error(
			'DATABASE_URL is not set — authenticated e2e specs need .env.local',
		);
	}

	// e2e specs seed users, mint session tokens, and bulk-delete by prefix.
	// Refuse to do that against anything but a local database.
	const host = new URL(datasourceUrl).hostname;
	if (!LOCAL_DB_HOSTS.has(host) && process.env.E2E_ALLOW_REMOTE_DB !== '1') {
		throw new Error(
			`Refusing to run e2e DB seeding against non-local host "${host}" — set E2E_ALLOW_REMOTE_DB=1 to override`,
		);
	}

	client = new PrismaClient({
		adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
	});
	return client;
}

export async function disconnectPrisma(): Promise<void> {
	if (client) {
		await client.$disconnect();
		client = null;
	}
}
