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

// ---------------------------------------------------------------------------
// Database-session helpers (NextAuth strategy: 'database').
//
// Shared by every authenticated spec and the capture pipeline so the cookie
// name, token source, and org/company pinning live in exactly one place.
// Sessions minted WITHOUT currentOrgId render multi-org users with the org
// switcher in its "Select org" placeholder state — pin the context when the
// actor has one.
// ---------------------------------------------------------------------------

export const SESSION_COOKIE_NAME = 'next-auth.session-token';

export async function createSession(options: {
	userId: string;
	currentOrgId?: string;
	currentCompanyId?: string;
	ttlMs?: number;
}): Promise<string> {
	const { randomUUID } = await import('node:crypto');
	const sessionToken = randomUUID();
	await getPrisma().session.create({
		data: {
			sessionToken,
			userId: options.userId,
			expires: new Date(Date.now() + (options.ttlMs ?? 60 * 60 * 1000)),
			currentOrgId: options.currentOrgId,
			currentCompanyId: options.currentCompanyId,
		},
	});
	return sessionToken;
}

export async function deleteSession(sessionToken: string): Promise<void> {
	await getPrisma()
		.session.delete({ where: { sessionToken } })
		.catch(() => {});
}

export function sessionCookie(sessionToken: string, baseURL: string) {
	const url = new URL(baseURL);
	// NextAuth switches to the __Secure- prefixed cookie (and requires the
	// Secure attribute) on https targets — a plain-named cookie would silently
	// fail to authenticate and every scenario would time out at the login page.
	const secure = url.protocol === 'https:';
	return {
		name: secure ? `__Secure-${SESSION_COOKIE_NAME}` : SESSION_COOKIE_NAME,
		value: sessionToken,
		domain: url.hostname,
		path: '/',
		httpOnly: true,
		secure,
		sameSite: 'Lax' as const,
	};
}
