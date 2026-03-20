import { z } from 'zod';
import type { NotificationType } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Zod schemas — shared between client/server
// ---------------------------------------------------------------------------

export const notificationTypeSchema = z.enum([
	'SHIFT_REMINDER',
	'SHIFT_CANCELLED',
	'SHIFT_UPDATED',
	'SHIFT_COMPLETED',
	'APPLICATION_STATUS',
	'CREDENTIAL_EXPIRY',
	'TEAM_ANNOUNCEMENT',
	'WAITLIST_PROMOTED',
	'NEW_OPPORTUNITY',
	'BADGE_EARNED',
	'FIRST_APPLICATION',
]);

export const createNotificationSchema = z.object({
	userId: z.string().cuid(),
	orgId: z.string().cuid(),
	type: notificationTypeSchema,
	title: z.string().min(1).max(200),
	body: z.string().min(1).max(1000),
	href: z.string().max(500).optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const updatePreferenceSchema = z.object({
	type: notificationTypeSchema,
	inApp: z.boolean(),
	email: z.boolean(),
});

export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatNotificationAge(createdAt: Date): string {
	const ms = Date.now() - createdAt.getTime();
	if (ms < MINUTE) return 'just now';
	if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`;
	if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
	if (ms < 7 * DAY) return `${Math.floor(ms / DAY)}d ago`;
	return createdAt.toLocaleDateString();
}

/** Human-readable labels for notification types. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
	SHIFT_REMINDER: 'Shift Reminders',
	SHIFT_CANCELLED: 'Shift Cancellations',
	SHIFT_UPDATED: 'Shift Updates',
	APPLICATION_STATUS: 'Application Status',
	CREDENTIAL_EXPIRY: 'Credential Expiry',
	TEAM_ANNOUNCEMENT: 'Announcements',
	SHIFT_COMPLETED: 'Shift Completed',
	WAITLIST_PROMOTED: 'Waitlist Promotions',
	NEW_OPPORTUNITY: 'New Opportunities',
	BADGE_EARNED: 'Badges Earned',
	FIRST_APPLICATION: 'First Application',
};
