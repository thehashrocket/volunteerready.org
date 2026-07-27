import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
	generateCheckinTokenFromEnv,
	validateCheckinTokenFromEnv,
} from '@/server/lib/checkin-token';
import { getShiftById } from '@/server/repositories/shiftRepo';
import {
	requireOrgShift,
	requireOwnSignup,
} from '@/server/services/shiftAccessService';
import {
	cancelShift,
	completeShift,
	createNewShift,
	getShiftDetail,
	listOrgShifts,
	removeShift,
	updateExistingShift,
} from '@/server/services/shiftService';
import {
	cancelSignup,
	getCheckinStats,
	getMyCheckinStatus,
	getMyUpcomingShifts,
	getMyUpcomingShiftsWithWaitlist,
	getShiftSignups,
	getShiftWaitlist,
	joinWaitlist,
	leaveWaitlist,
	markAttendance,
	signUpForShift,
} from '@/server/services/shiftSignupService';
import {
	createTRPCRouter,
	protectedProcedure,
	requireUserId,
	staffProcedure,
} from '@/server/trpc/init';
import {
	rateLimitByOrg,
	rateLimitByUser,
} from '@/server/trpc/rate-limit-middleware';

/**
 * Throttles the two procedures that let ANY authenticated user write a row onto
 * an org's shift roster without belonging to that org (see mapSignupFailure in
 * shiftSignupService.ts for why they stay open). Each successful call publishes
 * the caller's name and email to that org's staff, so enumeration here is
 * self-doxxing spam rather than a read leak — but it is still a write nobody
 * should be able to issue in bulk.
 *
 * Defense in depth only, deliberately: `checkRateLimit` fails OPEN when Upstash
 * is not configured (local dev, CI), so this cannot be the thing that makes the
 * procedures safe. The indistinguishable-error mapping in the service is.
 */
const shiftJoinLimiter = rateLimitByUser({
	limit: 20,
	windowSeconds: 60,
	prefix: 'shifts:join',
});

