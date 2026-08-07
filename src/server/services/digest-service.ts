import type { NotificationType } from '@/prisma/generated/client';
import { sendEmail } from '../lib/email';
import { escapeHtml } from '../lib/html';
import { getTimezonesMatchingHour } from '../lib/timezone';
import { prisma } from '../repositories/prisma';

/**
 * Send email digests for users who have opted in (DAILY or WEEKLY).
 *
 * The digest aggregates undelivered Notification records (emailSentAt IS NULL)
 * per user-org pair, batches them into one email, then marks them as delivered.
 *
 * `emailSentAt` has TWO writers: this cron, and `notificationService.notify()`
 * after it sends its own immediate email. So `emailSentAt: null` means "no
 * email by any path", not "this cron has not run yet". Narrowing or re-widening
 * the predicate below must be checked against notify(), or a notification that
 * was already mailed directly gets mailed again from here.
 * Uses UserDigestPreference.lastDigestSentAt for idempotency.
 *
 * Cursor-based pagination: resumes from last successful CronJobRun's nextCursor.
 * Processes 100 preferences per invocation. When batch < 100, resets cursor.
 *
 * Respects per-type NotificationPreference.email opt-outs: notifications where
 * the user set email=false for that (userId, orgId, type) are excluded.
 *
 * Follows the credential-expiry-service cron pattern: per-record try/catch,
 * returns a summary object for CronJobRun recording.
 */
