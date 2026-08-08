/**
 * Notification Service — send in-app + email notifications with preference checks.
 *
 * Architecture:
 *
 *   Trigger (any service)
 *     └─→ tryNotify(input) — never throws; returns NotifyResult
 *           └─→ notify(input) — checks preferences, creates notification + sends email
 *                 ├─→ getPreference(userId, orgId, type)
 *                 │     defaults: inApp=true, email=true
 *                 ├─→ if inApp: createNotification(...)
 *                 └─→ if email: sendEmail(...)
 *                       └─→ if sent: markNotificationEmailSent(...)
 *                             so sendDigestEmails cannot mail the same row again
 */

import type { NotificationType } from '@/prisma/generated/client';
import { sendEmail } from '@/server/lib/email';
import {
	createNotification,
	getPreference,
	getUnreadCount,
	listNotifications,
	markAllRead,
	markNotificationEmailSent,
	markRead,
} from '@/server/repositories/notificationRepo';

export type NotifyInput = {
	userId: string;
	orgId: string;
	type: NotificationType;
	title: string;
	body: string;
	href?: string;
	emailTo?: string;
	emailSubject?: string;
	emailHtml?: string;
};

/**
 * What actually reached the recipient.
 *
 * `emailSent` is deliberately three-valued. `false` means we tried and
 * `sendEmail` told us it did not go — a Resend rejection, a 429, a
 * bounce-suppressed address. `null` means we never tried, because the
 * preference disallowed it or the caller supplied no email content. A caller
 * deciding whether to retry needs those apart: "it failed" and "it was never
 * owed" are different answers, and collapsing them into a boolean is how a
 * retry loop either spins forever or gives up on the wrong thing.
 */
export type NotifyResult = {
	inAppSent: boolean;
	emailSent: boolean | null;
};

/**
 * Send a notification respecting user preferences.
 * Defaults: both inApp and email enabled if no preference row exists.
 *
 * Returns what was delivered rather than `void`, because `sendEmail` reports
 * failure by RETURNING FALSE and never throwing — so a caller that gates an
 * idempotency stamp on "did this notice arrive" cannot learn the answer from
 * an exception. This branch had no callers passing `emailTo` until the
 * credential-expiry notifier, so the boolean was previously discarded with
 * nothing to notice.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
	const pref = await getPreference(input.userId, input.orgId, input.type);
	const inApp = pref?.inApp ?? true;
	const email = pref?.email ?? true;

	let notificationId: string | null = null;
	if (inApp) {
		const row = await createNotification({
			userId: input.userId,
			orgId: input.orgId,
			type: input.type,
			title: input.title,
			body: input.body,
			href: input.href,
		});
		notificationId = row.id;
	}

	let emailSent: boolean | null = null;
	if (email && input.emailTo && input.emailHtml) {
		emailSent = await sendEmail(
			input.emailTo,
			input.emailSubject ?? input.title,
			input.emailHtml,
		);

		// The row we just created and the email we just sent describe the same
		// event, so the row must not also be claimed by the digest cron — it
		// sweeps every notification with `emailSentAt: null` and would send a
		// second email about it. Stamped only when the send actually happened:
		// a failed send leaves the row unstamped, so it is not double-mailed if
		// the recipient happens to have a digest. That is NOT a fallback delivery
		// path — see markNotificationEmailSent — and callers must not treat a
		// failed send as delivered on the strength of it.
		//
		// Its OWN try/catch, and that is load-bearing rather than defensive.
		// By this line two irreversible things have happened — a row exists and
		// Resend has accepted the mail — so letting this throw would unwind into
		// `tryNotify`, which reports `{ inAppSent: false, emailSent: null }` and
		// thereby DENIES a delivery that demonstrably occurred. A caller gating
		// an idempotency stamp on that answer then re-sends tomorrow. Losing the
		// stamp costs at most one redundant digest line; losing the delivery
		// record costs a duplicate email and a broken "once, ever" guarantee, so
		// the failure is absorbed here.
		if (emailSent && notificationId) {
			try {
				await markNotificationEmailSent(notificationId, new Date());
			} catch (err) {
				console.error(
					'[notificationService] Sent the email but could not mark the notification as emailed — the digest may repeat it:',
					{ notificationId, err },
				);
			}
		}
	}

	return { inAppSent: notificationId !== null, emailSent };
}

/**
 * Notification that never throws — errors are caught and logged.
 *
 * Existing callers use `void tryNotify(...)` and ignore the result; callers
 * that need to know what arrived can await it.
 */
export async function tryNotify(input: NotifyInput): Promise<NotifyResult> {
	try {
		return await notify(input);
	} catch (err) {
		console.error('[notificationService] tryNotify failed:', {
			type: input.type,
			userId: input.userId,
			err,
		});
		return { inAppSent: false, emailSent: null };
	}
}

// ---------------------------------------------------------------------------
// Read-side operations (delegated to repo)
// ---------------------------------------------------------------------------

export { getUnreadCount, listNotifications, markAllRead, markRead };
