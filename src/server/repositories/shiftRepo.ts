import type { PrismaClient, ShiftStatus } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getShiftById(id: string) {
	return prisma.shift.findUnique({ where: { id } });
}

export async function getShiftWithSignups(id: string) {
	return prisma.shift.findUnique({
		where: { id },
		include: {
			signups: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							image: true,
							// Drives VolunteerStatusBadge in the signups table, and the
							// "N volunteers won't get an automatic reminder" summary above
							// it. See signupUserSelect in shiftSignupRepo.ts.
							accountState: true,
						},
					},
				},
			},
			opportunity: { select: { id: true, title: true } },
		},
	});
}

export async function listShiftsByOrg(
	orgId: string,
	opts?: { status?: ShiftStatus; cursor?: string; take?: number },
) {
	const take = opts?.take ?? 50;
	return prisma.shift.findMany({
		where: {
			orgId,
			...(opts?.status ? { status: opts.status } : {}),
		},
		include: {
			_count: { select: { signups: { where: { status: 'CONFIRMED' } } } },
			opportunity: { select: { id: true, title: true } },
		},
		orderBy: { startTime: 'asc' },
		take: take + 1,
		...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
	});
}

export async function listShiftsByOpportunity(opportunityId: string) {
	return prisma.shift.findMany({
		where: { opportunityId },
		include: {
			_count: { select: { signups: { where: { status: 'CONFIRMED' } } } },
		},
		orderBy: { startTime: 'asc' },
	});
}

export async function listUpcomingShiftsForOrg(orgId: string, limit = 10) {
	return prisma.shift.findMany({
		where: {
			orgId,
			status: { in: ['OPEN', 'FULL'] },
			startTime: { gte: new Date() },
		},
		include: {
			_count: { select: { signups: { where: { status: 'CONFIRMED' } } } },
			opportunity: { select: { id: true, title: true } },
		},
		orderBy: { startTime: 'asc' },
		take: limit,
	});
}

// ---------------------------------------------------------------------------
// Writes (transactional)
// ---------------------------------------------------------------------------

export type CreateShiftInput = {
	orgId: string;
	opportunityId?: string | null;
	title: string;
	description?: string | null;
	location?: string | null;
	isRemote?: boolean;
	startTime: Date;
	endTime: Date;
	capacity: number;
};

export async function createShift(tx: TxClient, input: CreateShiftInput) {
	return tx.shift.create({
		data: {
			orgId: input.orgId,
			opportunityId: input.opportunityId ?? null,
			title: input.title,
			description: input.description ?? null,
			location: input.location ?? null,
			isRemote: input.isRemote ?? false,
			startTime: input.startTime,
			endTime: input.endTime,
			capacity: input.capacity,
		},
	});
}

export type UpdateShiftInput = {
	id: string;
	opportunityId?: string | null;
	title?: string;
	description?: string | null;
	location?: string | null;
	isRemote?: boolean;
	startTime?: Date;
	endTime?: Date;
	capacity?: number;
	status?: ShiftStatus;
};

export async function updateShift(tx: TxClient, input: UpdateShiftInput) {
	const { id, ...data } = input;
	return tx.shift.update({ where: { id }, data });
}

export async function deleteShift(tx: TxClient, id: string) {
	return tx.shift.delete({ where: { id } });
}
