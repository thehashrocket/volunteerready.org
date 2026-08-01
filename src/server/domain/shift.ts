import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shift & Scheduling — pure domain logic (no framework imports)
// ---------------------------------------------------------------------------

// ---- Types ----------------------------------------------------------------

export type ShiftStatus = 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
export type SignupStatus =
	| 'CONFIRMED'
	| 'WAITLISTED'
	| 'CANCELLED'
	| 'NO_SHOW'
	| 'ATTENDED';

export type ShiftData = {
	id: string;
	title: string;
	startTime: Date;
	endTime: Date;
	capacity: number;
	status: ShiftStatus;
	location?: string | null;
	isRemote?: boolean;
	description?: string | null;
	opportunityId?: string | null;
};

export type SignupRecord = {
	id: string;
	shiftId: string;
	userId: string;
	status: SignupStatus;
	createdAt: Date;
};

export type ShiftCapacity = {
	total: number;
	confirmed: number;
	available: number;
	isFull: boolean;
	fillRate: number; // 0–100
};

export type AttendanceSummary = {
	total: number;
	attended: number;
	noShow: number;
	cancelled: number;
	attendanceRate: number; // 0–100
};

export type SignupValidation = { ok: true } | { ok: false; reason: string };

/**
 * Why a signup or waitlist-join was refused, as a value the service layer can
 * branch on.
 *
 * `reason` is a human sentence and always will be — but the service has to
 * decide which refusals are safe to disclose to a caller who may have no
 * relationship to the shift's org at all (`shifts.signup` is open to any
 * authenticated user), and string-matching a sentence to make a security
 * decision breaks the moment someone rewords it. So the code is what the
 * service switches on; `reason` is only ever passed through as display text.
 *
 * Deliberately a separate type from `SignupValidation` rather than widening it:
 * `validateShiftTimes` also returns `SignupValidation` and has no failure code,
 * so adding a required `code` there would be a lie.
 *
 * @see mapSignupFailure in shiftSignupService.ts for the disclosure policy.
 */
export type SignupFailureCode =
	| 'SHIFT_CANCELLED'
	| 'SHIFT_COMPLETED'
	| 'SHIFT_FULL'
	| 'AT_CAPACITY'
	| 'ALREADY_SIGNED_UP'
	| 'ALREADY_WAITLISTED'
	| 'NOT_FULL'
	| 'TIME_CONFLICT';

export type SignupCheck =
	| { ok: true }
	| { ok: false; code: SignupFailureCode; reason: string };

// ---- Labels ---------------------------------------------------------------

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
	OPEN: 'Open',
	FULL: 'Full',
	CANCELLED: 'Cancelled',
	COMPLETED: 'Completed',
};

export const SIGNUP_STATUS_LABELS: Record<SignupStatus, string> = {
	CONFIRMED: 'Confirmed',
	WAITLISTED: 'Waitlisted',
	CANCELLED: 'Cancelled',
	NO_SHOW: 'No Show',
	ATTENDED: 'Attended',
};

// ---- Capacity -------------------------------------------------------------

/**
 * Compute capacity info for a shift given its confirmed signups.
 */
export function computeShiftCapacity(
	capacity: number,
	signups: readonly SignupRecord[],
): ShiftCapacity {
	const confirmed = signups.filter((s) => s.status === 'CONFIRMED').length;
	const available = Math.max(0, capacity - confirmed);
	return {
		total: capacity,
		confirmed,
		available,
		isFull: available === 0,
		fillRate: capacity > 0 ? Math.round((confirmed / capacity) * 100) : 0,
	};
}

// ---- Signup validation ----------------------------------------------------