export const shiftsRouter = createTRPCRouter({
	// ---- Staff: Shift management --------------------------------------------

	/** List shifts for the current org. */
	list: staffProcedure
		.input(
			z
				.object({
					status: z.enum(['OPEN', 'FULL', 'CANCELLED', 'COMPLETED']).optional(),
					cursor: z.string().optional(),
					take: z.number().min(1).max(100).optional(),
				})
				.optional(),
		)
		.query(({ ctx, input }) => listOrgShifts(ctx.orgId, input)),

	/** Get shift detail with signups. */
	getById: staffProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const shift = await getShiftDetail(input.id, ctx.orgId);
			if (!shift)
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found.' });
			return shift;
		}),

	/** Create a new shift. */
	create: staffProcedure
		.input(
			z.object({
				title: z.string().min(1).max(200),
				description: z.string().max(2000).optional(),
				location: z.string().max(500).optional(),
				isRemote: z.boolean().optional(),
				opportunityId: z.string().optional(),
				startTime: z.coerce.date(),
				endTime: z.coerce.date(),
				capacity: z.number().int().min(1).max(10000),
			}),
		)
		.mutation(({ ctx, input }) =>
			createNewShift(
				{ ...input, orgId: ctx.orgId },
				requireUserId(ctx.session),
			),
		),

	/** Update an existing shift. */
	update: staffProcedure
		.input(
			z.object({
				id: z.string(),
				// Nullable so a shift can be unlinked from its opportunity, not just
				// relinked. `updateExistingShift` only org-checks a non-null value —
				// clearing the link needs no guard.
				opportunityId: z.string().nullable().optional(),
				title: z.string().min(1).max(200).optional(),
				description: z.string().max(2000).nullable().optional(),
				location: z.string().max(500).nullable().optional(),
				isRemote: z.boolean().optional(),
				startTime: z.coerce.date().optional(),
				endTime: z.coerce.date().optional(),
				capacity: z.number().int().min(1).max(10000).optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			updateExistingShift(input, ctx.orgId, requireUserId(ctx.session)),
		),

	/** Cancel a shift. */
	cancel: staffProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) =>
			cancelShift(input.id, ctx.orgId, requireUserId(ctx.session)),
		),

	/** Mark a shift as completed. */
	complete: staffProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const result = await completeShift(
				input.id,
				ctx.orgId,
				requireUserId(ctx.session),
			);
			if (!result) {
				throw new TRPCError({
					code: 'CONFLICT',
					message:
						'Shift cannot be completed — it may have been cancelled or already completed.',
				});
			}
			return result;
		}),

	/** Delete a shift entirely. */
	remove: staffProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) =>
			removeShift(input.id, ctx.orgId, requireUserId(ctx.session)),
		),

	// ---- Staff: Attendance management ---------------------------------------

	/** Get signups for a shift. */
	getSignups: staffProcedure
		.input(z.object({ shiftId: z.string() }))
		.query(({ ctx, input }) => getShiftSignups(input.shiftId, ctx.orgId)),

	/** Mark a volunteer's attendance. */
	markAttendance: staffProcedure
		.input(
			z.object({
				shiftId: z.string(),
				userId: z.string(),
				status: z.enum(['ATTENDED', 'NO_SHOW']),
			}),
		)
		.mutation(({ ctx, input }) =>
			markAttendance(
				input.shiftId,
				input.userId,
				input.status,
				requireUserId(ctx.session),
				{ by: 'staff', orgId: ctx.orgId },
			),
		),

	// ---- Volunteer: Shift signup --------------------------------------------

	/** Get my upcoming shift signups (cross-org). */
	myUpcoming: protectedProcedure.query(({ ctx }) =>
		getMyUpcomingShifts(requireUserId(ctx.session)),
	),

	/** Sign up for a shift. */
	signup: protectedProcedure
		.use(shiftJoinLimiter)
		.input(
			z.object({
				shiftId: z.string(),
				notes: z.string().max(500).optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			signUpForShift(input.shiftId, requireUserId(ctx.session), input.notes),
		),

	/** Cancel my signup (confirmed or waitlisted). */
	cancelSignup: protectedProcedure
		.input(z.object({ shiftId: z.string() }))
		.mutation(({ ctx, input }) =>
			cancelSignup(input.shiftId, requireUserId(ctx.session)),
		),

	// ---- Volunteer: Waitlist -------------------------------------------------

	/** Get my upcoming signups including waitlisted entries. */
	myUpcomingWithWaitlist: protectedProcedure.query(({ ctx }) =>
		getMyUpcomingShiftsWithWaitlist(requireUserId(ctx.session)),
	),

	/** Join waitlist for a full shift. */
	joinWaitlist: protectedProcedure
		.use(shiftJoinLimiter)
		.input(z.object({ shiftId: z.string() }))
		.mutation(({ ctx, input }) =>
			joinWaitlist(input.shiftId, requireUserId(ctx.session)),
		),

	/** Leave the waitlist. */
	leaveWaitlist: protectedProcedure
		.input(z.object({ shiftId: z.string() }))
		.mutation(({ ctx, input }) =>
			leaveWaitlist(input.shiftId, requireUserId(ctx.session)),
		),

	// ---- Staff: Waitlist management ------------------------------------------

	/** Get waitlist for a shift. */
	getWaitlist: staffProcedure
		.input(z.object({ shiftId: z.string() }))
		.query(({ ctx, input }) => getShiftWaitlist(input.shiftId, ctx.orgId)),

	// ---- QR Check-in --------------------------------------------------------

	/** Generate a check-in token for the current time window (volunteer). */
	getCheckinToken: protectedProcedure
		.input(z.object({ shiftId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = requireUserId(ctx.session);

			// SECURITY: establish the caller's own relationship to this shift BEFORE
			// disclosing anything about it. This check used to run LAST, after the
			// existence, status and 24-hour branches below had already answered
			// "is this real, what state is it in, and is it imminent" for any
			// authenticated user probing arbitrary ids. See requireOwnSignup.
			const { shift, signup } = await requireOwnSignup(input.shiftId, userId);

			// Past this point the caller has a genuine, previously-disclosed
			// relationship to the shift, so these stay specific and actionable — a
			// volunteer with a real signup still needs to be told why no code showed
			// up. Narrowing them would degrade the legitimate flow to no benefit.
			if (shift.status !== 'OPEN' && shift.status !== 'FULL') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `Shift is ${shift.status.toLowerCase()}.`,
				});
			}
			const hoursUntilStart =
				(shift.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
			if (hoursUntilStart > 24) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'QR code is available 24 hours before the shift.',
				});
			}
			if (signup.status !== 'CONFIRMED') {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'You must have a confirmed signup for this shift.',
				});
			}

			const token = generateCheckinTokenFromEnv(input.shiftId, userId);
			return { token };
		}),

	/** Staff scans a QR code to check in a volunteer. */
	checkinByQr: staffProcedure
		.use(
			rateLimitByOrg({
				limit: 120,
				windowSeconds: 60,
				prefix: 'shifts:checkinByQr',
			}),
		)
		.input(
			z.object({
				shiftId: z.string(),
				userId: z.string(),
				token: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const shift = await requireOrgShift(input.shiftId, ctx.orgId);

			if (shift.status !== 'OPEN' && shift.status !== 'FULL') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `Shift is ${shift.status.toLowerCase()}.`,
				});
			}

			const valid = validateCheckinTokenFromEnv(
				input.shiftId,
				input.userId,
				input.token,
			);
			if (!valid) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Invalid or expired QR code.',
				});
			}

			const result = await markAttendance(
				input.shiftId,
				input.userId,
				'ATTENDED',
				requireUserId(ctx.session),
				{ by: 'staff', orgId: ctx.orgId },
				'qr',
			);

			return {
				success: true,
				alreadyCheckedIn: result.alreadyCheckedIn,
			};
		}),

	/** Volunteer self-check-in (for geo auto-check-in and future flows). */
	selfCheckin: protectedProcedure
		.input(z.object({ shiftId: z.string(), token: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = requireUserId(ctx.session);

			// SECURITY: validate the token BEFORE loading the shift. The token is an
			// HMAC over (shiftId, userId, window) keyed by a server-only secret, so
			// possessing a valid one IS the authorization — nobody can mint one for
			// a shift `getCheckinToken` never issued them. Checking it first means a
			// prober with a forged token learns nothing about whether the id is
			// real or what state it is in; previously the shift's existence and
			// status were disclosed before the token was looked at.
			//
			// This is why selfCheckin takes no requireOwnSignup guard while its
			// sibling getCheckinToken does: that one HANDS OUT the credential and so
			// has nothing to verify yet, this one CONSUMES it.
			const valid = validateCheckinTokenFromEnv(
				input.shiftId,
				userId,
				input.token,
			);
			if (!valid) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Invalid or expired check-in token.',
				});
			}

			const shift = await getShiftById(input.shiftId);
			if (!shift) {
				// Unreachable in practice: a valid token implies the shift existed
				// when it was minted. Defense in depth.
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Shift not found.',
				});
			}

			if (shift.status !== 'OPEN' && shift.status !== 'FULL') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `Shift is ${shift.status.toLowerCase()}.`,
				});
			}

			const result = await markAttendance(
				input.shiftId,
				userId,
				'ATTENDED',
				userId,
				{ by: 'self', userId },
				'geo',
			);

			return {
				success: true,
				alreadyCheckedIn: result.alreadyCheckedIn,
			};
		}),

	/** Get check-in status for a volunteer's shift. */
	myCheckinStatus: protectedProcedure
		.input(z.object({ shiftId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = requireUserId(ctx.session);
			return getMyCheckinStatus(input.shiftId, userId);
		}),

	/** Get check-in stats for a shift (staff). */
	getCheckinStats: staffProcedure
		.input(z.object({ shiftId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireOrgShift(input.shiftId, ctx.orgId);
			return getCheckinStats(input.shiftId);
		}),
});
