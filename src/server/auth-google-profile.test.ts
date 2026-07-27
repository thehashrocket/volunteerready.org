import { describe, expect, it, vi } from 'vitest';

// auth.ts pulls in the Prisma client (via PrismaAdapter and the email lib),
// which throws at import time without DATABASE_URL. Only the pure profile()
// mapper is under test, so stub the data layer.
vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));
vi.mock('@next-auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));
vi.mock('@/server/lib/email', () => ({ sendEmail: vi.fn() }));
// getFromEmail lives in lib/resend and throws unless RESEND_FROM_EMAIL is set.
vi.mock('@/server/lib/resend', () => ({
	getFromEmail: () => 'test@example.test',
	getResend: () => ({ emails: { send: vi.fn() } }),
}));

import { authOptions } from './auth';

/**
 * The Google provider's `profile()` mapper is the READ-path half of email
 * canonicalization.
 *
 * The database trigger (migration 20260726225900) lowercases every WRITE to
 * `User.email`. It cannot touch a LOOKUP: PrismaAdapter's `getUserByEmail`
 * calls `findUnique({ where: { email } })` with whatever the IdP sent. Without
 * this mapper, a Google profile carrying uppercase misses the lowercased row,
 * NextAuth falls through to `createUser`, the trigger lowercases the insert,
 * and it collides with `User_email_key` — a hard sign-in failure for someone
 * who already has an account.
 */
function googleProfile() {
	const provider = authOptions.providers.find((p) => p.id === 'google');
	if (!provider) throw new Error('Google provider not registered');
	// next-auth v4 keeps caller-supplied options under `provider.options` and
	// merges them over the built-in defaults at runtime (parseProviders). Reading
	// `provider.profile` here would silently test next-auth's DEFAULT mapper and
	// pass no matter what we configured.
	// biome-ignore lint/suspicious/noExplicitAny: provider shape is loosely typed
	const p = provider as any;
	const mapper = p.options?.profile ?? p.profile;
	if (!mapper) throw new Error('Google provider has no profile() mapper');
	return mapper as (p: Record<string, unknown>) => {
		id: string;
		name: string;
		email: string | null;
		image: string;
	};
}

const BASE = {
	sub: 'google-123',
	name: 'Ada Lovelace',
	picture: 'https://example.test/a.png',
};

describe('Google provider email normalization', () => {
	it.each([
		['Bob@Shelter.ORG', 'bob@shelter.org'],
		['  Padded@Example.com  ', 'padded@example.com'],
		['ALLCAPS@EXAMPLE.COM', 'allcaps@example.com'],
		['already@lower.com', 'already@lower.com'],
	])('normalizes %s to %s', (input, expected) => {
		expect(googleProfile()({ ...BASE, email: input }).email).toBe(expected);
	});

	it('matches the canonical form the database stores', async () => {
		// If these two ever disagree, the lookup misses the row the trigger wrote
		// and the lockout returns.
		const { normalizeEmail } = await import('@/server/domain/org-volunteer');
		const raw = 'Mixed.Case+tag@Example.Co.UK';
		expect(googleProfile()({ ...BASE, email: raw }).email).toBe(
			normalizeEmail(raw),
		);
	});

	it('passes through a missing email as null rather than crashing', () => {
		expect(googleProfile()({ ...BASE, email: undefined }).email).toBeNull();
	});

	it('preserves the identity fields NextAuth needs', () => {
		const result = googleProfile()({ ...BASE, email: 'a@b.com' });
		expect(result.id).toBe('google-123');
		expect(result.name).toBe('Ada Lovelace');
		expect(result.image).toBe('https://example.test/a.png');
	});
});