/**
 * Validate whether a volunteer can sign up for — or be assigned to — a shift.
 * Checks: shift status, capacity, duplicate signup, time conflict.
 *
 * Note the duplicate check matches `CONFIRMED` only. A CANCELLED, WAITLISTED,
 * ATTENDED or NO_SHOW row for the same pair still satisfies
 * `ShiftSignup @@unique([shiftId, userId])`, so a caller that CREATES rather
 * than updates must resolve the existing row itself or the insert collides —
 * see `assignVolunteerToShift`, which is where that bit the staff path.
 *
 * @param opts.allowOverCapacity Waive the two capacity refusals (`SHIFT_FULL`,
 *   `AT_CAPACITY`) and nothing else. Staff-only, and never a default: the
 *   coordinator confirms an over-capacity assignment explicitly (design
 *   decision D11).
 *
 *   Waiving them as a guarded block rather than filtering the returned code at
 *   the service is what keeps this safe. Each refusal here returns early, so a
 *   service that instead called this unchanged and ignored the two capacity
 *   codes would also be ignoring the fact that the duplicate and time-conflict
 *   rules below never ran — and would create a signup for someone already on
 *   the shift. Skipping the block lets execution fall through to them.
 */
export function validateSignup(
	shift: ShiftData,
	signups: readonly SignupRecord[],
	userId: string,
	existingUserShifts?: readonly ShiftData[],
	opts?: { allowOverCapacity?: boolean },
): SignupCheck {
	// Shift must be open. Not waivable — an assignment onto a cancelled or
	// completed shift is a mistake however emphatically it is confirmed.
	if (shift.status === 'CANCELLED') {
		return {
			ok: false,
			code: 'SHIFT_CANCELLED',
			reason: 'This shift has been cancelled.',
		};
	}
	if (shift.status === 'COMPLETED') {
		return {
			ok: false,
			code: 'SHIFT_COMPLETED',
			reason: 'This shift has already been completed.',
		};
	}

	// Capacity — the one rule `allowOverCapacity` waives.
	if (!opts?.allowOverCapacity) {
		if (shift.status === 'FULL') {
			return { ok: false, code: 'SHIFT_FULL', reason: 'This shift is full.' };
		}
		const cap = computeShiftCapacity(shift.capacity, signups);
		if (cap.isFull) {
			return {
				ok: false,
				code: 'AT_CAPACITY',
				reason: 'This shift is at capacity.',
			};
		}
	}

	// Check for existing active signup
	const existing = signups.find(
		(s) => s.userId === userId && s.status === 'CONFIRMED',
	);
	if (existing) {
		return {
			ok: false,
			code: 'ALREADY_SIGNED_UP',
			reason: 'You are already signed up for this shift.',
		};
	}

	// Check for time conflicts with user's other confirmed shifts
	if (existingUserShifts) {
		const conflict = existingUserShifts.find(
			(other) =>
				other.id !== shift.id &&
				other.status !== 'CANCELLED' &&
				other.status !== 'COMPLETED' &&
				shift.startTime < other.endTime &&
				shift.endTime > other.startTime,
		);
		if (conflict) {
			return {
				ok: false,
				code: 'TIME_CONFLICT',
				reason: `This shift overlaps with "${conflict.title}".`,
			};
		}
	}

	return { ok: true };
}

// ---- Shift time validation ------------------------------------------------

/**
 * Validate that shift times are logically consistent.
 */
export function validateShiftTimes(
	startTime: Date,
	endTime: Date,
): SignupValidation {
	if (endTime <= startTime) {
		return { ok: false, reason: 'End time must be after start time.' };
	}

	const durationMs = endTime.getTime() - startTime.getTime();
	const maxDurationMs = 24 * 60 * 60 * 1000; // 24 hours
	if (durationMs > maxDurationMs) {
		return { ok: false, reason: 'Shift duration cannot exceed 24 hours.' };
	}

	return { ok: true };
}

// ---- Attendance -----------------------------------------------------------

/**
 * Summarize attendance for a completed shift.
 */
