/**
 * T15 — the Google half of the identity paths, against real next-auth and real
 * Postgres. Run with: pnpm test:integration
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/server/auth.ts` makes four load-bearing claims about next-auth's
 * internals, each currently backed only by having read the compiled library:
 *
 *   1. Without `allowDangerousEmailAccountLinking`, a `User` row with a
 *      matching email and no linked `Account` throws `AccountNotLinkedError` —
 *      i.e. every staff-created shadow volunteer is locked out of Google.
 *   2. With it, the existing row is adopted rather than duplicated.
 *   3. On that adopt path `adapter.updateUser` is never called, so
 *      `events.updateUser` never fires — which is the entire reason the claim
 *      hook is `events.signIn`. (See the SECURITY block at auth.ts:143.)
 *   4. `events.createUser` fires anyway for a row that already existed, which
 *      is why the new-user alert needs an age check (auth.ts:128).
 *
 * WHY NOT E2E
 * -----------
 * `e2e/staff-created-volunteers.spec.ts` drives the real callback route for the
 * magic-link branch, but Google cannot be reached the same way: `authOptions`
 * constructs `GoogleProvider` with Google's own discovery document, the token
 * exchange happens server-side, and there is no seam to point it at a mock IdP
 * without adding one to production code. Note also that the e2e magic-link test
 * *cannot* distinguish claims 3 and 4 even in principle — on the email branch
 * `updateUser` genuinely does fire. Only the oauth branch separates them, and
 * that separation is what this file tests.
 *
 * Calling next-auth's `callbackHandler` directly executes the exact code those
 * comments describe. It also runs in CI, which e2e does not.
 *
 * WHY THE DEEP REQUIRE
 * --------------------
 * `core/lib/callback-handler` is not in next-auth's `exports` map, so it is
 * resolved by path off the package root. That is a deliberate reach past the
 * package boundary: the alternative is leaving the four claims unverified. If a
 * next-auth upgrade moves or rewrites this file, this test fails loudly — which
 * is the correct alarm, because those comments say "Verified against next-auth
 * 4.24.14" and would need re-verifying too.
 */

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEnabled } from '@/server/lib/env-flags';
import { prisma } from '@/server/repositories/prisma';
import { claimAccountOnSignIn } from '@/server/services/accountClaimService';

const require_ = createRequire(import.meta.url);
const NEXT_AUTH_ROOT = path.dirname(require_.resolve('next-auth'));

type CallbackHandler = (params: {
	sessionToken?: string;
	profile: Record<string, unknown>;
	account: Record<string, unknown>;
	options: Record<string, unknown>;
}) => Promise<{ user: { id: string }; isNewUser: boolean }>;

const callbackHandler: CallbackHandler = require_(
	path.join(NEXT_AUTH_ROOT, 'core/lib/callback-handler.js'),
).default;

const PREFIX = '__auth_linking_integration__';

afterEach(async () => {
	// ACCOUNT_CLAIMED rows carry no orgId and `actor` is onDelete: SetNull, so
	// they have to be deleted by this file's own user ids — an action-scoped
	// sweep would take every other suite's rows with it.
	const users = await prisma.user.findMany({
		where: { email: { startsWith: PREFIX } },
		select: { id: true },
	});
	const ids = users.map((u) => u.id);
	if (ids.length > 0) {
		await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
	}
	// Account and Session cascade from User.
	await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
	delete process.env.GOOGLE_EMAIL_LINKING_ENABLED;
	delete process.env.ACCOUNT_STATE_FLIP_ENABLED;
});

/**
 * The adapter next-auth would use in production, with every method observable.
 *
 * Spying matters as much as the return values here: claim 3 is an assertion
 * that a method is *not* called, which no amount of reading the resulting rows
 * can establish.
 */
