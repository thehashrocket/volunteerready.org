const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock('@/server/lib/email', () => ({ sendEmail: mocks.sendEmail }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendRosterAddedEmail } from './sendRosterAddedEmail';

/** The HTML body passed to sendEmail (3rd positional arg). */
function bodyOf(call: unknown[]): string {
	return call[2] as string;
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.sendEmail.mockResolvedValue(true);
});

describe('sendRosterAddedEmail', () => {
	it('escapes a script tag in the org name', async () => {
		// Org names are org-controlled input typed by a coordinator, and this
		// body lands in a THIRD PARTY's inbox as HTML.
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: '<script>alert(1)</script>Shelter',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).not.toContain('<script>');
		expect(body).toContain('&lt;script&gt;');
	});

	it('escapes the coordinator name too', async () => {
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			addedByName: '<img src=x onerror=alert(1)>',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).not.toContain('<img');
		expect(body).toContain('&lt;img');
	});

	it('escapes quotes and ampersands, not just angle brackets', async () => {
		// An unescaped quote can break out of an HTML attribute even with no
		// angle brackets present.
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: `Bob's "Big" Shelter & Co`,
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).toContain('&#39;');
		expect(body).toContain('&quot;');
		expect(body).toContain('&amp;');
	});

	it('names the coordinator when known', async () => {
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			addedByName: 'Grace Hopper',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).toContain('Grace Hopper');
		expect(body).toContain('Helping Hands');
	});

	it('falls back to the org alone when the coordinator is unknown', async () => {
		// Better to say less than to invent a vague actor.
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			addedByName: null,
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).toContain('Helping Hands');
		expect(body).not.toContain('undefined');
		expect(body).not.toContain('null');
	});

	it('tells the recipient where to leave the roster', async () => {
		// Security §2 states this recipient "can remove the roster link". If the
		// email does not say where, that mitigation does not exist for them.
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).toContain('/app/profile');
		expect(body).toMatch(/leave/i);
	});

	it('does not mark itself critical or request unclaimed suppression', async () => {
		// The recipient is ACTIVE by definition, and the guard is opt-in, so the
		// correct call is a plain one with no opts.
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
		});

		expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
		expect(mocks.sendEmail.mock.calls[0][3]).toBeUndefined();
	});
});