export function summarizeAttendance(
	signups: readonly SignupRecord[],
): AttendanceSummary {
	const attended = signups.filter((s) => s.status === 'ATTENDED').length;
	const noShow = signups.filter((s) => s.status === 'NO_SHOW').length;
	const cancelled = signups.filter((s) => s.status === 'CANCELLED').length;
	const total = signups.length;
	const nonCancelled = total - cancelled;

	return {
		total,
		attended,
		noShow,
		cancelled,
		attendanceRate:
			nonCancelled > 0 ? Math.round((attended / nonCancelled) * 100) : 0,
	};
}

// ---- Hours ----------------------------------------------------------------

/**
 * Decimal places for an hours figure shown to org staff.
 *
 * One, matching `orgAnalyticsRepo`'s convention for org-facing analytics rather
 * than `volunteerIdentityService`'s whole hours. A coordinator reading ONE
 * volunteer's history is looking at a small number of shifts, where rounding a
 * 2.5h Saturday morning to "3h" is a visible lie; the platform-wide profile
 * figure aggregates hundreds and rounds for legibility instead.
 */
export const HOURS_DECIMAL_PLACES = 1;

const MS_PER_HOUR = 1000 * 60 * 60;

function roundHours(hours: number): number {
	const factor = 10 ** HOURS_DECIMAL_PLACES;
	return Math.round(hours * factor) / factor;
}

/** One shift's duration in hours, rounded for display in a per-row cell. */
export function shiftDurationHours(startTime: Date, endTime: Date): number {
	return roundHours((endTime.getTime() - startTime.getTime()) / MS_PER_HOUR);
}

/**
 * Total hours across a set of shifts.
 *
 * Rounds ONCE, from the raw millisecond sum — NOT by adding up the already
 * rounded per-row figures `shiftDurationHours` produces. The two are therefore
 * allowed to disagree by a tenth on a long list, which is the accepted cost of
 * the total being right; summing rounded rows compounds the error instead.
 * Same principle as `computeESGSummary`'s row-vs-summary rounding.
 *
 * Takes whatever rows the caller has already decided to count — there is no
 * status filter here, because the callers that matter (`getVolunteerDetail`)
 * have already filtered to ATTENDED in the query, and re-filtering here would
 * let a caller's `where` and this function's predicate drift apart while both
 * look correct.
 */
export function sumAttendedHours(
	shifts: readonly { startTime: Date; endTime: Date }[],
): number {
	const totalMs = shifts.reduce(
		(sum, s) => sum + (s.endTime.getTime() - s.startTime.getTime()),
		0,
	);
	return roundHours(totalMs / MS_PER_HOUR);
}

// ---- Shift Templates ------------------------------------------------------

export const DAY_OF_WEEK_LABELS = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
] as const;

export type ShiftTemplateData = {
	id: string;
	orgId: string;
	title: string;
	description?: string | null;
	location?: string | null;
	isRemote: boolean;
	dayOfWeek: number;
	startHour: number;
	startMinute: number;
	endHour: number;
	endMinute: number;
	capacity: number;
	opportunityId?: string | null;
};

export const createShiftTemplateSchema = z.object({
	title: z.string().min(1).max(200),
	description: z.string().max(1000).optional(),
	location: z.string().max(200).optional(),
	isRemote: z.boolean().default(false),
	dayOfWeek: z.number().int().min(0).max(6),
	startHour: z.number().int().min(0).max(23),
	startMinute: z.number().int().min(0).max(59),
	endHour: z.number().int().min(0).max(23),
	endMinute: z.number().int().min(0).max(59),
	capacity: z.number().int().min(1).max(1000),
	opportunityId: z.string().optional(),
});

export const updateShiftTemplateSchema = createShiftTemplateSchema.partial();

export const generateShiftsSchema = z.object({
	templateId: z.string(),
	weeks: z.number().int().min(1).max(52),
	startDate: z.coerce.date(),
});

/**
 * Validate template time fields — end must be after start (or span midnight).
 * We allow overnight shifts (e.g., 22:00–02:00).
 */