function instrumentedAdapter() {
	// biome-ignore lint/suspicious/noExplicitAny: PrismaAdapter expects the node_modules client
	const base = PrismaAdapter(prisma as any) as Record<string, unknown>;
	const spies: Record<string, ReturnType<typeof vi.fn>> = {};
	const wrapped: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(base)) {
		if (typeof value !== 'function') {
			wrapped[key] = value;
			continue;
		}
		const spy = vi.fn(value as (...args: unknown[]) => unknown);
		spies[key] = spy;
		wrapped[key] = spy;
	}
	return { adapter: wrapped, spies };
}

function makeOptions(input: {
	adapter: Record<string, unknown>;
	allowLinking: boolean;
	events?: Record<string, unknown>;
}) {
	return {
		adapter: input.adapter,
		events: input.events ?? {},
		jwt: {},
		session: {
			strategy: 'database',
			maxAge: 30 * 24 * 60 * 60,
			generateSessionToken: () => randomUUID(),
		},
		provider: {
			id: 'google',
			allowDangerousEmailAccountLinking: input.allowLinking,
		},
	};
}

const googleAccount = (sub: string) => ({
	provider: 'google',
	type: 'oauth',
	providerAccountId: sub,
});

/** A volunteer whose address org staff typed: exists, but has never signed in. */
async function makeShadowUser(local: string) {
	return prisma.user.create({
		data: {
			email: `${PREFIX}${local}@example.com`,
			name: 'Shadow Volunteer',
			accountState: 'UNCLAIMED',
		},
		select: { id: true, email: true, createdAt: true },
	});
}

describe('next-auth callbackHandler — Google against a staff-created shadow user', () => {
	it('SECURITY: without allowDangerousEmailAccountLinking, the shadow user is locked out', async () => {
		// This is the failure the flag exists to prevent, reproduced against the
		// real library rather than asserted from its source. The volunteer did
		// nothing to cause it and has no way to undo it.
		const user = await makeShadowUser('lockedout');
		const { adapter } = instrumentedAdapter();

		await expect(
			callbackHandler({
				profile: { id: 'g-1', email: user.email, name: 'Shadow Volunteer' },
				account: googleAccount('g-sub-lockedout'),
				options: makeOptions({ adapter, allowLinking: false }),
			}),
		).rejects.toMatchObject({ name: 'AccountNotLinkedError' });

		// Nothing was linked, so a retry hits the same wall.
		expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);
	});

	it('adopts the existing row instead of creating a second user', async () => {
		const user = await makeShadowUser('adopted');
		const { adapter } = instrumentedAdapter();

		const result = await callbackHandler({
			profile: { id: 'g-2', email: user.email, name: 'Shadow Volunteer' },
			account: googleAccount('g-sub-adopted'),
			options: makeOptions({ adapter, allowLinking: true }),
		});

		expect(result.user.id).toBe(user.id);
		// The duplicate would collide with User_email_key anyway; what matters is
		// that the volunteer keeps the id their roster row and signups point at.
		expect(
			await prisma.user.count({ where: { email: { startsWith: PREFIX } } }),
		).toBe(1);
		const account = await prisma.account.findFirst({
			where: { userId: user.id },
			select: { provider: true, providerAccountId: true },
		});
		expect(account).toEqual({
			provider: 'google',
			providerAccountId: 'g-sub-adopted',
		});
	});

	it('SECURITY: never calls updateUser when adopting — this is why the claim hooks events.signIn', async () => {
		const user = await makeShadowUser('noupdate');
		const { adapter, spies } = instrumentedAdapter();
		const events = {
			updateUser: vi.fn(),
			createUser: vi.fn(),
			signIn: vi.fn(),
		};

		await callbackHandler({
			profile: { id: 'g-3', email: user.email, name: 'Shadow Volunteer' },
			account: googleAccount('g-sub-noupdate'),
			options: makeOptions({ adapter, allowLinking: true, events }),
		});

		// The design plan originally specified events.updateUser. Had it shipped,
		// a volunteer who claimed their account with Google would have stayed
		// UNCLAIMED — and therefore silently email-suppressed — forever.
		expect(spies.updateUser).not.toHaveBeenCalled();
		expect(events.updateUser).not.toHaveBeenCalled();
	});

	it('the email branch DOES call updateUser — the asymmetry is the whole point', async () => {
		// Without this contrast the test above proves only that *something* did
		// not happen, and would stay green if callbackHandler stopped calling
		// updateUser anywhere at all.
		const user = await makeShadowUser('emailbranch');
		const { adapter, spies } = instrumentedAdapter();
		const events = { updateUser: vi.fn() };

		await callbackHandler({
			profile: { id: user.id, email: user.email },
			account: {
				provider: 'email',
				type: 'email',
				providerAccountId: user.email,
			},
			options: makeOptions({ adapter, allowLinking: true, events }),
		});

		expect(spies.updateUser).toHaveBeenCalled();
		expect(events.updateUser).toHaveBeenCalled();
	});

	it('fires events.createUser for a row that already existed — hence the age check', async () => {
		const user = await makeShadowUser('notnew');
		const { adapter } = instrumentedAdapter();
		const events = { createUser: vi.fn() };

		await callbackHandler({
			profile: { id: 'g-4', email: user.email, name: 'Shadow Volunteer' },
			account: googleAccount('g-sub-notnew'),
			options: makeOptions({ adapter, allowLinking: true, events }),
		});

		// next-auth fires this unconditionally after its
		// `user = userByEmail` / `createUser()` if/else. Without
		// wasUserCreatedWithin() gating it, every staff-created volunteer who
		// claims via Google pages admins about a weeks-old "new user".
		expect(events.createUser).toHaveBeenCalledTimes(1);
		expect(events.createUser).toHaveBeenCalledWith(
			expect.objectContaining({
				user: expect.objectContaining({ id: user.id }),
			}),
		);
	});

	it('adopting does NOT claim the account — only events.signIn does', async () => {
		// Closes the loop between the two halves of the design: linking is what
		// lets the volunteer in, the signIn event is what stops them being
		// treated as someone who never showed up.
		const user = await makeShadowUser('claimloop');
		const { adapter } = instrumentedAdapter();

		await callbackHandler({
			profile: { id: 'g-5', email: user.email, name: 'Shadow Volunteer' },
			account: googleAccount('g-sub-claimloop'),
			options: makeOptions({ adapter, allowLinking: true }),
		});

		expect(
			(await prisma.user.findUnique({ where: { id: user.id } }))?.accountState,
		).toBe('UNCLAIMED');

		await claimAccountOnSignIn(user.id);

		const after = await prisma.user.findUnique({ where: { id: user.id } });
		expect(after?.accountState).toBe('ACTIVE');
		expect(after?.claimedAt).not.toBeNull();
	});
});

