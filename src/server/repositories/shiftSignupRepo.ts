import type { PrismaClient, SignupStatus } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getSignupsByShift(shiftId: string) {
	return prisma.shiftSignup.findMany({
		where: { shiftId },
		include: {
			user: { select: { id: true, name: true, email: true, image: true } },
		},
		orderBy: { createdAt: 'asc' },
	});
}

export async function getSignupByShiftAndUser(shiftId: string, userId: string) {
	return prisma.shiftSignup.findUnique({
		where: { shiftId_userId: { shiftId, userId } },
	});
}

export async function getConfirmedShiftsForUser(userId: string) {
	return prisma.shiftSignup.findMany({
		where: { userId, status: 'CONFIRMED' },
		include: {
			shift: {
				select: {
					id: true,
					title: true,
					startTime: true,
					endTime: true,
					status: true,
					location: true,
					isRemote: true,
					capacity: true,
					orgId: true,
					opportunity: { select: { id: true, title: true } },
				},
			},
		},
		orderBy: { shift: { startTime: 'asc' } },
	});
}

/**
 * Get all ATTENDED signups for a user, with shift start/end times and orgId.
 * Used by volunteerIdentityService to compute total volunteer hours and orgCount.
 */
export async function getAttendedShiftsForUser(userId: string) {
	return prisma.shiftSignup.findMany({
		where: { userId, status: 'ATTENDED' },
		include: {
			shift: {
				select: {
					startTime: true,
					endTime: true,
					orgId: true,
				},
			},
		},
	});
}

/**
 * Get all non-CANCELLED signups for a user.
 * Used by volunteerIdentityService to compute reliability score.
 */
export async function getSignupsForReliability(userId: string) {
	return prisma.shiftSignup.findMany({
		where: { userId, status: { not: 'CANCELLED' } },
		select: { status: true, createdAt: true },
	});
}

export async function getUpcomingSignupsForUser(userId: string, limit = 10) {
	return prisma.shiftSignup.findMany({
		where: {
			userId,
			status: 'CONFIRMED',
			shift: {
				startTime: { gte: new Date() },
				status: { in: ['OPEN', 'FULL'] },
			},
		},
		include: {
			shift: {
				select: {
					id: true,
					title: true,
					startTime: true,
					endTime: true,
					location: true,
					isRemote: true,
					orgId: true,
					organization: { select: { name: true, slug: true } },
				},
			},
		},
		orderBy: { shift: { startTime: 'asc' } },
		take: limit,
	});
}

export async function getWaitlistForShift(shiftId: string) {
	return prisma.shiftSignup.findMany({
		where: { shiftId, status: 'WAITLISTED' },
		include: {
			user: { select: { id: true, name: true, email: true, image: true } },
		},
		orderBy: { createdAt: 'asc' },
	});
}

export async function getUpcomingSignupsForUserIncludingWaitlist(
	userId: string,
	limit = 20,
) {
	return prisma.shiftSignup.findMany({
		where: {
			userId,
			status: { in: ['CONFIRMED', 'WAITLISTED'] },
			shift: {
				startTime: { gte: new Date() },
				status: { in: ['OPEN', 'FULL'] },
			},
		},
		include: {
			shift: {
				select: {
					id: true,
					title: true,
					startTime: true,
					endTime: true,
					location: true,
					isRemote: true,
					orgId: true,
					organization: { select: { name: true, slug: true } },
				},
			},
		},
		orderBy: { shift: { startTime: 'asc' } },
		take: limit,
	});
}

// ---------------------------------------------------------------------------
// Writes (transactional)
// ---------------------------------------------------------------------------

export async function createSignup(
	tx: TxClient,
	input: { shiftId: string; userId: string; notes?: string | null },
) {
	return tx.shiftSignup.create({
		data: {
			shiftId: input.shiftId,
			userId: input.userId,
			notes: input.notes ?? null,
			status: 'CONFIRMED',
		},
	});
}

export async function createWaitlistEntry(
	tx: TxClient,
	input: { shiftId: string; userId: string },
) {
	return tx.shiftSignup.create({
		data: {
			shiftId: input.shiftId,
			userId: input.userId,
			status: 'WAITLISTED',
		},
	});
}

export async function updateSignupStatus(
	tx: TxClient,
	shiftId: string,
	userId: string,
	status: SignupStatus,
) {
	return tx.shiftSignup.update({
		where: { shiftId_userId: { shiftId, userId } },
		data: { status },
	});
}

export async function deleteSignup(
	tx: TxClient,
	shiftId: string,
	userId: string,
) {
	return tx.shiftSignup.delete({
		where: { shiftId_userId: { shiftId, userId } },
	});
}