export function validateTemplateTime(template: {
	startHour: number;
	startMinute: number;
	endHour: number;
	endMinute: number;
}): SignupValidation {
	const startMins = template.startHour * 60 + template.startMinute;
	const endMins = template.endHour * 60 + template.endMinute;
	if (startMins === endMins) {
		return { ok: false, reason: 'Start and end times cannot be the same.' };
	}
	return { ok: true };
}

/**
 * Generate concrete shift dates from a template for N weeks starting from startDate.
 * Returns array of { startTime, endTime } in local time.
 */
export function generateShiftDates(
	template: {
		dayOfWeek: number;
		startHour: number;
		startMinute: number;
		endHour: number;
		endMinute: number;
	},
	weeks: number,
	startDate: Date,
): Array<{ startTime: Date; endTime: Date }> {
	const dates: Array<{ startTime: Date; endTime: Date }> = [];

	// Find the first occurrence of dayOfWeek on or after startDate
	const first = new Date(startDate);
	first.setHours(0, 0, 0, 0);
	const currentDay = first.getDay();
	const daysUntil =
		(template.dayOfWeek - currentDay + 7) % 7 ||
		(currentDay === template.dayOfWeek ? 0 : 7);
	first.setDate(first.getDate() + daysUntil);

	for (let w = 0; w < weeks; w++) {
		const day = new Date(first);
		day.setDate(day.getDate() + w * 7);

		const startTime = new Date(day);
		startTime.setHours(template.startHour, template.startMinute, 0, 0);

		const endTime = new Date(day);
		endTime.setHours(template.endHour, template.endMinute, 0, 0);
		// Handle overnight shifts (end < start means next day)
		if (endTime <= startTime) {
			endTime.setDate(endTime.getDate() + 1);
		}

		dates.push({ startTime, endTime });
	}

	return dates;
}

// ---- Waitlist -------------------------------------------------------------

/**
 * Validate whether a volunteer can join the waitlist for a full shift.
 */
export function validateWaitlistJoin(
	shift: ShiftData,
	signups: readonly SignupRecord[],
	userId: string,
): SignupCheck {
	if (shift.status === 'CANCELLED') {
		return {
			ok: false,
			code: 'SHIFT_CANCELLED',
			reason: 'This shift has been cancelled.',
		};
	}
	if (shift.status === 'COMPLETED') {
		return {
			ok: false,
			code: 'SHIFT_COMPLETED',
			reason: 'This shift has already been completed.',
		};
	}

	// Must be full to waitlist
	const cap = computeShiftCapacity(shift.capacity, signups);
	if (!cap.isFull) {
		return {
			ok: false,
			code: 'NOT_FULL',
			reason: 'Shift has open spots — sign up directly.',
		};
	}

	// Check for existing active signup or waitlist entry
	const existing = signups.find(
		(s) =>
			s.userId === userId &&
			(s.status === 'CONFIRMED' || s.status === 'WAITLISTED'),
	);
	if (existing?.status === 'CONFIRMED') {
		return {
			ok: false,
			code: 'ALREADY_SIGNED_UP',
			reason: 'You are already signed up for this shift.',
		};
	}
	if (existing?.status === 'WAITLISTED') {
		return {
			ok: false,
			code: 'ALREADY_WAITLISTED',
			reason: 'You are already on the waitlist.',
		};
	}

	return { ok: true };
}

/**
 * Get the next volunteer to promote from the waitlist (FIFO by createdAt).
 */
export function getNextWaitlistEntry(
	signups: readonly SignupRecord[],
): SignupRecord | undefined {
	return signups
		.filter((s) => s.status === 'WAITLISTED')
		.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
}

/**
 * Compute waitlist position for a user (1-based, or null if not on waitlist).
 */
export function getWaitlistPosition(
	signups: readonly SignupRecord[],
	userId: string,
): number | null {
	const waitlisted = signups
		.filter((s) => s.status === 'WAITLISTED')
		.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	const idx = waitlisted.findIndex((s) => s.userId === userId);
	return idx >= 0 ? idx + 1 : null;
}
