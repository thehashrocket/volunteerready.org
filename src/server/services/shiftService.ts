import type { ShiftStatus } from '@/prisma/generated/client';
import { validateShiftTimes } from '@/server/domain/shift';
import { sendEmail } from '@/server/lib/email';
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
import { tryNotify } from '@/server/services/notificationService';

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
	actorId: string | null,
) {
	const completedShift = await prisma.$transaction(async (tx) => {
		// Guard: only transition OPEN/FULL → COMPLETED (prevents TOCTOU race
		// where an admin cancels a shift while the auto-close cron is running)
		const current = await tx.shift.findUnique({
			where: { id },
			select: { status: true },
		});
		if (!current || (current.status !== 'OPEN' && current.status !== 'FULL')) {
			return null;
		}

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

	if (!completedShift) {
		return null;
	}

	// Fire-and-forget: send thank-you notifications to ATTENDED volunteers
	const signups = await prisma.shiftSignup.findMany({
		where: { shiftId: id, status: 'ATTENDED' },
		select: { userId: true },
	});

	const shiftHours =
		Math.round(
			((completedShift.endTime.getTime() - completedShift.startTime.getTime()) /
				3_600_000) *
				10,
		) / 10;

	// Batch query: total hours per volunteer in one round-trip
	const userIds = signups.map((s) => s.userId);
	const totalHoursRows =
		userIds.length > 0
			? await prisma.$queryRaw<
					{ user_id: string; total_hours: number | null }[]
				>`
				SELECT ss."userId" AS user_id, SUM(
					EXTRACT(EPOCH FROM (sh."endTime" - sh."startTime")) / 3600.0
				) AS total_hours
				FROM "ShiftSignup" ss
				JOIN "Shift" sh ON sh.id = ss."shiftId"
				WHERE ss."userId" = ANY(${userIds})
				  AND sh."orgId" = ${orgId}
				  AND ss.status = 'ATTENDED'
				GROUP BY ss."userId"
			`
			: [];
	const hoursMap = new Map(
		totalHoursRows.map((r) => [
			r.user_id,
			Math.round((r.total_hours ?? 0) * 10) / 10,
		]),
	);

	for (const signup of signups) {
		const totalHours = hoursMap.get(signup.userId) ?? 0;

		void tryNotify({
			userId: signup.userId,
			orgId,
			type: 'SHIFT_COMPLETED',
			title: 'Thanks for volunteering!',
			body: `You logged ${shiftHours}h at ${completedShift.title}. You've now volunteered ${totalHours} total hours.`,
			href: '/app/my-shifts',
		});
	}

	// Fire-and-forget: send session summary email to org admins
	void sendShiftSummaryEmail(id, orgId, completedShift.title, signups.length);

	return completedShift;
}

async function sendShiftSummaryEmail(
	shiftId: string,
	orgId: string,
	shiftTitle: string,
	attendedCount: number,
) {
	try {
		const allSignups = await prisma.shiftSignup.count({
			where: {
				shiftId,
				status: { in: ['ATTENDED', 'CONFIRMED', 'NO_SHOW'] },
			},
		});
		const noShows = allSignups - attendedCount;
		const admins = await prisma.organizationMember.findMany({
			where: {
				organizationId: orgId,
				role: { in: ['OWNER', 'ADMIN'] },
			},
			include: { user: { select: { email: true } } },
		});

		const safeTitle = shiftTitle
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
		const html = `
			<h2>Shift Summary: ${safeTitle}</h2>
			<p>Here's a summary of the completed shift:</p>
			<ul>
				<li><strong>Attended:</strong> ${attendedCount} volunteers</li>
				<li><strong>No-shows:</strong> ${noShows}</li>
				<li><strong>Attendance rate:</strong> ${allSignups > 0 ? Math.round((attendedCount / allSignups) * 100) : 0}%</li>
			</ul>
			<p>View details in your <a href="/app/shifts">shift dashboard</a>.</p>
		`;

		for (const admin of admins) {
			if (admin.user.email) {
				void sendEmail(admin.user.email, `Shift Complete: ${shiftTitle}`, html);
			}
		}
	} catch (err) {
		console.error('[shiftService] sendShiftSummaryEmail failed:', err);
	}
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
