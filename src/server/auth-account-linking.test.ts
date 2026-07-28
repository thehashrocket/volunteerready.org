import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// auth.ts pulls in the Prisma client (via PrismaAdapter and the email lib),
// which throws at import time without DATABASE_URL. Stub the data layer.
vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));
vi.mock('@next-auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));
vi.mock('@/server/lib/email', () => ({ sendEmail: vi.fn() }));
vi.mock('@/server/lib/resend', () => ({
	getFromEmail: () => 'test@example.test',
	getResend: () => ({ emails: { send: vi.fn() } }),
}));
const { mockSendNewUserAlert, mockClaimAccountOnSignIn, mockWasCreatedWithin } =
	vi.hoisted(() => ({
		mockSendNewUserAlert: vi.fn(),
		mockClaimAccountOnSignIn: vi.fn(),
		mockWasCreatedWithin: vi.fn(),
	}));

vi.mock('@/server/lib/admin-alerts', () => ({
	sendNewUserAlert: mockSendNewUserAlert,
}));
vi.mock('@/server/services/accountClaimService', () => ({
	claimAccountOnSignIn: mockClaimAccountOnSignIn,
}));
vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	wasUserCreatedWithin: mockWasCreatedWithin,
}));

/**
 * `authOptions` is a module-scope const, so the provider's
 * `allowDangerousEmailAccountLinking` value is fixed at import time. That is
 * unavoidable — next-auth builds provider config once — and acceptable for a
 * kill switch, which is set as a deploy-time env var. It does mean these tests
 * must reset the module registry and re-import rather than just setting
 * process.env, and it is the one place the T4/T5 "read at call time" rule in
 * lib/env-flags.ts genuinely cannot hold.
 */
async function loadGoogleProvider() {
	vi.resetModules();
	const { authOptions } = await import('./auth');
	const provider = authOptions.providers.find((p) => p.id === 'google');
	if (!provider) throw new Error('Google provider not registered');
	// next-auth v4 merges caller options under `provider.options` at runtime.
	// Reading the top-level field alone would test next-auth's default, not ours.
	// biome-ignore lint/suspicious/noExplicitAny: provider shape is loosely typed
	const p = provider as any;
	return {
		allowLinking:
			p.options?.allowDangerousEmailAccountLinking ??
			p.allowDangerousEmailAccountLinking,
	};
}

async function loadEvents() {
	vi.resetModules();
	const { authOptions } = await import('./auth');
	return authOptions.events ?? {};
}

describe('T6 — Google account linking', () => {
	afterEach(() => {
		delete process.env.GOOGLE_EMAIL_LINKING_ENABLED;
	});

	it('SECURITY: links by verified email so a staff-created shadow user is not locked out', async () => {
		delete process.env.GOOGLE_EMAIL_LINKING_ENABLED;

		const { allowLinking } = await loadGoogleProvider();

		// Without this, next-auth throws AccountNotLinkedError for any User row
		// with a matching email and no linked Account — exactly the shape of a
		// volunteer whose address an org typed. They would be permanently unable
		// to sign in with Google, by an action they never took.
		expect(allowLinking).toBe(true);
	});

	it('GOOGLE_EMAIL_LINKING_ENABLED=false turns linking back off', async () => {
		process.env.GOOGLE_EMAIL_LINKING_ENABLED = 'false';

		const { allowLinking } = await loadGoogleProvider();

		expect(allowLinking).toBe(false);
	});

	it('SECURITY: a mistyped kill switch leaves linking on rather than reinstating the lockout', async () => {
		for (const value of ['0', 'no', 'off', '', 'FALSE']) {
			process.env.GOOGLE_EMAIL_LINKING_ENABLED = value;

			const { allowLinking } = await loadGoogleProvider();

			expect(allowLinking, `value=${JSON.stringify(value)}`).toBe(true);
		}
	});
});

