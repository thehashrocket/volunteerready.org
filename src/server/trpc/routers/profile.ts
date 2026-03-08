import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@/server/repositories/prisma';
import {
	getVolunteerProfileWithCompleteness,
	saveVolunteerProfile,
} from '@/server/services/volunteerProfileService';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init';

function requireUserId(session: { user?: { id?: string } } | null): string {
	const id = session?.user?.id;
	if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });
	return id;
}

const availabilityEnum = z.enum([
	'WEEKDAYS',
	'WEEKENDS',
	'EVENINGS',
	'FLEXIBLE',
]);
const visibilityEnum = z.enum(['PUBLIC', 'ORGS_ONLY', 'PRIVATE']);

export const profileRouter = createTRPCRouter({
	/** Get the authenticated user's profile + completeness. */
	getMyProfile: protectedProcedure.query(({ ctx }) =>
		getVolunteerProfileWithCompleteness(requireUserId(ctx.session)),
	),

	/** Create or update the authenticated user's profile. */
	updateMyProfile: protectedProcedure
		.input(
			z.object({
				bio: z.string().max(500).nullable().optional(),
				phone: z.string().max(30).nullable().optional(),
				city: z.string().max(100).nullable().optional(),
				state: z.string().max(100).nullable().optional(),
				country: z.string().max(100).nullable().optional(),
				availability: availabilityEnum.optional(),
				visibility: visibilityEnum.optional(),
				interests: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			saveVolunteerProfile({
				userId: requireUserId(ctx.session),
				...input,
			}),
		),

	/** Quick stats: application counts, org count, skill count. */
	getMyStats: protectedProcedure.query(async ({ ctx }) => {
		const userId = requireUserId(ctx.session);

		const [
			applicationCount,
			orgCount,
			skillCount,
			credentialCount,
			upcomingShiftCount,
		] = await Promise.all([
			prisma.volunteerApplication.count({
				where: { submittedByUserId: userId },
			}),
			prisma.organizationMember.count({ where: { userId } }),
			prisma.volunteerSkill.count({ where: { userId } }),
			prisma.volunteerCredential.count({
				where: { userId, status: 'VERIFIED' },
			}),
			prisma.shiftSignup.count({
				where: {
					userId,
					status: 'CONFIRMED',
					shift: {
						startTime: { gte: new Date() },
						status: { in: ['OPEN', 'FULL'] },
					},
				},
			}),
		]);

		return {
			applicationCount,
			orgCount,
			skillCount,
			credentialCount,
			upcomingShiftCount,
		};
	}),
});
