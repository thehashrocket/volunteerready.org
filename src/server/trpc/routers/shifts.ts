import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
	generateCheckinTokenFromEnv,
	validateCheckinTokenFromEnv,
} from '@/server/lib/checkin-token';
import { getShiftById } from '@/server/repositories/shiftRepo';
import { requireOrgShift } from '@/server/services/shiftAccessService';
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
import { rateLimitByOrg } from '@/server/trpc/rate-limit-middleware';

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
			const shift = await getShiftById(input.shiftId);
			if (!shift) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Shift not found.',
				});
			}

			// Must be OPEN or FULL and within 24h
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

			// Must be confirmed signup
			const status = await getMyCheckinStatus(input.shiftId, userId);
			if (!status || status.status !== 'CONFIRMED') {
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

			const shift = await getShiftById(input.shiftId);
			if (!shift) {
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