describe('kill switches, end to end', () => {
	it('GOOGLE_EMAIL_LINKING_ENABLED=false reinstates the lockout', async () => {
		// The provider-construction half (env var -> authOptions) is covered by
		// auth-account-linking.test.ts; importing authOptions here would also drag
		// in getFromEmail(), which throws without RESEND_FROM_EMAIL — a var CI
		// deliberately does not set. This asserts the other half: that the value
		// the kill switch produces actually changes what next-auth does.
		process.env.GOOGLE_EMAIL_LINKING_ENABLED = 'false';
		const user = await makeShadowUser('killswitch');
		const { adapter } = instrumentedAdapter();

		await expect(
			callbackHandler({
				profile: { id: 'g-6', email: user.email },
				account: googleAccount('g-sub-killswitch'),
				options: makeOptions({
					adapter,
					allowLinking: isEnabled('GOOGLE_EMAIL_LINKING_ENABLED'),
				}),
			}),
		).rejects.toMatchObject({ name: 'AccountNotLinkedError' });
	});

	it('ACCOUNT_STATE_FLIP_ENABLED=false leaves a signed-in volunteer UNCLAIMED', async () => {
		process.env.ACCOUNT_STATE_FLIP_ENABLED = 'false';
		const user = await makeShadowUser('noflip');

		await expect(claimAccountOnSignIn(user.id)).resolves.toBe(false);

		expect(
			(await prisma.user.findUnique({ where: { id: user.id } }))?.accountState,
		).toBe('UNCLAIMED');
	});
});
