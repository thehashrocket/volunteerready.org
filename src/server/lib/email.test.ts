/**
 * `sendEmail`'s failure contract.
 *
 * The boolean this returns is a CONTROL for several senders — the background-check
 * disclosure and the roster-added notice are each the only message their recipient
 * ever gets, and each carries the only link to the surface where they can revoke
 * the access it announces. A caller that reads the boolean is only as correct as
 * the boolean is, so what is pinned here is that every way a send can fail
 * actually produces `false`.
 *
 * The one that got away for a long time: Resend does NOT throw on a rejected
 * send. Its response type is `{ data, error: null } | { data: null, error }`, so
 * a 429 rate limit resolves normally — and this function used to read only
 * `result?.data?.id`, write a SENT `EmailEvent`, and return `true`.
 */

const mocks = vi.hoisted(() => ({
	send: vi.fn(),
	emailEventCreate: vi.fn(),
	bounceFindUnique: vi.fn(),
	findAccountStateByEmail: vi.fn(),
	isEnabled: vi.fn(),
}));

vi.mock('@/server/lib/resend', () => ({
	getResend: () => ({ emails: { send: mocks.send } }),
	getFromEmail: () => 'test@volunteerready.test',
}));

vi.mock('@/server/lib/env-flags', () => ({ isEnabled: mocks.isEnabled }));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		emailEvent: { create: mocks.emailEventCreate },
		emailBounceStatus: { findUnique: mocks.bounceFindUnique },
	},
}));

vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	findAccountStateByEmail: mocks.findAccountStateByEmail,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from './email';

/** Lets the fire-and-forget EmailEvent write settle. */
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.bounceFindUnique.mockResolvedValue(null);
	mocks.findAccountStateByEmail.mockResolvedValue(null);
	mocks.isEnabled.mockReturnValue(false);
	mocks.emailEventCreate.mockResolvedValue({ id: 'ev_1' });
	mocks.send.mockResolvedValue({ data: { id: 're_1' }, error: null });
});

describe('sendEmail', () => {
	it('returns true and logs a SENT event when Resend accepts', async () => {
		await expect(
			sendEmail('ada@example.test', 'Subject', '<p>hi</p>'),
		).resolves.toBe(true);
		await flush();

		expect(mocks.emailEventCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ eventType: 'SENT', resendId: 're_1' }),
			}),
		);
	});

	it('SECURITY: returns FALSE when Resend REJECTS without throwing', async () => {
		// The dominant failure, and the one a `try/catch` cannot see. Resend
		// resolves `{ data: null, error }` for a 429, a 401 and a network fault.
		mocks.send.mockResolvedValue({
			data: null,
			error: { name: 'rate_limit_exceeded', message: 'Too many requests' },
		});

		await expect(
			sendEmail('ada@example.test', 'Subject', '<p>hi</p>'),
		).resolves.toBe(false);
	});

	it('SECURITY: writes NO SENT event for a send Resend rejected', async () => {
		// The half that matters most. A phantom SENT row is what
		// `pnpm import:roster --notify-only` correlates against, so one written
		// here makes the recovery skip exactly the person whose notice was lost.
		mocks.send.mockResolvedValue({
			data: null,
			error: { name: 'rate_limit_exceeded', message: 'Too many requests' },
		});

		await sendEmail('ada@example.test', 'Subject', '<p>hi</p>');
		await flush();

		expect(mocks.emailEventCreate).not.toHaveBeenCalled();
	});

	it('returns false when the Resend client throws', async () => {
		// The contrast case. It passed the entire time the returns-an-error hole
		// above stood, which is why both are needed.
		mocks.send.mockRejectedValue(new Error('socket hang up'));

		await expect(
			sendEmail('ada@example.test', 'Subject', '<p>hi</p>'),
		).resolves.toBe(false);
	});

	it('returns false for a bounce-suppressed address, without calling Resend', async () => {
		mocks.bounceFindUnique.mockResolvedValue({
			suppressedAt: new Date(),
			bounceCount: 3,
		});

		await expect(
			sendEmail('bouncy@example.test', 'Subject', '<p>hi</p>'),
		).resolves.toBe(false);
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('still sends to a suppressed address when the mail is critical', async () => {
		// FCRA adverse-action notices bypass both guards by law.
		mocks.bounceFindUnique.mockResolvedValue({
			suppressedAt: new Date(),
			bounceCount: 9,
		});

		await expect(
			sendEmail('bouncy@example.test', 'Subject', '<p>hi</p>', {
				isCritical: true,
			}),
		).resolves.toBe(true);
		expect(mocks.send).toHaveBeenCalledTimes(1);
	});
});
