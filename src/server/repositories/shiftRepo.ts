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

/**
 * Upcoming shifts a volunteer can claim: every OPEN or FULL shift that has not
 * started, at an org where `userId` has a LIVE roster row (approval puts an
 * applicant on the roster) and no block, and that is not suspended.
 *
 * The roster row is the authorization: a volunteer never learns about an org's
 * schedule before that org has approved them. The block filter is belt and
 * braces — leaving soft-deletes the roster row in the same transaction that
 * writes the block — so a race between the two can't list a revoked org.
 *
 * `signups` carries only the caller's own row (for "you're signed up"), and the
 * seat count is an aggregate; no other volunteer is identifiable from this.
 */
export async function listClaimableShiftsForUser(
	userId: string,
	now: Date,
	take = 50,
) {
	return prisma.shift.findMany({
		where: {
			status: { in: ['OPEN', 'FULL'] },
			startTime: { gt: now },
			organization: {
				suspendedAt: null,
				orgVolunteers: { some: { userId, deletedAt: null } },
				orgVolunteerBlocks: { none: { userId } },
			},
		},
		select: {
			id: true,
			title: true,
			startTime: true,
			endTime: true,
			location: true,
			isRemote: true,
			capacity: true,
			status: true,
			organization: { select: { id: true, name: true } },
			opportunity: { select: { title: true } },
			_count: { select: { signups: { where: { status: 'CONFIRMED' } } } },
			// Any live row of the caller's (a CANCELLED one can be signed up again).
			signups: {
				where: { userId, status: { not: 'CANCELLED' } },
				select: { status: true },
			},
		},
		orderBy: { startTime: 'asc' },
		take,
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
