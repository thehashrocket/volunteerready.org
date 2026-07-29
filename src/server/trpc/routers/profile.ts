import { z } from 'zod';
import { orgVolunteerIdSchema } from '@/server/domain/org-volunteer';
import { prisma } from '@/server/repositories/prisma';
import {
	leaveOrgRoster,
	listMyOrgMemberships,
} from '@/server/services/staffVolunteerService';
import {
	getOrgVisibleProfile,
	getPublicProfile,
} from '@/server/services/volunteerIdentityService';
import {
	getVolunteerProfileWithCompleteness,
	saveVolunteerProfile,
} from '@/server/services/volunteerProfileService';
import { impersonatedBy } from '@/server/trpc/audit-actor';
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
	 * Returns data for PUBLIC and ORGS_ONLY profiles; null for PRIVATE, for
	 * not-found, and for volunteers with no relationship to the caller's org.
	 * Use this on internal screener pages, not the public internet.
	 */
	getOrgVisibleProfile: staffProcedure
		.input(z.object({ userId: z.string().min(1) }))
		.query(({ ctx, input }) => getOrgVisibleProfile(input.userId, ctx.orgId)),

	/**
	 * Orgs that currently have the caller on their volunteer roster (T32).
	 *
	 * Lives on `profileRouter`, not `volunteersRouter`, on purpose. That router is
	 * `rosterProcedure` throughout — the pilot feature flag — and roster edges are
	 * created for every org regardless of the flag (`ensureAppliedRosterRow`), so
	 * a volunteer must be able to see and leave one whether or not staff at that
	 * org can open the roster page. Housing these two beside the flagged
	 * procedures would invite someone to make them "consistent" and silently take
	 * the exit away.
	 */
	listMyOrgMemberships: protectedProcedure.query(({ ctx }) =>
		listMyOrgMemberships(requireUserId(ctx.session)),
	),

	/** Leave one org — revokes its access to you. See `leaveOrgRoster`. */
	leaveOrgRoster: protectedProcedure
		// `orgId`, NOT the `OrgVolunteer.id` this took through v0.36.0.0. An org
		// holding only an application or a shift signup has no roster row to name,
		// and those orgs must be leavable too — otherwise an org denies the remedy
		// by removing the volunteer first, and keeps everything the surviving edges
		// authorize. Org ids are not secret (they key every tenant-scoped route in
		// the app) and need no guard here: the service requires a real relationship
		// before writing anything, and every statement is scoped by the caller's
		// own userId, so a crafted orgId can only ever reach the caller's own rows.
		.input(z.object({ orgId: orgVolunteerIdSchema }))
		.mutation(({ ctx, input }) =>
			leaveOrgRoster({
				// requireUserId, never session.user.email: under impersonation only
				// `id` is swapped, so the two identities diverge.
				userId: requireUserId(ctx.session),
				orgId: input.orgId,
				impersonatedBy: impersonatedBy(ctx),
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
