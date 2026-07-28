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

// ---------------------------------------------------------------------------
// Magic-link helper — drives the REAL NextAuth callback chain.
//
// Every other authenticated spec inserts a `Session` row and sets the cookie,
// which is fine when the spec is about a page rather than about signing in.
// It also means nothing in the suite has ever executed next-auth's callback
// route, so the claims `src/server/auth.ts` makes about it (that `events.signIn`
// fires on both provider branches, that the UNCLAIMED -> ACTIVE flip happens
// there) rest on reading the compiled library.
//
// This mints the token half of a magic link so a spec can navigate to the
// callback URL directly. Only the Resend send is bypassed —
// `getUserFromEmail`, `callbacks.signIn`, `callbackHandler`, session creation
// and `events.signIn` all run for real. Bypassing the send is deliberate and
// not just convenience: RESEND_FROM_EMAIL is the shared `resend.dev` sandbox
// sender, so a real send to a fixture address is rejected, and driving
// `/api/auth/signin/email` against a live API key would mail arbitrary
// addresses from a test run.
//
// The DB stores sha256(rawToken + secret) and never the raw token
// (`next-auth/core/lib/utils.js` hashToken), so a magic link cannot be
// recovered by reading the row — it has to be minted alongside it. The secret
// is NEXTAUTH_SECRET: `authOptions` sets neither `secret` nor a per-provider
// `secret`, and `next-auth/next` fills `options.secret` from that env var.
// ---------------------------------------------------------------------------

/**
 * Mint a usable magic link for `email` and return a path for `page.goto()`.
 *
 * Writes the hashed token through Prisma **on purpose**. `VerificationToken.expires`
 * is `timestamp without time zone`, so an insert made with raw SQL and a JS
 * `Date` stores local wall-clock time that Prisma then reads back as UTC. West
 * of UTC the token arrives already expired and the callback redirects to
 * `error=Verification`; east of UTC it silently passes. Prisma converts
 * correctly in both directions — keep this off the raw-SQL path.
 */
export async function mintMagicLinkUrl(options: {
	email: string;
	callbackUrl?: string;
	ttlMs?: number;
}): Promise<string> {
	const secret = process.env.NEXTAUTH_SECRET;
	if (!secret) {
		throw new Error(
			'NEXTAUTH_SECRET is not set — magic-link specs cannot hash a token the callback will accept',
		);
	}

	const { createHash, randomBytes } = await import('node:crypto');
	// Same shape next-auth generates in core/lib/email/signin.js.
	const rawToken = randomBytes(32).toString('hex');

	await getPrisma().verificationToken.create({
		data: {
			identifier: options.email,
			token: createHash('sha256').update(`${rawToken}${secret}`).digest('hex'),
			expires: new Date(Date.now() + (options.ttlMs ?? 60 * 60 * 1000)),
		},
	});

	const params = new URLSearchParams({
		token: rawToken,
		email: options.email,
		callbackUrl: options.callbackUrl ?? '/app',
	});
	return `/api/auth/callback/email?${params}`;
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
