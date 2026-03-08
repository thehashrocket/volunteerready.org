import { TRPCError } from '@trpc/server';
import { z } from 'zod';
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
	getMyUpcomingShifts,
	getShiftSignups,
	markAttendance,
	signUpForShift,
} from '@/server/services/shiftSignupService';
import {
	createTRPCRouter,
	protectedProcedure,
	staffProcedure,
} from '@/server/trpc/init';

function requireUserId(session: { user?: { id?: string } } | null): string {
	const id = session?.user?.id;
	if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });
	return id;
}

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
		.query(async ({ input }) => {
			const shift = await getShiftDetail(input.id);
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
		.mutation(({ ctx, input }) =>
			completeShift(input.id, ctx.orgId, requireUserId(ctx.session)),
		),

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
		.query(({ input }) => getShiftSignups(input.shiftId)),

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

	/** Cancel my signup. */
	cancelSignup: protectedProcedure
		.input(z.object({ shiftId: z.string() }))
		.mutation(({ ctx, input }) =>
			cancelSignup(input.shiftId, requireUserId(ctx.session)),
		),
});
