import { TRPCError } from '@trpc/server';
import type {
	ShiftData,
	SignupFailureCode,
	SignupRecord,
} from '@/server/domain/shift';
import {
	getNextWaitlistEntry,
	validateSignup,
	validateWaitlistJoin,
} from '@/server/domain/shift';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import { prisma } from '@/server/repositories/prisma';
import {
	findMemberByUserAndOrg,
	touchMemberActivity,
} from '@/server/repositories/reengagement-repo';
import { getShiftById } from '@/server/repositories/shiftRepo';
import {
	createSignup,
	createWaitlistEntry,
	getConfirmedShiftsForUser,
	getSignupByShiftAndUser,
	getSignupsByShift,
	getUpcomingSignupsForUser,
	getUpcomingSignupsForUserIncludingWaitlist,
	getWaitlistForShift,
	updateSignupStatus,
} from '@/server/repositories/shiftSignupRepo';
import { tryNotify } from '@/server/services/notificationService';
import {
	type AttendanceAuthorization,
	requireAttendanceAccess,
	requireOrgShift,
} from '@/server/services/shiftAccessService';
import { checkAndIssueTenureBadges } from '@/server/services/tenureBadgeService';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * SECURITY: `orgId` is required, not optional. This returns another tenant's
 * volunteer names and email addresses if the shift is not scoped.
 */
export async function getShiftSignups(shiftId: string, orgId: string) {
	await requireOrgShift(shiftId, orgId);
	return getSignupsByShift(shiftId);
}

export async function getMyConfirmedShifts(userId: string) {
	return getConfirmedShiftsForUser(userId);
}

export async function getMyUpcomingShifts(userId: string, limit?: number) {
	return getUpcomingSignupsForUser(userId, limit);
}

export async function getMyUpcomingShiftsWithWaitlist(
	userId: string,
	limit?: number,
) {
	return getUpcomingSignupsForUserIncludingWaitlist(userId, limit);
}

/** SECURITY: org-scoped for the same reason as `getShiftSignups`. */
export async function getShiftWaitlist(shiftId: string, orgId: string) {
	await requireOrgShift(shiftId, orgId);
	return getWaitlistForShift(shiftId);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * The one NOT_FOUND every "this shift is not available to you" outcome resolves
 * to, so a caller enumerating ids cannot tell them apart.
 */
function shiftNotFound() {
	return new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found.' });
}

/**
 * Map a refused signup to a wire error, deciding what is safe to disclose.
 *
 * `shifts.signup` and `joinWaitlist` are deliberately open to ANY authenticated
 * user — no org relationship is required, unlike every staff path in
 * shiftAccessService.ts. That means there is no caller-identity axis to
 * authorize on, and this mapping is the only thing between an authenticated
 * stranger and a shift-by-shift map of an org's internal schedule. It is the
 * control, not error-handling hygiene.
 *
 * The split is therefore not "who is asking" but "what class of fact would this
 * disclose":
 *
 * - SHIFT_CANCELLED / SHIFT_COMPLETED are administrative decisions the org made
 *   about its own schedule. Telling a stranger who guessed an id "this is real,
 *   and staff cancelled it" is the write-side twin of the getCheckinToken leak.
 *   Both collapse into the same NOT_FOUND a missing shift returns.
 *
 * - SHIFT_FULL / AT_CAPACITY / NOT_FULL are the live result of contention for a
 *   fixed number of seats — the same fact any "sold out" response discloses.
 *   Every caller attempting this action at this moment gets the same answer
 *   regardless of who they are, so specificity reveals nothing about the org.
 *
 * - ALREADY_SIGNED_UP / ALREADY_WAITLISTED / TIME_CONFLICT describe the
 *   CALLER'S OWN account state and nobody else's. They cannot teach a prober
 *   anything they did not already know.
 *
 * Note the cost: a legitimate volunteer whose shift was cancelled now sees
 * "Shift not found." rather than "This shift has been cancelled." That is
 * unobservable today (no UI calls these procedures) and is the accepted
 * trade-off — but it is a real papercut for the future self-serve flow, and
 * that flow should re-derive the friendly message from data the caller is
 * already entitled to see rather than by un-collapsing this mapping.
 */
function mapSignupFailure(code: SignupFailureCode, reason: string): TRPCError {
	switch (code) {
		case 'SHIFT_CANCELLED':
		case 'SHIFT_COMPLETED':
			return shiftNotFound();
		case 'SHIFT_FULL':
		case 'AT_CAPACITY':
		case 'NOT_FULL':
		case 'ALREADY_SIGNED_UP':
		case 'ALREADY_WAITLISTED':
		case 'TIME_CONFLICT':
			return new TRPCError({ code: 'CONFLICT', message: reason });
	}
}

export async function signUpForShift(
	shiftId: string,
	userId: string,
	notes?: string | null,
) {
	const shift = await getShiftById(shiftId);
	if (!shift) throw shiftNotFound();

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
		throw mapSignupFailure(validation.code, validation.reason);
	}

	return prisma
		.$transaction(async (tx) => {
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
		})
		.then((signup) => {
			// Fire-and-forget: check if signup unlocks a tenure badge.
			void checkAndIssueTenureBadges(userId);
			// Fire-and-forget: update activity timestamp for re-engagement tracking.
			void findMemberByUserAndOrg(userId, shift.orgId).then((memberId) => {
				if (memberId) void touchMemberActivity(memberId);
			});
			return signup;
		});
}

