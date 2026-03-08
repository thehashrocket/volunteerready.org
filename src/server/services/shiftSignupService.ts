import type { ShiftData, SignupRecord } from '@/server/domain/shift';
import { validateSignup } from '@/server/domain/shift';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import { getShiftById } from '@/server/repositories/shiftRepo';
import {
	createSignup,
	getConfirmedShiftsForUser,
	getSignupByShiftAndUser,
	getSignupsByShift,
	getUpcomingSignupsForUser,
	updateSignupStatus,
} from '@/server/repositories/shiftSignupRepo';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getShiftSignups(shiftId: string) {
	return getSignupsByShift(shiftId);
}

export async function getMyConfirmedShifts(userId: string) {
	return getConfirmedShiftsForUser(userId);
}

export async function getMyUpcomingShifts(userId: string, limit?: number) {
	return getUpcomingSignupsForUser(userId, limit);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function signUpForShift(
	shiftId: string,
	userId: string,
	notes?: string | null,
) {
	const shift = await getShiftById(shiftId);
	if (!shift) throw new Error('Shift not found.');

	const signups = await getSignupsByShift(shiftId);
	const userShiftSignups = await getConfirmedShiftsForUser(userId);

	// Map to domain types
	const shiftData: ShiftData = {
		id: shift.id,
		title: shift.title,
		startTime: shift.startTime,
		endTime: shift.endTime,
		capacity: shift.capacity,
		status: shift.status as ShiftData['status'],
		location: shift.location,
		isRemote: shift.isRemote,
	};

	const signupRecords: SignupRecord[] = signups.map((s) => ({
		id: s.id,
		shiftId: s.shiftId,
		userId: s.userId,
		status: s.status as SignupRecord['status'],
		createdAt: s.createdAt,
	}));

	const existingShifts: ShiftData[] = userShiftSignups.map((s) => ({
		id: s.shift.id,
		title: s.shift.title,
		startTime: s.shift.startTime,
		endTime: s.shift.endTime,
		capacity: s.shift.capacity,
		status: s.shift.status as ShiftData['status'],
		location: s.shift.location,
		isRemote: s.shift.isRemote,
	}));

	const validation = validateSignup(
		shiftData,
		signupRecords,
		userId,
		existingShifts,
	);
	if (!validation.ok) {
		throw new Error(validation.reason);
	}

	return prisma.$transaction(async (tx) => {
		const signup = await createSignup(tx, { shiftId, userId, notes });

		// Auto-mark shift as FULL if at capacity
		const confirmedCount =
			signupRecords.filter((s) => s.status === 'CONFIRMED').length + 1;
		if (confirmedCount >= shift.capacity) {
			await tx.shift.update({
				where: { id: shiftId },
				data: { status: 'FULL' },
			});
		}

		await writeAuditLogTx(tx, {
			orgId: shift.orgId,
			actorId: userId,
			action: 'shift.signup',
			entityType: 'ShiftSignup',
			entityId: signup.id,
			metadata: { shiftId, shiftTitle: shift.title },
		});

		return signup;
	});
}

export async function cancelSignup(shiftId: string, userId: string) {
	const shift = await getShiftById(shiftId);
	if (!shift) throw new Error('Shift not found.');

	const existing = await getSignupByShiftAndUser(shiftId, userId);
	if (!existing || existing.status !== 'CONFIRMED') {
		throw new Error('No active signup found for this shift.');
	}

	return prisma.$transaction(async (tx) => {
		const updated = await updateSignupStatus(tx, shiftId, userId, 'CANCELLED');

		// Re-open shift if it was FULL
		if (shift.status === 'FULL') {
			await tx.shift.update({
				where: { id: shiftId },
				data: { status: 'OPEN' },
			});
		}

		await writeAuditLogTx(tx, {
			orgId: shift.orgId,
			actorId: userId,
			action: 'shift.signup.cancelled',
			entityType: 'ShiftSignup',
			entityId: existing.id,
			metadata: { shiftId, shiftTitle: shift.title },
		});

		return updated;
	});
}

export async function markAttendance(
	shiftId: string,
	userId: string,
	status: 'ATTENDED' | 'NO_SHOW',
	actorId: string,
) {
	const shift = await getShiftById(shiftId);
	if (!shift) throw new Error('Shift not found.');

	return prisma.$transaction(async (tx) => {
		const updated = await updateSignupStatus(tx, shiftId, userId, status);

		await writeAuditLogTx(tx, {
			orgId: shift.orgId,
			actorId,
			action: `shift.attendance.${status.toLowerCase()}`,
			entityType: 'ShiftSignup',
			entityId: updated.id,
			metadata: { shiftId, userId, status },
		});

		return updated;
	});
}
