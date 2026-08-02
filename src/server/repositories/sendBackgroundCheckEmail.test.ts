const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock('@/server/lib/email', () => ({ sendEmail: mocks.sendEmail }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendBackgroundCheckInitiatedEmail } from './sendBackgroundCheckEmail';

/** The HTML body passed to sendEmail (3rd positional arg). */
function bodyOf(call: unknown[]): string {
	return call[2] as string;
}

/** The subject line passed to sendEmail (2nd positional arg). */
function subjectOf(call: unknown[]): string {
	return call[1] as string;
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.sendEmail.mockResolvedValue(true);
});

describe('sendBackgroundCheckInitiatedEmail', () => {
	it('escapes a script tag in the org name', async () => {
		// Org names are org-controlled input typed by a coordinator, and this body
		// lands in a THIRD PARTY's inbox as HTML. Same rule as sendRosterAddedEmail.
		await sendBackgroundCheckInitiatedEmail({
			to: 'ada@example.com',
			orgName: '<script>alert(1)</script>Shelter',
			providerName: 'Checkr',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).not.toContain('<script>');
		expect(body).toContain('&lt;script&gt;');
	});

	it('escapes quotes and ampersands, not just angle brackets', async () => {
		await sendBackgroundCheckInitiatedEmail({
			to: 'ada@example.com',
			orgName: `Bob's "Big" Shelter & Co`,
			providerName: 'Checkr',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).toContain('&#39;');
		expect(body).toContain('&quot;');
		expect(body).toContain('&amp;');
	});

	it('escapes the provider name too', async () => {
		// providerName is service-supplied today, so this is defence in depth — but
		// it is interpolated four times, which is exactly the shape that rots when
		// someone later feeds it from a database column.
		await sendBackgroundCheckInitiatedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			providerName: '<img src=x onerror=alert(1)>',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).not.toContain('<img');
		expect(body).toContain('&lt;img');
	});

	it('names the org and the provider', async () => {
		await sendBackgroundCheckInitiatedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			providerName: 'Sterling',
		});

		const call = mocks.sendEmail.mock.calls[0];
		// The org belongs in the SUBJECT: this arrives cold, and a subject that
		// does not say who is asking reads as phishing.
		expect(subjectOf(call)).toContain('Helping Hands');
		expect(bodyOf(call)).toContain('Helping Hands');
		expect(bodyOf(call)).toContain('Sterling');
	});

	it('states that SSN and DOB went to the provider and are not stored here', async () => {
		// The whole point of the notice is that the subject learns what left, and
		// where. Dropping this sentence turns it into an unactionable ping.
		await sendBackgroundCheckInitiatedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			providerName: 'Checkr',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).toMatch(/social security number/i);
		expect(body).toMatch(/date of birth/i);
		expect(body).toMatch(/does not store/i);
	});

	it('gives a recourse path that does not require an account', async () => {
		// A volunteer added from a spreadsheet has no account and cannot reach the
		// Leave control at all (P3 in docs/TODOS.md), so the notice MUST name a
		// human path. If this assertion is deleted, the weakest-consent population
		// is told something happened and given nowhere to go.
		await sendBackgroundCheckInitiatedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			providerName: 'Checkr',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).toMatch(/did not agree/i);
		expect(body).toContain('privacy@volunteerready.org');
	});

	it('states the dispute right', async () => {
		// /terms §6 promises this. The email is where a real person meets it.
		await sendBackgroundCheckInitiatedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			providerName: 'Checkr',
		});

		expect(bodyOf(mocks.sendEmail.mock.calls[0])).toMatch(/dispute/i);
	});

	it('links account holders to the profile surface and is honest about its limit', async () => {
		await sendBackgroundCheckInitiatedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			providerName: 'Checkr',
		});

		const body = bodyOf(mocks.sendEmail.mock.calls[0]);
		expect(body).toContain('/app/profile');
		// Leaving writes an OrgVolunteerBlock, which refuses the NEXT check — it
		// cannot recall one already at the provider. Promising otherwise would be
		// the same class of lie the roster confirm copy was corrected for.
		expect(body).toMatch(/cannot stop one\s+already underway/i);
	});

	it('propagates sendEmail’s result instead of swallowing it', async () => {
		// `sendEmail` does NOT throw on failure — it returns false for a Resend
		// error and for a bounce-suppressed address. Discarding that boolean here
		// is what made a lost disclosure indistinguishable from a delivered one;
		// the caller logs DISCLOSURE NOT SENT off this value.
		mocks.sendEmail.mockResolvedValue(false);

		await expect(
			sendBackgroundCheckInitiatedEmail({
				to: 'ada@example.com',
				orgName: 'Helping Hands',
				providerName: 'Checkr',
			}),
		).resolves.toBe(false);

		mocks.sendEmail.mockResolvedValue(true);
		await expect(
			sendBackgroundCheckInitiatedEmail({
				to: 'ada@example.com',
				orgName: 'Helping Hands',
				providerName: 'Checkr',
			}),
		).resolves.toBe(true);
	});

	it('does not mark itself critical or request unclaimed suppression', async () => {
		// Load-bearing, not incidental. `suppressUnclaimed` is opt-in, and a
		// spreadsheet-added volunteer who has never logged in is exactly the
		// person with the weakest consent and the strongest claim to be told.
		// Opting in here would remove the witness from the population that needs
		// it most.
		await sendBackgroundCheckInitiatedEmail({
			to: 'ada@example.com',
			orgName: 'Helping Hands',
			providerName: 'Checkr',
		});

		expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
		expect(mocks.sendEmail.mock.calls[0][3]).toBeUndefined();
	});
});
