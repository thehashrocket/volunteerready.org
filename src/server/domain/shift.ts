// ---------------------------------------------------------------------------
// Shift & Scheduling — pure domain logic (no framework imports)
// ---------------------------------------------------------------------------

// ---- Types ----------------------------------------------------------------

export type ShiftStatus = 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
export type SignupStatus = 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'ATTENDED';

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
