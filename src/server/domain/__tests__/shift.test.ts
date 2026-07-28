import { describe, expect, it } from 'vitest';

import {
	computeShiftCapacity,
	type ShiftData,
	type SignupRecord,
	summarizeAttendance,
	validateShiftTimes,
	validateSignup,
} from '../shift';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShift(overrides: Partial<ShiftData> = {}): ShiftData {
	return {
		id: 'shift-1',
		title: 'Morning Shift',
		startTime: new Date('2026-04-01T09:00:00Z'),
		endTime: new Date('2026-04-01T12:00:00Z'),
		capacity: 5,
		status: 'OPEN',
		...overrides,
	};
}

function makeSignup(overrides: Partial<SignupRecord> = {}): SignupRecord {
	return {
		id: 'signup-1',
		shiftId: 'shift-1',
		userId: 'user-1',
		status: 'CONFIRMED',
		createdAt: new Date(),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// computeShiftCapacity
// ---------------------------------------------------------------------------

describe('computeShiftCapacity', () => {
	it('returns full capacity when no signups', () => {
		const cap = computeShiftCapacity(5, []);
		expect(cap).toEqual({
			total: 5,
			confirmed: 0,
			available: 5,
			isFull: false,
			fillRate: 0,
		});
	});

	it('counts only CONFIRMED signups', () => {
		const signups = [
			makeSignup({ userId: 'u1', status: 'CONFIRMED' }),
			makeSignup({ userId: 'u2', status: 'CANCELLED' }),
			makeSignup({ userId: 'u3', status: 'CONFIRMED' }),
		];
		const cap = computeShiftCapacity(5, signups);
		expect(cap.confirmed).toBe(2);
		expect(cap.available).toBe(3);
		expect(cap.fillRate).toBe(40);
	});

	it('marks full when at capacity', () => {
		const signups = Array.from({ length: 3 }, (_, i) =>
			makeSignup({ id: `s${i}`, userId: `u${i}`, status: 'CONFIRMED' }),
		);
		const cap = computeShiftCapacity(3, signups);
		expect(cap.isFull).toBe(true);
		expect(cap.available).toBe(0);
		expect(cap.fillRate).toBe(100);
	});

	it('handles zero capacity', () => {
		const cap = computeShiftCapacity(0, []);
		expect(cap.fillRate).toBe(0);
		expect(cap.isFull).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// validateSignup
// ---------------------------------------------------------------------------

describe('validateSignup', () => {
	it('allows signup for open shift with capacity', () => {
		const result = validateSignup(makeShift(), [], 'user-1');
		expect(result).toEqual({ ok: true });
	});

	it('rejects signup for cancelled shift', () => {
		const result = validateSignup(
			makeShift({ status: 'CANCELLED' }),
			[],
			'user-1',
		);
		expect(result).toEqual({
			ok: false,
			code: 'SHIFT_CANCELLED',
			reason: expect.stringContaining('cancelled'),
		});
	});

	it('rejects signup for completed shift', () => {
		const result = validateSignup(
			makeShift({ status: 'COMPLETED' }),
			[],
			'user-1',
		);
		expect(result).toEqual({
			ok: false,
			code: 'SHIFT_COMPLETED',
			reason: expect.stringContaining('completed'),
		});
	});

	it('rejects signup for full shift', () => {
		const result = validateSignup(makeShift({ status: 'FULL' }), [], 'user-1');
		expect(result).toEqual({
			ok: false,
			code: 'SHIFT_FULL',
			reason: expect.stringContaining('full'),
		});
	});

	it('rejects when at capacity even if status is OPEN', () => {
		const signups = Array.from({ length: 5 }, (_, i) =>
			makeSignup({ id: `s${i}`, userId: `u${i}`, status: 'CONFIRMED' }),
		);
		const result = validateSignup(
			makeShift({ capacity: 5 }),
			signups,
			'new-user',
		);
		expect(result).toEqual({
			ok: false,
			code: 'AT_CAPACITY',
			reason: expect.stringContaining('capacity'),
		});
	});

	it('rejects duplicate signup', () => {
		const signups = [makeSignup({ userId: 'user-1', status: 'CONFIRMED' })];
		const result = validateSignup(makeShift(), signups, 'user-1');
		expect(result).toEqual({
			ok: false,
			code: 'ALREADY_SIGNED_UP',
			reason: expect.stringContaining('already signed up'),
		});
	});

	it('allows signup if previous signup was cancelled', () => {
		const signups = [makeSignup({ userId: 'user-1', status: 'CANCELLED' })];
		const result = validateSignup(makeShift(), signups, 'user-1');
		expect(result).toEqual({ ok: true });
	});

	it('detects time conflicts with existing shifts', () => {
		const overlapping = makeShift({
			id: 'shift-2',
			title: 'Overlapping Shift',
			startTime: new Date('2026-04-01T11:00:00Z'),
			endTime: new Date('2026-04-01T14:00:00Z'),
		});
		const result = validateSignup(makeShift(), [], 'user-1', [overlapping]);
		expect(result).toEqual({
			ok: false,
			code: 'TIME_CONFLICT',
			reason: expect.stringContaining('Overlapping Shift'),
		});
	});

	it('allows non-overlapping shifts', () => {
		const later = makeShift({
			id: 'shift-2',
			title: 'Later Shift',
			startTime: new Date('2026-04-01T13:00:00Z'),
			endTime: new Date('2026-04-01T16:00:00Z'),
		});
		const result = validateSignup(makeShift(), [], 'user-1', [later]);
		expect(result).toEqual({ ok: true });
	});

	// -------------------------------------------------------------------------
	// allowOverCapacity — staff assignment
	//
	// It waives capacity and NOTHING else. The three SECURITY cases below are
	// what make that true: each refusal here returns early, so a service that
	// instead ignored the two capacity codes on the way out would silently be
	// ignoring rules that never ran.
	// -------------------------------------------------------------------------

	it('allows a full shift when allowOverCapacity is set', () => {
		const signups = Array.from({ length: 5 }, (_, i) =>
			makeSignup({ id: `s-${i}`, userId: `u-${i}` }),
		);

		expect(
			validateSignup(makeShift({ capacity: 5 }), signups, 'new-user'),
		).toMatchObject({ code: 'AT_CAPACITY' });
		expect(
			validateSignup(makeShift({ capacity: 5 }), signups, 'new-user', [], {
				allowOverCapacity: true,
			}),
		).toEqual({ ok: true });
	});

	it('allows a shift flagged FULL when allowOverCapacity is set', () => {
		expect(
			validateSignup(makeShift({ status: 'FULL' }), [], 'user-1', [], {
				allowOverCapacity: true,
			}),
		).toEqual({ ok: true });
	});

	it('SECURITY: allowOverCapacity does not waive an existing signup', () => {
		const signups = [makeSignup({ userId: 'user-1' })];

		expect(
			validateSignup(makeShift({ status: 'FULL' }), signups, 'user-1', [], {
				allowOverCapacity: true,
			}),
		).toMatchObject({ code: 'ALREADY_SIGNED_UP' });
	});

	it('SECURITY: allowOverCapacity does not waive a time conflict', () => {
		const overlapping = makeShift({
			id: 'shift-2',
			title: 'Overlapping Shift',
			startTime: new Date('2026-04-01T10:00:00Z'),
			endTime: new Date('2026-04-01T13:00:00Z'),
		});

		expect(
			validateSignup(
				makeShift({ status: 'FULL' }),
				[],
				'user-1',
				[overlapping],
				{ allowOverCapacity: true },
			),
		).toMatchObject({ code: 'TIME_CONFLICT' });
	});

	it('SECURITY: allowOverCapacity does not waive a cancelled or completed shift', () => {
		for (const status of ['CANCELLED', 'COMPLETED'] as const) {
			expect(
				validateSignup(makeShift({ status }), [], 'user-1', [], {
					allowOverCapacity: true,
				}),
			).toMatchObject({ ok: false });
		}
	});

	it('leaves the volunteer path unchanged when the option is absent', () => {
		// The option is additive: without it every refusal, and the order they
		// are reported in, is exactly what `shifts.signup` saw before.
		const signups = [makeSignup({ userId: 'user-1' })];

		expect(
			validateSignup(makeShift({ status: 'FULL' }), signups, 'user-1'),
		).toMatchObject({ code: 'SHIFT_FULL' });
	});

	it('ignores cancelled/completed shifts in conflict check', () => {
		const cancelled = makeShift({
			id: 'shift-2',
			title: 'Cancelled Overlap',
			startTime: new Date('2026-04-01T10:00:00Z'),
			endTime: new Date('2026-04-01T13:00:00Z'),
			status: 'CANCELLED',
		});
		const result = validateSignup(makeShift(), [], 'user-1', [cancelled]);
		expect(result).toEqual({ ok: true });
	});
});

// ---------------------------------------------------------------------------
// validateShiftTimes
// ---------------------------------------------------------------------------

describe('validateShiftTimes', () => {
	it('accepts valid time range', () => {
		const result = validateShiftTimes(
			new Date('2026-04-01T09:00:00Z'),
			new Date('2026-04-01T12:00:00Z'),
		);
		expect(result).toEqual({ ok: true });
	});

	it('rejects end before start', () => {
		const result = validateShiftTimes(
			new Date('2026-04-01T12:00:00Z'),
			new Date('2026-04-01T09:00:00Z'),
		);
		expect(result).toEqual({
			ok: false,
			reason: expect.stringContaining('after start'),
		});
	});

	it('rejects equal start and end', () => {
		const t = new Date('2026-04-01T09:00:00Z');
		const result = validateShiftTimes(t, t);
		expect(result).toEqual({
			ok: false,
			reason: expect.stringContaining('after start'),
		});
	});

	it('rejects shifts longer than 24 hours', () => {
		const result = validateShiftTimes(
			new Date('2026-04-01T09:00:00Z'),
			new Date('2026-04-02T10:00:00Z'),
		);
		expect(result).toEqual({
			ok: false,
			reason: expect.stringContaining('24 hours'),
		});
	});
});

// ---------------------------------------------------------------------------
// summarizeAttendance
// ---------------------------------------------------------------------------

describe('summarizeAttendance', () => {
	it('returns zeros for empty signups', () => {
		const summary = summarizeAttendance([]);
		expect(summary).toEqual({
			total: 0,
			attended: 0,
			noShow: 0,
			cancelled: 0,
			attendanceRate: 0,
		});
	});

	it('computes correct attendance rate (excludes cancelled)', () => {
		const signups = [
			makeSignup({ id: 's1', userId: 'u1', status: 'ATTENDED' }),
			makeSignup({ id: 's2', userId: 'u2', status: 'ATTENDED' }),
			makeSignup({ id: 's3', userId: 'u3', status: 'NO_SHOW' }),
			makeSignup({ id: 's4', userId: 'u4', status: 'CANCELLED' }),
		];
		const summary = summarizeAttendance(signups);
		expect(summary.total).toBe(4);
		expect(summary.attended).toBe(2);
		expect(summary.noShow).toBe(1);
		expect(summary.cancelled).toBe(1);
		// 2 attended out of 3 non-cancelled = 67%
		expect(summary.attendanceRate).toBe(67);
	});

	it('handles all cancelled', () => {
		const signups = [
			makeSignup({ id: 's1', userId: 'u1', status: 'CANCELLED' }),
			makeSignup({ id: 's2', userId: 'u2', status: 'CANCELLED' }),
		];
		const summary = summarizeAttendance(signups);
		expect(summary.attendanceRate).toBe(0);
	});
});
