import { z } from 'zod';
import { updatePreferenceSchema } from '@/server/domain/notification';
import {
	getPreferences,
	upsertPreference,
} from '@/server/repositories/notificationRepo';
import {
	getUnreadCount,
	listNotifications,
	markAllRead,
	markRead,
} from '@/server/services/notificationService';
import {
	createTRPCRouter,
	orgProcedure,
	protectedProcedure,
} from '@/server/trpc/init';

export const notificationsRouter = createTRPCRouter({
	list: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(50).optional(),
				cursor: z.string().cuid().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id ?? '';
			const limit = input.limit ?? 20;
			const items = await listNotifications(userId, {
				limit,
				cursor: input.cursor,
			});

			const hasMore = items.length > limit;
			const results = hasMore ? items.slice(0, limit) : items;

			return {
				items: results,
				nextCursor: hasMore ? results[results.length - 1]?.id : undefined,
			};
		}),

	unreadCount: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session?.user?.id ?? '';
		return getUnreadCount(userId);
	}),

	markRead: protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id ?? '';
			await markRead(userId, input.id);
			return { success: true };
		}),

	markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
		const userId = ctx.session?.user?.id ?? '';
		await markAllRead(userId);
		return { success: true };
	}),

	// Preferences — scoped to the user's active org
	getPreferences: orgProcedure.query(async ({ ctx }) => {
		const userId = ctx.session?.user?.id ?? '';
		return getPreferences(userId, ctx.orgId);
	}),

	updatePreference: orgProcedure
		.input(updatePreferenceSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session?.user?.id ?? '';
			await upsertPreference(
				userId,
				ctx.orgId,
				input.type,
				input.inApp,
				input.email,
			);
			return { success: true };
		}),
});
