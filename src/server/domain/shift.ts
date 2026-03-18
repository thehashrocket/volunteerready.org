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
 * Validate whether a volunteer can sign up for a shift.
 * Checks: shift status, capacity, duplicate signup, time conflict.
 */
export function validateSignup(
	shift: ShiftData,
	signups: readonly SignupRecord[],
	userId: string,
	existingUserShifts?: readonly ShiftData[],
): SignupValidation {
	// Shift must be open
	if (shift.status === 'CANCELLED') {
		return { ok: false, reason: 'This shift has been cancelled.' };
	}
	if (shift.status === 'COMPLETED') {
		return { ok: false, reason: 'This shift has already been completed.' };
	}
	if (shift.status === 'FULL') {
		return { ok: false, reason: 'This shift is full.' };
	}

	// Check capacity
	const cap = computeShiftCapacity(shift.capacity, signups);
	if (cap.isFull) {
		return { ok: false, reason: 'This shift is at capacity.' };
	}

	// Check for existing active signup
	const existing = signups.find(
		(s) => s.userId === userId && s.status === 'CONFIRMED',
	);
	if (existing) {
		return { ok: false, reason: 'You are already signed up for this shift.' };
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
): SignupValidation {
	if (shift.status === 'CANCELLED') {
		return { ok: false, reason: 'This shift has been cancelled.' };
	}
	if (shift.status === 'COMPLETED') {
		return { ok: false, reason: 'This shift has already been completed.' };
	}

	// Must be full to waitlist
	const cap = computeShiftCapacity(shift.capacity, signups);
	if (!cap.isFull) {
		return { ok: false, reason: 'Shift has open spots — sign up directly.' };
	}

	// Check for existing active signup or waitlist entry
	const existing = signups.find(
		(s) =>
			s.userId === userId &&
			(s.status === 'CONFIRMED' || s.status === 'WAITLISTED'),
	);
	if (existing?.status === 'CONFIRMED') {
		return { ok: false, reason: 'You are already signed up for this shift.' };
	}
	if (existing?.status === 'WAITLISTED') {
		return { ok: false, reason: 'You are already on the waitlist.' };
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