export async function cancelSignup(shiftId: string, userId: string) {
	// SECURITY: the caller's OWN signup is checked before the shift is loaded.
	// The reverse order threw a distinguishable "Shift not found." for a shift
	// the caller has no signup on, which let a prober separate real ids from
	// fake ones on a procedure that needs no org relationship at all. Every
	// outcome a stranger can reach is now the same message.
	const existing = await getSignupByShiftAndUser(shiftId, userId);
	if (
		!existing ||
		(existing.status !== 'CONFIRMED' && existing.status !== 'WAITLISTED')
	) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'No active signup found for this shift.',
		});
	}

	const shift = await getShiftById(shiftId);
	if (!shift) {
		// Unreachable: `existing` carries a foreign key to a live Shift row.
		throw shiftNotFound();
	}

	const wasConfirmed = existing.status === 'CONFIRMED';

	return prisma.$transaction(async (tx) => {
		const updated = await updateSignupStatus(tx, shiftId, userId, 'CANCELLED');

		await writeAuditLogTx(tx, {
			orgId: shift.orgId,
			actorId: userId,
			action: 'shift.signup.cancelled',
			entityType: 'ShiftSignup',
			entityId: existing.id,
			metadata: { shiftId, shiftTitle: shift.title },
		});

		// Auto-promote from waitlist if a confirmed spot opened
		if (wasConfirmed) {
			const allSignups = await tx.shiftSignup.findMany({
				where: { shiftId },
				select: {
					id: true,
					shiftId: true,
					userId: true,
					status: true,
					createdAt: true,
				},
			});
			const signupRecords: SignupRecord[] = allSignups.map((s) => ({
				id: s.id,
				shiftId: s.shiftId,
				userId: s.userId,
				status: s.status as SignupRecord['status'],
				createdAt: s.createdAt,
			}));
			const next = getNextWaitlistEntry(signupRecords);

			if (next) {
				await updateSignupStatus(tx, shiftId, next.userId, 'CONFIRMED');
				await writeAuditLogTx(tx, {
					orgId: shift.orgId,
					actorId: userId,
					action: 'shift.waitlist.promoted',
					entityType: 'ShiftSignup',
					entityId: next.id,
					metadata: { shiftId, promotedUserId: next.userId },
				});

				// Fire-and-forget notification to promoted volunteer
				void tryNotify({
					userId: next.userId,
					orgId: shift.orgId,
					type: 'WAITLIST_PROMOTED',
					title: 'You got a spot!',
					body: `A spot opened up for "${shift.title}" and you've been promoted from the waitlist.`,
					href: `/app/my-shifts`,
				});
			} else {
				// No waitlist entries — re-open shift if it was FULL
				if (shift.status === 'FULL') {
					await tx.shift.update({
						where: { id: shiftId },
						data: { status: 'OPEN' },
					});
				}
			}
		}

		return updated;
	});
}

