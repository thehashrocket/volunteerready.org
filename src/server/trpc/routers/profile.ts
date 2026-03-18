import { z } from 'zod';
import { prisma } from '@/server/repositories/prisma';
import {
	getOrgVisibleProfile,
	getPublicProfile,
} from '@/server/services/volunteerIdentityService';
import {
	getVolunteerProfileWithCompleteness,
	saveVolunteerProfile,
} from '@/server/services/volunteerProfileService';
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
	requireUserId,
	staffProcedure,
} from '@/server/trpc/init';

const availabilityEnum = z.enum([
	'WEEKDAYS',
	'WEEKENDS',
	'EVENINGS',
	'FLEXIBLE',
]);
const visibilityEnum = z.enum(['PUBLIC', 'ORGS_ONLY', 'PRIVATE']);

export const profileRouter = createTRPCRouter({
	/** Get the authenticated user's own userId (for share card URL construction). */
	getMyUserId: protectedProcedure.query(({ ctx }) => ({
		userId: requireUserId(ctx.session),
	})),

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

	/**
	 * Get a volunteer's public profile by userId (internet-facing).
	 * Returns null for not-found AND for non-PUBLIC profiles (same response — no leakage).
	 * Callers must treat null as 404.
	 */
	getPublicProfile: publicProcedure
		.input(z.object({ userId: z.string().min(1) }))
		.query(({ input }) => getPublicProfile(input.userId)),

	/**
	 * Get a volunteer's org-visible profile for authenticated screeners.
	 * Returns data for PUBLIC and ORGS_ONLY profiles; null for PRIVATE + not-found.
	 * Use this on internal screener pages, not the public internet.
	 */
	getOrgVisibleProfile: staffProcedure
		.input(z.object({ userId: z.string().min(1) }))
		.query(({ input }) => getOrgVisibleProfile(input.userId)),

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
