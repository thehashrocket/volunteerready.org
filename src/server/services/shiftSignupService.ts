import { TRPCError } from '@trpc/server';
import type {
	ShiftData,
	SignupFailureCode,
	SignupRecord,
	SignupStatus,
} from '@/server/domain/shift';
import {
	getNextWaitlistEntry,
	validateSignup,
	validateWaitlistJoin,
} from '@/server/domain/shift';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	findOrgVolunteerBlock,
	findOrgVolunteerById,
	listAssignableVolunteers,
} from '@/server/repositories/orgVolunteerRepo';
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
import { liftOrgVolunteerBlock } from '@/server/services/orgVolunteerAccessService';
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

/**
 * Roster rows the assign picker can offer for this shift.
 *
 * `requireOrgShift` first, even though the listing is already scoped by `orgId`
 * and a foreign `shiftId` would only fail to exclude anyone. The invariant
 * worth keeping cheap to audit is "every shiftId arriving from input is scoped
 * before use", not "this particular caller happens to be safe without it".
 *
 * Projects the same four fields the roster page does, and — like it —
 * deliberately no `userId`. `OrgVolunteer.id` is the handle
 * `assignVolunteerToShift` takes.
 */
export async function getAssignableVolunteers(input: {
	shiftId: string;
	orgId: string;
	search?: string | null;
}) {
	await requireOrgShift(input.shiftId, input.orgId);

	const rows = await listAssignableVolunteers(input);

	return rows.map((v) => ({
		id: v.id,
		displayName: v.displayName,
		email: v.user.email,
		accountState: v.user.accountState,
	}));
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

			// Volunteering for one of an org's shifts is affirmative re-engagement,
			// so it lifts any block on that org. Only reachable on the SELF-signup
			// path: `assignVolunteerToShift` is a separate function, and staff
			// cannot get a blocked person onto a shift anyway, since that assign
			// requires a live roster row and `addVolunteer` refuses to create one.
			await liftOrgVolunteerBlock(tx, shift.orgId, userId);

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

/**
 * Why a staff assignment was refused, as a wire error.
 *
 * Deliberately NOT `mapSignupFailure`. That mapping collapses "cancelled" and
 * "completed" into NOT_FOUND because `shifts.signup` is open to any
 * authenticated user and the specific answer would confirm a guessed id. Here
 * the caller is staff at the org that owns the shift — `requireOrgShift` has
 * already established that — so they are entitled to every fact about it, and
 * they are looking at the shift's status in the dialog while they read this.
 * Collapsing it would tell a coordinator their own shift does not exist.
 */
function mapAssignFailure(reason: string): TRPCError {
	return new TRPCError({ code: 'CONFLICT', message: reason });
}

/**
 * The signup states that mean "this person is already on this shift", mapped to
 * what staff should be told.
 *
 * CANCELLED and WAITLISTED are absent on purpose — those are the two states
 * `assignVolunteerToShift` revives rather than refuses.
 */
const ASSIGN_BLOCKED_BY_STATUS: Partial<Record<SignupStatus, string>> = {
	CONFIRMED: 'They are already assigned to this shift.',
	ATTENDED: 'They are already marked attended for this shift.',
	NO_SHOW: 'They are already marked a no-show for this shift.',
};

/**
 * Put a volunteer from the org's roster onto one of the org's shifts.
 *
 * This is the mutation the roster exists to enable: without it `/app/volunteers`
 * is a list that leads nowhere. Staff-initiated, so both ids arrive from client
 * input and both are scoped before anything is read:
 *
 *   - `shiftId` through `requireOrgShift` — a foreign shift is NOT_FOUND.
 *   - `volunteerId` is an `OrgVolunteer.id`, resolved through
 *     `findOrgVolunteerById(orgId, …)`. The client never sees `User.id` (that
 *     is a cross-tenant correlation handle — see the roster projection), so the
 *     user id is derived here from a row the org demonstrably owns.
 *
 * ## Reassignment
 *
 * The design doc claimed `@@unique([shiftId, userId])` made this idempotent. It
 * does not: `createSignup` only ever creates, and `validateSignup`'s duplicate
 * check matches CONFIRMED alone — so a volunteer with a CANCELLED row passed
 * validation, hit the unique index and produced an unhandled P2002. Re-adding
 * someone who cancelled is an ordinary coordinator action, so the existing row
 * is resolved explicitly instead: CANCELLED and WAITLISTED are revived to
 * CONFIRMED, and the three states that mean "already on this shift" are
 * refused by name.
 *
 * ## Over capacity
 *
 * `allowOverCapacity` waives capacity and nothing else — `validateSignup` puts
 * the capacity checks last precisely so waiving them cannot skip the lifecycle,
 * duplicate and time-conflict rules. It is never a default: the coordinator
 * confirms against real numbers in the UI first (design decision D11).
 */
export async function assignVolunteerToShift(input: {
	shiftId: string;
	/** `OrgVolunteer.id`, never `User.id`. */
	volunteerId: string;
	orgId: string;
	actorId: string;
	allowOverCapacity?: boolean;
	impersonatedBy?: string | null;
}) {
	const shift = await requireOrgShift(input.shiftId, input.orgId);

	const volunteer = await findOrgVolunteerById(input.orgId, input.volunteerId);
	if (!volunteer) {
		// NOT_FOUND, not FORBIDDEN, matching the sibling guards: "not on your
		// roster" and "not a real id" must be indistinguishable.
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Volunteer not found on your roster.',
		});
	}
	const userId = volunteer.userId;

	// Defence in depth. All THREE roster-row creators — `addVolunteer`,
	// `ensureAppliedRosterRow`, `restoreVolunteer` — refuse while a block stands,
	// so a live roster row and a block should not coexist. That invariant is
	// upheld by three separate callsites and nothing enforces it structurally;
	// `restoreVolunteer` was in fact missing its check until review caught it.
	// This path reads the roster row DIRECTLY rather than through
	// `requireOrgVolunteerRelationship`, so it is where that invariant failing
	// would let an org schedule — and email — someone who refused them. A guard
	// one refactor away from the thing it guards is how this bug class recurs;
	// one indexed lookup on a staff action is cheap.
	//
	// NOT_FOUND for the same reason as the roster miss just above: staff learn
	// only that this person is not theirs to schedule.
	if (await findOrgVolunteerBlock(input.orgId, userId)) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Volunteer not found on your roster.',
		});
	}

	const existing = await getSignupByShiftAndUser(input.shiftId, userId);
	if (existing) {
		const blocked = ASSIGN_BLOCKED_BY_STATUS[existing.status];
		if (blocked) throw mapAssignFailure(blocked);
	}

	const signups = await getSignupsByShift(input.shiftId);
	const userShiftSignups = await getConfirmedShiftsForUser(userId);

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
		{ allowOverCapacity: input.allowOverCapacity },
	);
	if (!validation.ok) {
		throw mapAssignFailure(validation.reason);
	}

	const confirmedCount =
		signupRecords.filter((s) => s.status === 'CONFIRMED').length + 1;
	const overCapacity = confirmedCount > shift.capacity;

	// No tenure-badge or re-engagement side effects follow the commit, unlike
	// `signUpForShift`. Both of those record that the VOLUNTEER did something;
	// being scheduled by staff is not something they did. Their participation is
	// recorded when attendance is marked.
	return prisma.$transaction(async (tx) => {
		const signup = existing
			? await updateSignupStatus(tx, input.shiftId, userId, 'CONFIRMED')
			: await createSignup(tx, { shiftId: input.shiftId, userId });

		// Same denormalisation `signUpForShift` maintains. Over capacity the shift
		// is FULL by any reading, so this branch covers that case too.
		if (confirmedCount >= shift.capacity && shift.status !== 'FULL') {
			await tx.shift.update({
				where: { id: input.shiftId },
				data: { status: 'FULL' },
			});
		}

		await writeAuditLogTx(tx, {
			orgId: input.orgId,
			// The STAFF member, not the volunteer — the whole point of this path is
			// that somebody else put them on the shift.
			actorId: input.actorId,
			action: 'shift.volunteer.assigned',
			entityType: 'ShiftSignup',
			entityId: signup.id,
			metadata: {
				shiftId: input.shiftId,
				shiftTitle: shift.title,
				volunteerId: input.volunteerId,
				assignedUserId: userId,
				// Records that a cap was knowingly exceeded, and by whom. Without it
				// "why does this shift have 10 of 9?" is unanswerable later.
				overCapacity,
				revivedFrom: existing?.status ?? null,
				...(input.impersonatedBy
					? { impersonatedBy: input.impersonatedBy }
					: {}),
			},
		});

		return {
			signupId: signup.id,
			displayName: volunteer.displayName,
			accountState: volunteer.user.accountState,
			shiftTitle: shift.title,
			overCapacity,
		};
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
