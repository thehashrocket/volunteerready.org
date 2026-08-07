import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/repositories/notificationRepo', () => ({
	createNotification: vi.fn(async () => ({ id: 'notif-1' })),
	getPreference: vi.fn(async () => null),
	markNotificationEmailSent: vi.fn(async () => ({})),
	getUnreadCount: vi.fn(),
	listNotifications: vi.fn(),
	markAllRead: vi.fn(),
	markRead: vi.fn(),
}));

vi.mock('@/server/lib/email', () => ({
	sendEmail: vi.fn(async () => true),
}));

import { sendEmail } from '@/server/lib/email';
import {
	createNotification,
	getPreference,
	markNotificationEmailSent,
} from '@/server/repositories/notificationRepo';
import { notify, tryNotify } from './notificationService';

const BASE = {
	userId: 'user-1',
	orgId: 'org-1',
	type: 'CREDENTIAL_EXPIRY' as const,
	title: 'Something expires soon',
	body: 'Body text',
};

const WITH_EMAIL = {
	...BASE,
	emailTo: 'owner@example.com',
	emailSubject: 'Subject line',
	emailHtml: '<p>hello</p>',
};

describe('notify', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('defaults both channels on when no preference row exists', async () => {
		const result = await notify(WITH_EMAIL);

		expect(createNotification).toHaveBeenCalled();
		expect(sendEmail).toHaveBeenCalledWith(
			'owner@example.com',
			'Subject line',
			'<p>hello</p>',
		);
		expect(result).toEqual({ inAppSent: true, emailSent: true });
	});

	it('reports emailSent: false rather than swallowing a failed send', async () => {
		// sendEmail returns false and never throws for a Resend rejection, a 429,
		// or a bounce-suppressed address. Callers that gate an idempotency stamp
		// on delivery can only learn that from the return value.
		vi.mocked(sendEmail).mockResolvedValueOnce(false);

		const result = await notify(WITH_EMAIL);

		expect(result).toEqual({ inAppSent: true, emailSent: false });
	});

	it('distinguishes "not attempted" from "attempted and failed"', async () => {
		const result = await notify(BASE);

		expect(sendEmail).not.toHaveBeenCalled();
		expect(result).toEqual({ inAppSent: true, emailSent: null });
	});

	it('respects an email opt-out', async () => {
		vi.mocked(getPreference).mockResolvedValueOnce({
			inApp: true,
			email: false,
		});

		const result = await notify(WITH_EMAIL);

		expect(sendEmail).not.toHaveBeenCalled();
		expect(createNotification).toHaveBeenCalled();
		expect(result).toEqual({ inAppSent: true, emailSent: null });
	});

	it('respects an in-app opt-out', async () => {
		vi.mocked(getPreference).mockResolvedValueOnce({
			inApp: false,
			email: true,
		});

		const result = await notify(WITH_EMAIL);

		expect(createNotification).not.toHaveBeenCalled();
		expect(sendEmail).toHaveBeenCalled();
		expect(result).toEqual({ inAppSent: false, emailSent: true });
	});

	it('marks the row emailed so the digest cron cannot send a second copy', async () => {
		// sendDigestEmails claims every Notification with emailSentAt: null and
		// already carries a CREDENTIAL_EXPIRY label, so without this the
		// recipient gets the same news twice.
		await notify(WITH_EMAIL);

		expect(markNotificationEmailSent).toHaveBeenCalledWith(
			'notif-1',
			expect.any(Date),
		);
	});

	it('leaves a failed send for the digest to retry', async () => {
		vi.mocked(sendEmail).mockResolvedValueOnce(false);

		await notify(WITH_EMAIL);

		expect(markNotificationEmailSent).not.toHaveBeenCalled();
	});

	it('still reports the email as sent when the stamp write fails', async () => {
		// By the time the stamp runs, a row exists and Resend has accepted the
		// mail. Letting the stamp's failure propagate would report
		// `{ inAppSent: false, emailSent: null }` and deny a delivery that
		// happened — which makes a caller gating on it re-send tomorrow.
		vi.mocked(markNotificationEmailSent).mockRejectedValueOnce(
			new Error('DB blip'),
		);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await notify(WITH_EMAIL);

		expect(result).toEqual({ inAppSent: true, emailSent: true });
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('does not mark anything emailed when no in-app row was created', async () => {
		vi.mocked(getPreference).mockResolvedValueOnce({
			inApp: false,
			email: true,
		});

		await notify(WITH_EMAIL);

		expect(markNotificationEmailSent).not.toHaveBeenCalled();
	});

	it('leaves the four pre-existing callers to the digest, unstamped', async () => {
		// REGRESSION. Every caller that predates the credential-expiry notifier —
		// shiftService, volunteerApplicationService, volunteer-screening and
		// shiftSignupService — passes title/body/href and NO email content, and
		// relies on `sendDigestEmails` claiming the row (`emailSentAt: null`) to
		// deliver it. `notify()` gained a write to that exact column in this
		// change, so stamping it on the no-email branch would silently mute the
		// digest for all four notification types at once, with no error anywhere.
		// Those callers `void` the promise, so nothing they own could ever notice.
		const result = await notify(BASE);

		expect(createNotification).toHaveBeenCalled();
		expect(sendEmail).not.toHaveBeenCalled();
		expect(markNotificationEmailSent).not.toHaveBeenCalled();
		expect(result.emailSent).toBeNull();
	});

	it('sends nothing at all when the recipient opted out of both channels', async () => {
		// `{ inAppSent: false, emailSent: null }` is the value the expiry notifier
		// reads as "not reached", which is what keeps the batch unstamped and
		// retried rather than lost to an opt-out.
		vi.mocked(getPreference).mockResolvedValueOnce({
			inApp: false,
			email: false,
		});

		const result = await notify(WITH_EMAIL);

		expect(createNotification).not.toHaveBeenCalled();
		expect(sendEmail).not.toHaveBeenCalled();
		expect(markNotificationEmailSent).not.toHaveBeenCalled();
		expect(result).toEqual({ inAppSent: false, emailSent: null });
	});

	it('does not attempt an email when the subject and body are only half supplied', async () => {
		// `emailTo` without `emailHtml` must not send — the guard is an AND over
		// both, and a partial payload would otherwise mail an empty body.
		const result = await notify({ ...BASE, emailTo: 'owner@example.com' });

		expect(sendEmail).not.toHaveBeenCalled();
		expect(result.emailSent).toBeNull();
	});

	it('falls back to the notification title when no email subject is given', async () => {
		const { emailSubject: _omitted, ...noSubject } = WITH_EMAIL;

		await notify(noSubject);

		expect(sendEmail).toHaveBeenCalledWith(
			'owner@example.com',
			BASE.title,
			'<p>hello</p>',
		);
	});
});

describe('tryNotify', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('reports nothing delivered instead of throwing', async () => {
		vi.mocked(createNotification).mockRejectedValueOnce(new Error('DB down'));
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await tryNotify(WITH_EMAIL);

		expect(result).toEqual({ inAppSent: false, emailSent: null });
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('passes a successful result through unchanged', async () => {
		await expect(tryNotify(WITH_EMAIL)).resolves.toEqual({
			inAppSent: true,
			emailSent: true,
		});
	});
});
