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