export async function joinWaitlist(shiftId: string, userId: string) {
	const shift = await getShiftById(shiftId);
	if (!shift) throw shiftNotFound();

	const signups = await getSignupsByShift(shiftId);

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

	const validation = validateWaitlistJoin(shiftData, signupRecords, userId);
	if (!validation.ok) {
		throw mapSignupFailure(validation.code, validation.reason);
	}

	return prisma.$transaction(async (tx) => {
		const entry = await createWaitlistEntry(tx, { shiftId, userId });

		await writeAuditLogTx(tx, {
			orgId: shift.orgId,
			actorId: userId,
			action: 'shift.waitlist.joined',
			entityType: 'ShiftSignup',
			entityId: entry.id,
			metadata: { shiftId, shiftTitle: shift.title },
		});

		return entry;
	});
}

export async function leaveWaitlist(shiftId: string, userId: string) {
	// SECURITY: own-row check before the shift lookup, for the same reason as
	// `cancelSignup` above.
	const existing = await getSignupByShiftAndUser(shiftId, userId);
	if (!existing || existing.status !== 'WAITLISTED') {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'You are not on the waitlist for this shift.',
		});
	}

	const shift = await getShiftById(shiftId);
	if (!shift) {
		// Unreachable: `existing` carries a foreign key to a live Shift row.
		throw shiftNotFound();
	}

	return prisma.$transaction(async (tx) => {
		const updated = await updateSignupStatus(tx, shiftId, userId, 'CANCELLED');

		await writeAuditLogTx(tx, {
			orgId: shift.orgId,
			actorId: userId,
			action: 'shift.waitlist.left',
			entityType: 'ShiftSignup',
			entityId: existing.id,
			metadata: { shiftId, shiftTitle: shift.title },
		});

		return updated;
	});
}

/**
 * SECURITY: `auth` is required. Without it this wrote ATTENDED/NO_SHOW into any
 * org's `ShiftSignup` by id, stamping the audit row with the victim org's
 * `orgId` and the attacker's `actorId`.
 */
export async function markAttendance(
	shiftId: string,
	userId: string,
	status: 'ATTENDED' | 'NO_SHOW',
	actorId: string,
	auth: AttendanceAuthorization,
	method?: 'manual' | 'qr' | 'geo',
) {
	const shift = await requireAttendanceAccess(shiftId, userId, auth);

	return prisma.$transaction(async (tx) => {
		// Lock the signup row to prevent concurrent audit log duplication
		const [existing] = await tx.$queryRaw<
			{ id: string; status: string }[]
		>`SELECT id, status FROM "ShiftSignup" WHERE "shiftId" = ${shiftId} AND "userId" = ${userId} FOR UPDATE`;

		if (!existing) {
			throw new Error('No signup found for this shift.');
		}

		// Idempotent: already ATTENDED, skip audit log
		if (existing.status === 'ATTENDED' && status === 'ATTENDED') {
			return { ...existing, alreadyCheckedIn: true };
		}

		// Reject if signup was cancelled/waitlisted (e.g. token obtained then cancelled)
		if (
			status === 'ATTENDED' &&
			existing.status !== 'CONFIRMED' &&
			existing.status !== 'ATTENDED'
		) {
			throw new Error(`Cannot mark attendance: signup is ${existing.status}.`);
		}

		const updated = await updateSignupStatus(tx, shiftId, userId, status);

		await writeAuditLogTx(tx, {
			orgId: shift.orgId,
			actorId,
			action: `shift.attendance.${status.toLowerCase()}`,
			entityType: 'ShiftSignup',
			entityId: updated.id,
			metadata: { shiftId, userId, status, method: method ?? 'manual' },
		});

		return { ...updated, alreadyCheckedIn: false };
	});
}

/**
 * Get the check-in status for a volunteer on a specific shift.
 */
export async function getMyCheckinStatus(shiftId: string, userId: string) {
	const signup = await getSignupByShiftAndUser(shiftId, userId);
	if (!signup) return null;
	return { status: signup.status };
}

/**
 * Get check-in stats for a shift (attended count, total confirmed, rate).
 */
export async function getCheckinStats(shiftId: string) {
	const signups = await getSignupsByShift(shiftId);
	const confirmed = signups.filter(
		(s) => s.status === 'CONFIRMED' || s.status === 'ATTENDED',
	);
	const attended = signups.filter((s) => s.status === 'ATTENDED');
	return {
		attended: attended.length,
		total: confirmed.length,
		rate:
			confirmed.length > 0
				? Math.round((attended.length / confirmed.length) * 100)
				: 0,
	};
}
