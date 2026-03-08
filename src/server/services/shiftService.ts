import type { ShiftStatus } from '@/prisma/generated/client';
import { validateShiftTimes } from '@/server/domain/shift';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import {
	type CreateShiftInput,
	createShift,
	deleteShift,
	getShiftById,
	getShiftWithSignups,
	listShiftsByOpportunity,
	listShiftsByOrg,
	listUpcomingShiftsForOrg,
	type UpdateShiftInput,
	updateShift,
} from '@/server/repositories/shiftRepo';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getShift(id: string) {
	return getShiftById(id);
}

export async function getShiftDetail(id: string) {
	return getShiftWithSignups(id);
}

export async function listOrgShifts(
	orgId: string,
	opts?: { status?: ShiftStatus; cursor?: string; take?: number },
) {
	return listShiftsByOrg(orgId, opts);
}

export async function listOpportunityShifts(opportunityId: string) {
	return listShiftsByOpportunity(opportunityId);
}

export async function getUpcomingOrgShifts(orgId: string, limit?: number) {
	return listUpcomingShiftsForOrg(orgId, limit);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createNewShift(input: CreateShiftInput, actorId: string) {
	const timeCheck = validateShiftTimes(input.startTime, input.endTime);
	if (!timeCheck.ok) {
		throw new Error(timeCheck.reason);
	}

	return prisma.$transaction(async (tx) => {
		const shift = await createShift(tx, input);
		await writeAuditLogTx(tx, {
			orgId: input.orgId,
			actorId,
			action: 'shift.created',
			entityType: 'Shift',
			entityId: shift.id,
			metadata: {
				title: input.title,
				startTime: input.startTime,
				endTime: input.endTime,
			},
		});
		return shift;
	});
}

export async function updateExistingShift(
	input: UpdateShiftInput,
	orgId: string,
	actorId: string,
) {
	if (input.startTime && input.endTime) {
		const timeCheck = validateShiftTimes(input.startTime, input.endTime);
		if (!timeCheck.ok) {
			throw new Error(timeCheck.reason);
		}
	}

	return prisma.$transaction(async (tx) => {
		const shift = await updateShift(tx, input);
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'shift.updated',
			entityType: 'Shift',
			entityId: shift.id,
			metadata: input,
		});
		return shift;
	});
}

export async function cancelShift(id: string, orgId: string, actorId: string) {
	return prisma.$transaction(async (tx) => {
		const shift = await updateShift(tx, { id, status: 'CANCELLED' });
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'shift.cancelled',
			entityType: 'Shift',
			entityId: id,
		});
		return shift;
	});
}

export async function completeShift(
	id: string,
	orgId: string,
	actorId: string,
) {
	return prisma.$transaction(async (tx) => {
		const shift = await updateShift(tx, { id, status: 'COMPLETED' });
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'shift.completed',
			entityType: 'Shift',
			entityId: id,
		});
		return shift;
	});
}

export async function removeShift(id: string, orgId: string, actorId: string) {
	return prisma.$transaction(async (tx) => {
		await deleteShift(tx, id);
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'shift.deleted',
			entityType: 'Shift',
			entityId: id,
		});
	});
}
