import { sendEmail } from '../lib/email';
import { prisma } from '../repositories/prisma';

/**
 * Send email digests for users who have opted in (DAILY or WEEKLY).
 *
 * The digest aggregates undelivered Notification records (emailSentAt IS NULL)
 * per user-org pair, batches them into one email, then marks them as delivered.
 * Uses UserDigestPreference.lastDigestSentAt for idempotency.
 *
 * Follows the credential-expiry-service cron pattern: per-record try/catch,
 * returns a summary object for CronJobRun recording.
 */
export async function sendDigestEmails(): Promise<{
	digestsSent: number;
	usersProcessed: number;
}> {
	const now = new Date();
	const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
		},
		include: {
			user: { select: { email: true, name: true } },
			organization: { select: { name: true } },
		},
		take: 100, // Pagination: 100 users per cron run
	});

	let digestsSent = 0;
	let usersProcessed = 0;

	for (const pref of preferences) {
		usersProcessed++;

		try {
			const email = pref.user.email;
			if (!email) continue;

			// Fetch undelivered notifications for this user+org
			const notifications = await prisma.notification.findMany({
				where: {
					userId: pref.userId,
					orgId: pref.orgId,
					emailSentAt: null,
					deletedAt: null,
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
			const sent = await sendEmail(email, subject, html);

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

	return { digestsSent, usersProcessed };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
};

function formatTypeLabel(type: string): string {
	return TYPE_LABELS[type] ?? type;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
