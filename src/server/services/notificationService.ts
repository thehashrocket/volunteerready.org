/**
 * Notification Service — send in-app + email notifications with preference checks.
 *
 * Architecture:
 *
 *   Trigger (any service)
 *     └─→ tryNotify(input) — fire-and-forget wrapper (void, outer try/catch)
 *           └─→ notify(input) — checks preferences, creates notification + sends email
 *                 ├─→ getPreference(userId, orgId, type)
 *                 │     defaults: inApp=true, email=true
 *                 ├─→ if inApp: createNotification(...)
 *                 └─→ if email: sendEmail(...)
 */

import type { NotificationType } from '@/prisma/generated/client';
import { sendEmail } from '@/server/lib/email';
import {
	createNotification,
	getPreference,
	getUnreadCount,
	listNotifications,
	markAllRead,
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
 * Send a notification respecting user preferences.
 * Defaults: both inApp and email enabled if no preference row exists.
 */
export async function notify(input: NotifyInput): Promise<void> {
	const pref = await getPreference(input.userId, input.orgId, input.type);
	const inApp = pref?.inApp ?? true;
	const email = pref?.email ?? true;

	if (inApp) {
		await createNotification({
			userId: input.userId,
			orgId: input.orgId,
			type: input.type,
			title: input.title,
			body: input.body,
			href: input.href,
		});
	}

	if (email && input.emailTo && input.emailHtml) {
		await sendEmail(
			input.emailTo,
			input.emailSubject ?? input.title,
			input.emailHtml,
		);
	}
}

/**
 * Fire-and-forget notification — errors are caught and logged.
 * Call with `void tryNotify(...)` — never await from the caller.
 */
export async function tryNotify(input: NotifyInput): Promise<void> {
	try {
		await notify(input);
	} catch (err) {
		console.error('[notificationService] tryNotify failed:', {
			type: input.type,
			userId: input.userId,
			err,
		});
	}
}

// ---------------------------------------------------------------------------
// Read-side operations (delegated to repo)
// ---------------------------------------------------------------------------

export { getUnreadCount, listNotifications, markAllRead, markRead };
