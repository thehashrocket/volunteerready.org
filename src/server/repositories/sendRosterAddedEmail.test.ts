const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock('@/server/lib/email', () => ({ sendEmail: mocks.sendEmail }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rosterAddedEmailSubject } from '@/server/domain/org-volunteer';
import { sendRosterAddedEmail } from './sendRosterAddedEmail';

/** The HTML body passed to sendEmail (3rd positional arg). */
function bodyOf(call: unknown[]): string {
	return call[2] as string;
}

/** The subject passed to sendEmail (2nd positional arg). */
function subjectOf(call: unknown[]): string {
	return call[1] as string;
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
		// The exit REVOKES as of v0.37.0.0; before that it only dropped a roster
		// row. `/leave/i` alone passed under both meanings, so it cannot tell the
		// email is still describing the old one.
		expect(body).toMatch(/remove that\s+access/i);
	});

	it('names the profile-visibility capability, but not background checks', async () => {
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).toMatch(/see your volunteer\s+profile/i);
		// Deliberate omission, pinned so it is a decision rather than a drift: this
		// is a cold notice, and leading with the SSN-collecting capability would
		// misrepresent a feature most orgs never touch. The full list lives on the
		// /app/profile confirm, where someone who followed the link deliberates.
		// If this assertion is ever flipped, flip the card description with it.
		expect(body).not.toMatch(/background check/i);
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

	it('sends the subject `rosterAddedEmailSubject` derives', async () => {
		// The `--notify-only` recovery mode correlates against EmailEvent.subject
		// to avoid re-sending a notice that already went out, and it builds the
		// string with this helper. A second hand-typed copy here would drift the
		// moment the copy is reworded, and the symptom is a recovery run silently
		// re-emailing everyone.
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
		});

		expect(subjectOf(mocks.sendEmail.mock.calls[0])).toBe(
			rosterAddedEmailSubject('Helping Hands'),
		);
	});

	it('puts the RAW org name in the subject, escaping only the body', async () => {
		// Escaping is an HTML concern. An escaped subject reaches the inbox as
		// literal `&amp;`, and it would also stop the EmailEvent correlation
		// above matching what `rosterAddedEmailSubject` rebuilds.
		await sendRosterAddedEmail({
			to: 'ada@example.com',
			orgName: 'Cats & Dogs',
		});

		expect(subjectOf(mocks.sendEmail.mock.calls[0])).toBe(
			'Cats & Dogs added you to their volunteer roster',
		);
	});

	it('SECURITY: returns FALSE when the send did not happen', async () => {
		// `sendEmail` returns `false` for a Resend error and for a
		// bounce-suppressed address — it does NOT throw. This function used to
		// `await` it and discard the result, so every caller's try/catch was dead
		// on the likeliest failure and the importer counted a silent failure as a
		// delivered notice.
		mocks.sendEmail.mockResolvedValue(false);

		await expect(
			sendRosterAddedEmail({ to: 'ada@example.com', orgName: 'Helping Hands' }),
		).resolves.toBe(false);
	});

	it('returns TRUE when the send happened', async () => {
		// The contrast case. Without it the assertion above passes for a function
		// that returns `false` unconditionally.
		mocks.sendEmail.mockResolvedValue(true);

		await expect(
			sendRosterAddedEmail({ to: 'ada@example.com', orgName: 'Helping Hands' }),
		).resolves.toBe(true);
	});
});
