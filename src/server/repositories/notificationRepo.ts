import type { NotificationType } from '@/prisma/generated/client';
import type { CreateNotificationInput } from '@/server/domain/notification';
import { prisma } from './prisma';

const NOT_DELETED = { deletedAt: null } as const;

export async function createNotification(input: CreateNotificationInput) {
	return prisma.notification.create({
		data: {
			userId: input.userId,
			orgId: input.orgId,
			type: input.type,
			title: input.title,
			body: input.body,
			href: input.href ?? null,
		},
	});
}

/**
 * Mark a notification as already emailed.
 *
 * Called by `notify()` after it sends its OWN immediate email, so the digest
 * cron does not send a second one about the same event: `sendDigestEmails`
 * claims every row with `emailSentAt: null`, and it already carries a
 * `CREDENTIAL_EXPIRY` label, so the collision is real rather than theoretical.
 *
 * NOT a fallback delivery path in the other direction. An earlier version of
 * this docstring said a FAILED send "leaves the row for the digest to pick up",
 * and that is wrong for org staff: `sendDigestEmails` iterates
 * `UserDigestPreference` rows, which only exist once someone has visited
 * notification settings, and it renders `title` only — so the itemised list is
 * dropped even when a row does exist. Do not lean on it as a reason to treat a
 * failed send as delivered.
 */
export async function markNotificationEmailSent(
	notificationId: string,
	emailSentAt: Date,
) {
	return prisma.notification.update({
		where: { id: notificationId },
		data: { emailSentAt },
	});
}

export async function listNotifications(
	userId: string,
	opts: { limit?: number; cursor?: string } = {},
) {
	const { limit = 20, cursor } = opts;
	return prisma.notification.findMany({
		where: { userId, ...NOT_DELETED },
		orderBy: { createdAt: 'desc' },
		take: limit + 1,
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		select: {
			id: true,
			type: true,
			title: true,
			body: true,
			href: true,
			readAt: true,
			createdAt: true,
		},
	});
}

export async function getUnreadCount(userId: string): Promise<number> {
	return prisma.notification.count({
		where: { userId, readAt: null, ...NOT_DELETED },
	});
}

export async function markRead(userId: string, notificationId: string) {
	return prisma.notification.updateMany({
		where: { id: notificationId, userId, ...NOT_DELETED },
		data: { readAt: new Date() },
	});
}

export async function markAllRead(userId: string) {
	return prisma.notification.updateMany({
		where: { userId, readAt: null, ...NOT_DELETED },
		data: { readAt: new Date() },
	});
}

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------

export async function getPreferences(userId: string, orgId: string) {
	return prisma.notificationPreference.findMany({
		where: { userId, orgId },
		select: { type: true, inApp: true, email: true },
	});
}

export async function upsertPreference(
	userId: string,
	orgId: string,
	type: NotificationType,
	inApp: boolean,
	email: boolean,
) {
	return prisma.notificationPreference.upsert({
		where: { userId_orgId_type: { userId, orgId, type } },
		create: { userId, orgId, type, inApp, email },
		update: { inApp, email },
	});
}

export async function getPreference(
	userId: string,
	orgId: string,
	type: NotificationType,
) {
	return prisma.notificationPreference.findUnique({
		where: { userId_orgId_type: { userId, orgId, type } },
		select: { inApp: true, email: true },
	});
}
