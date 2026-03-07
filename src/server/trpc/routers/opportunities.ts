import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { OpportunityStatus, Prisma, RequirementLevel } from '@/prisma/generated/client';

function isPrismaNotFound(err: unknown): boolean {
	return (
		err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025'
	);
}

import {
	createOpportunity,
	deleteOpportunity,
	getOpportunity,
	listOpportunities,
	updateOpportunity,
	updateOpportunityStatus,
} from '@/server/repositories/opportunityRepo';
import { createTRPCRouter, staffProcedure } from '@/server/trpc/init';

const opportunityInput = z.object({
	title: z.string().min(1).max(200),
	description: z.string().min(1).max(5000),
	location: z.string().max(200).nullish(),
	isRemote: z.boolean().default(false),
	startDate: z.string().datetime().nullish(),
	endDate: z.string().datetime().nullish(),
	commitmentHours: z.number().positive().nullish(),
	capacity: z.number().int().positive().nullish(),
	tags: z.array(z.string().min(1).max(50)).max(10).default([]),
	requirements: z
		.array(
			z.object({
				skill: z.string().min(1).max(100),
				level: z.nativeEnum(RequirementLevel),
			}),
		)
		.max(20)
		.default([]),
});

export const opportunitiesRouter = createTRPCRouter({
	list: staffProcedure.query(({ ctx }) => listOpportunities(ctx.orgId!)),

	get: staffProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const opp = await getOpportunity(input.id, ctx.orgId!);
			if (!opp) throw new TRPCError({ code: 'NOT_FOUND' });
			return opp;
		}),

	create: staffProcedure.input(opportunityInput).mutation(({ ctx, input }) =>
		createOpportunity({
			orgId: ctx.orgId!,
			...input,
			startDate: input.startDate ? new Date(input.startDate) : null,
			endDate: input.endDate ? new Date(input.endDate) : null,
			tags: input.tags,
			requirements: input.requirements,
		}),
	),

	update: staffProcedure
		.input(
			z.object({ id: z.string().min(1) }).merge(opportunityInput.partial()),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			const existing = await getOpportunity(id, ctx.orgId!);
			if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
			return updateOpportunity(id, ctx.orgId!, {
				...data,
				requirements: data.requirements,
				startDate:
					data.startDate !== undefined
						? data.startDate
							? new Date(data.startDate)
							: null
						: undefined,
				endDate:
					data.endDate !== undefined
						? data.endDate
							? new Date(data.endDate)
							: null
						: undefined,
			});
		}),

	updateStatus: staffProcedure
		.input(
			z.object({
				id: z.string().min(1),
				status: z.nativeEnum(OpportunityStatus),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				return await updateOpportunityStatus(
					input.id,
					ctx.orgId!,
					input.status,
				);
			} catch (err: unknown) {
				if (isPrismaNotFound(err)) throw new TRPCError({ code: 'NOT_FOUND' });
				throw err;
			}
		}),

	remove: staffProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			try {
				return await deleteOpportunity(input.id, ctx.orgId!);
			} catch (err: unknown) {
				if (isPrismaNotFound(err)) throw new TRPCError({ code: 'NOT_FOUND' });
				throw err;
			}
		}),
});