describe('T5 — accountState flip on sign-in', () => {
	beforeEach(() => {
		mockClaimAccountOnSignIn.mockReset();
		mockClaimAccountOnSignIn.mockResolvedValue(true);
	});

	it('SECURITY: hooks events.signIn, not events.updateUser', async () => {
		const events = await loadEvents();

		// The design plan specified `updateUser`. On the Google account-linking
		// path next-auth assigns `user = userByEmail` and never calls
		// `adapter.updateUser`, so `updateUser` never fires — a volunteer who
		// claimed via Google would stay UNCLAIMED and email-suppressed forever.
		expect(events.signIn).toBeTypeOf('function');
		expect(events.updateUser).toBeUndefined();
	});

	it('claims the account for the signing-in user', async () => {
		const events = await loadEvents();

		await events.signIn?.({
			user: { id: 'user-1', email: 'a@b.test' },
			// biome-ignore lint/suspicious/noExplicitAny: partial event message
		} as any);

		expect(mockClaimAccountOnSignIn).toHaveBeenCalledWith('user-1');
	});

	it('SECURITY: a failed claim must never break sign-in', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mockClaimAccountOnSignIn.mockRejectedValueOnce(new Error('db down'));

		const events = await loadEvents();

		// A throw here surfaces to the person as a failed sign-in. Claiming is a
		// side effect of signing in and must not be able to prevent it.
		await expect(
			events.signIn?.({
				user: { id: 'user-1', email: 'a@b.test' },
				// biome-ignore lint/suspicious/noExplicitAny: partial event message
			} as any),
		).resolves.toBeUndefined();

		expect(consoleError).toHaveBeenCalledWith(
			'[auth] Failed to claim account on sign-in:',
			expect.objectContaining({ userId: 'user-1' }),
		);

		consoleError.mockRestore();
	});

	it('awaits the claim rather than detaching it', async () => {
		// A detached promise can be killed when the serverless response returns,
		// leaving the volunteer UNCLAIMED and silently email-suppressed.
		let resolved = false;
		mockClaimAccountOnSignIn.mockImplementationOnce(async () => {
			await new Promise((r) => setTimeout(r, 5));
			resolved = true;
			return true;
		});

		const events = await loadEvents();
		await events.signIn?.({
			user: { id: 'user-1', email: 'a@b.test' },
			// biome-ignore lint/suspicious/noExplicitAny: partial event message
		} as any);

		expect(resolved).toBe(true);
	});
});

describe('new-user alert vs. account linking', () => {
	beforeEach(() => {
		mockSendNewUserAlert.mockReset();
		mockWasCreatedWithin.mockReset();
		mockSendNewUserAlert.mockResolvedValue(undefined);
	});

	async function fireCreateUser(userId = 'user-1') {
		const events = await loadEvents();
		await events.createUser?.({
			user: { id: userId, email: 'a@b.test', name: 'Ada' },
			// biome-ignore lint/suspicious/noExplicitAny: partial event message
		} as any);
	}

	it('alerts for a genuinely new signup', async () => {
		mockWasCreatedWithin.mockResolvedValueOnce(true);

		await fireCreateUser();

		expect(mockSendNewUserAlert).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'user-1', email: 'a@b.test' }),
		);
	});

	it('SECURITY: does not alert when an existing row was merely linked', async () => {
		// next-auth calls events.createUser unconditionally after its
		// `user = userByEmail` / `createUser()` if/else, so enabling
		// allowDangerousEmailAccountLinking makes this event fire for rows that
		// already existed. Without this guard every staff-created volunteer
		// claiming via Google pages admins about a weeks-old "new user".
		mockWasCreatedWithin.mockResolvedValueOnce(false);

		await fireCreateUser();

		expect(mockSendNewUserAlert).not.toHaveBeenCalled();
	});

	it('falls back to alerting if the age check fails', async () => {
		// Alerting is best-effort; a spurious alert beats a silently missed
		// signup, so the failure direction is "send".
		mockWasCreatedWithin.mockRejectedValueOnce(new Error('db down'));

		await fireCreateUser();

		expect(mockSendNewUserAlert).toHaveBeenCalled();
	});

	it('SECURITY: an alert failure never breaks sign-up', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mockWasCreatedWithin.mockResolvedValueOnce(true);
		mockSendNewUserAlert.mockRejectedValueOnce(new Error('resend down'));

		await expect(fireCreateUser()).resolves.toBeUndefined();

		consoleError.mockRestore();
	});
});