export async function sendDigestEmails(): Promise<{
	digestsSent: number;
	usersProcessed: number;
	nextCursor: string | null;
}> {
	const now = new Date();
	const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	// Resume from last successful run's cursor
	const resumeCursor = await getLastCursor('email-digests');

	// Timezone-aware: only process orgs whose local hour is 8am
	const tzFilter = await getTimezoneFilter(8);

	// Find preferences where a digest is due
	const preferences = await prisma.userDigestPreference.findMany({
		where: {
			digestFrequency: { not: 'OFF' },
			OR: [
				// DAILY: last sent > 24h ago or never
				{
					digestFrequency: 'DAILY',
					OR: [
						{ lastDigestSentAt: null },
						{ lastDigestSentAt: { lt: oneDayAgo } },
					],
				},
				// WEEKLY: last sent > 7d ago or never
				{
					digestFrequency: 'WEEKLY',
					OR: [
						{ lastDigestSentAt: null },
						{ lastDigestSentAt: { lt: oneWeekAgo } },
					],
				},
			],
			// Only process orgs in the current timezone window
			organization: tzFilter,
		},
		include: {
			user: { select: { email: true, name: true } },
			organization: { select: { name: true } },
		},
		orderBy: { id: 'asc' },
		...(resumeCursor ? { cursor: { id: resumeCursor }, skip: 1 } : {}),
		take: 100,
	});

	let digestsSent = 0;
	let usersProcessed = 0;

	for (const pref of preferences) {
		usersProcessed++;

		try {
			const email = pref.user.email;
			if (!email) continue;

			// Get notification types the user has opted out of email for
			const optedOutTypes = await getOptedOutTypes(pref.userId, pref.orgId);

			// Fetch undelivered notifications for this user+org
			const notifications = await prisma.notification.findMany({
				where: {
					userId: pref.userId,
					orgId: pref.orgId,
					emailSentAt: null,
					deletedAt: null,
					// Exclude types the user opted out of
					...(optedOutTypes.length > 0
						? { type: { notIn: optedOutTypes } }
						: {}),
				},
				orderBy: { createdAt: 'desc' },
				take: 50, // Cap per digest
				select: {
					id: true,
					type: true,
					title: true,
					body: true,
					createdAt: true,
				},
			});

			// Skip if nothing to send
			if (notifications.length === 0) {
				// Still update lastDigestSentAt to avoid re-checking
				await prisma.userDigestPreference.update({
					where: { id: pref.id },
					data: { lastDigestSentAt: now },
				});
				continue;
			}

			// Group by type for the email
			const grouped = new Map<string, typeof notifications>();
			for (const n of notifications) {
				const existing = grouped.get(n.type) ?? [];
				existing.push(n);
				grouped.set(n.type, existing);
			}

			// Build email HTML
			const frequencyLabel =
				pref.digestFrequency === 'DAILY' ? 'today' : 'this week';
			let itemsHtml = '';
			for (const [type, items] of grouped) {
				const typeLabel = formatTypeLabel(type);
				itemsHtml += `<h3 style="margin: 16px 0 8px; font-size: 14px; color: #666;">${typeLabel} (${items.length})</h3>`;
				itemsHtml += '<ul style="margin: 0; padding-left: 20px;">';
				for (const item of items) {
					itemsHtml += `<li style="margin-bottom: 4px; font-size: 14px;">${escapeHtml(item.title)}</li>`;
				}
				itemsHtml += '</ul>';
			}

			const html = `
				<h2>${notifications.length} update${notifications.length === 1 ? '' : 's'} ${frequencyLabel}</h2>
				<p>Here's what happened at <strong>${escapeHtml(pref.organization.name)}</strong>:</p>
				${itemsHtml}
				<p style="margin-top: 24px;">
					<a href="${process.env.NEXTAUTH_URL}/app"
					   style="background-color: #1B3C2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
						View dashboard
					</a>
				</p>
			`;

			const subject = `${notifications.length} update${notifications.length === 1 ? '' : 's'} from ${pref.organization.name}`;
			// Unrequested bulk mail — opts into the unclaimed guard so a
			// staff-created volunteer who has never signed in is not digested at.
			const sent = await sendEmail(email, subject, html, {
				suppressUnclaimed: true,
			});

			if (sent) {
				// Mark notifications as email-delivered
				await prisma.notification.updateMany({
					where: {
						id: { in: notifications.map((n) => n.id) },
					},
					data: { emailSentAt: now },
				});

				await prisma.userDigestPreference.update({
					where: { id: pref.id },
					data: { lastDigestSentAt: now },
				});

				digestsSent++;
			}
		} catch (e) {
			if ((e as { code?: string }).code === 'P2025') {
				console.warn(
					`[digest] Preference ${pref.id} already modified — skipping`,
				);
			} else {
				console.error(
					`[digest] Failed to send digest for user ${pref.userId}`,
					e,
				);
			}
		}
	}

	// Compute next cursor: null if we've reached the end
	const nextCursor =
		preferences.length < 100 ? null : preferences[preferences.length - 1].id;

	return { digestsSent, usersProcessed, nextCursor };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the nextCursor from the last successful CronJobRun for the given job.
 */
async function getLastCursor(jobName: string): Promise<string | null> {
	const lastRun = await prisma.cronJobRun.findFirst({
		where: { jobName, status: 'SUCCESS' },
		orderBy: { startedAt: 'desc' },
		select: { resultSummary: true },
	});
	const summary = lastRun?.resultSummary as
		| { nextCursor?: string | null }
		| null
		| undefined;
	return summary?.nextCursor ?? null;
}

/**
 * Get notification types where the user has opted out of email delivery.
 */
async function getOptedOutTypes(
	userId: string,
	orgId: string,
): Promise<NotificationType[]> {
	const prefs = await prisma.notificationPreference.findMany({
		where: { userId, orgId, email: false },
		select: { type: true },
	});
	return prefs.map((p) => p.type);
}

/**
 * Build a Prisma WHERE clause for Organization.timezone that matches
 * orgs whose local time is currently the target hour.
 */
async function getTimezoneFilter(targetHour: number) {
	const allTimezones = await prisma.organization.findMany({
		select: { timezone: true },
		distinct: ['timezone'],
	});
	const tzValues = allTimezones.map((o) => o.timezone);
	const matching = getTimezonesMatchingHour(tzValues, targetHour);

	const hasNull = matching.includes(null);
	const nonNullTzs = matching.filter((tz): tz is string => tz !== null);

	const conditions: Record<string, unknown>[] = [];
	if (nonNullTzs.length > 0) {
		conditions.push({ timezone: { in: nonNullTzs } });
	}
	if (hasNull) {
		conditions.push({ timezone: null });
	}

	// If no timezones match (unlikely but possible), return impossible filter
	if (conditions.length === 0) {
		return { timezone: '__no_match__' };
	}

	return conditions.length === 1 ? conditions[0] : { OR: conditions };
}

const TYPE_LABELS: Record<string, string> = {
	SHIFT_REMINDER: 'Shift Reminders',
	SHIFT_CANCELLED: 'Shift Cancellations',
	SHIFT_UPDATED: 'Shift Updates',
	APPLICATION_STATUS: 'Application Status',
	CREDENTIAL_EXPIRY: 'Credential Expiry',
	TEAM_ANNOUNCEMENT: 'Announcements',
	WAITLIST_PROMOTED: 'Waitlist',
	NEW_OPPORTUNITY: 'New Opportunities',
	BADGE_EARNED: 'Badges',
	FIRST_APPLICATION: 'First Application',
	REENGAGEMENT: 'Re-engagement',
};

function formatTypeLabel(type: string): string {
	return TYPE_LABELS[type] ?? type;
}
