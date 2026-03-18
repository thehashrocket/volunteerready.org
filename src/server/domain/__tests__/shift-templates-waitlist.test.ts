import { describe, expect, it } from 'vitest';
import {
	generateShiftDates,
	getNextWaitlistEntry,
	getWaitlistPosition,
	type ShiftData,
	type SignupRecord,
	validateTemplateTime,
	validateWaitlistJoin,
} from '@/server/domain/shift';

// ---------------------------------------------------------------------------
// validateTemplateTime
// ---------------------------------------------------------------------------

describe('validateTemplateTime', () => {
	it('accepts valid time range', () => {
		expect(
			validateTemplateTime({
				startHour: 9,
				startMinute: 0,
				endHour: 12,
				endMinute: 0,
			}),
		).toEqual({ ok: true });
	});

	it('accepts overnight shift (22:00–02:00)', () => {
		expect(
			validateTemplateTime({
				startHour: 22,
				startMinute: 0,
				endHour: 2,
				endMinute: 0,
			}),
		).toEqual({ ok: true });
	});

	it('rejects same start and end time', () => {
		const result = validateTemplateTime({
			startHour: 9,
			startMinute: 0,
			endHour: 9,
			endMinute: 0,
		});
		expect(result.ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// generateShiftDates
// ---------------------------------------------------------------------------

describe('generateShiftDates', () => {
	it('generates correct number of weeks', () => {
		const template = {
			dayOfWeek: 1, // Monday
			startHour: 9,
			startMinute: 0,
			endHour: 12,
			endMinute: 0,
		};
		const startDate = new Date('2026-03-23'); // Monday
		const dates = generateShiftDates(template, 4, startDate);

		expect(dates).toHaveLength(4);
	});

	it('finds next occurrence of dayOfWeek', () => {
		const template = {
			dayOfWeek: 3, // Wednesday
			startHour: 14,
			startMinute: 30,
			endHour: 17,
			endMinute: 0,
		};
		// Start on Monday 2026-03-23
		const startDate = new Date('2026-03-23');
		const dates = generateShiftDates(template, 1, startDate);

		expect(dates).toHaveLength(1);
		// First Wednesday on or after March 23 is March 25
		expect(dates[0].startTime.getDay()).toBe(3);
		expect(dates[0].startTime.getHours()).toBe(14);
		expect(dates[0].startTime.getMinutes()).toBe(30);
		expect(dates[0].endTime.getHours()).toBe(17);
		expect(dates[0].endTime.getMinutes()).toBe(0);
	});

	it('starts on the same day if startDate matches dayOfWeek', () => {
		const template = {
			dayOfWeek: 1, // Monday
			startHour: 9,
			startMinute: 0,
			endHour: 17,
			endMinute: 0,
		};
		const startDate = new Date('2026-03-23'); // Monday
		const dates = generateShiftDates(template, 2, startDate);

		expect(dates[0].startTime.getDate()).toBe(23);
		expect(dates[1].startTime.getDate()).toBe(30);
	});

	it('handles overnight shifts (end next day)', () => {
		const template = {
			dayOfWeek: 5, // Friday
			startHour: 22,
			startMinute: 0,
			endHour: 2,
			endMinute: 0,
		};
		const startDate = new Date('2026-03-27'); // Friday
		const dates = generateShiftDates(template, 1, startDate);

		expect(dates[0].startTime.getHours()).toBe(22);
		expect(dates[0].endTime.getHours()).toBe(2);
		// End should be next day
		expect(dates[0].endTime.getDate()).toBe(dates[0].startTime.getDate() + 1);
	});

	it('generates zero dates for zero weeks', () => {
		const template = {
			dayOfWeek: 1,
			startHour: 9,
			startMinute: 0,
			endHour: 12,
			endMinute: 0,
		};
		expect(generateShiftDates(template, 0, new Date())).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// validateWaitlistJoin
// ---------------------------------------------------------------------------

describe('validateWaitlistJoin', () => {
	const fullShift: ShiftData = {
		id: 'shift-1',
		title: 'Test Shift',
		startTime: new Date('2026-04-01T09:00:00'),
		endTime: new Date('2026-04-01T12:00:00'),
		capacity: 2,
		status: 'FULL',
	};

	const twoConfirmed: SignupRecord[] = [
		{
			id: 's1',
			shiftId: 'shift-1',
			userId: 'user-a',
			status: 'CONFIRMED',
			createdAt: new Date('2026-03-20'),
		},
		{
			id: 's2',
			shiftId: 'shift-1',
			userId: 'user-b',
			status: 'CONFIRMED',
			createdAt: new Date('2026-03-21'),
		},
	];

	it('allows waitlist join for full shift', () => {
		expect(validateWaitlistJoin(fullShift, twoConfirmed, 'user-c')).toEqual({
			ok: true,
		});
	});

	it('rejects waitlist for cancelled shift', () => {
		const cancelled = { ...fullShift, status: 'CANCELLED' as const };
		const result = validateWaitlistJoin(cancelled, twoConfirmed, 'user-c');
		expect(result.ok).toBe(false);
	});

	it('rejects if shift has open spots', () => {
		const open = { ...fullShift, status: 'OPEN' as const, capacity: 10 };
		const result = validateWaitlistJoin(open, twoConfirmed, 'user-c');
		expect(result.ok).toBe(false);
	});

	it('rejects if user already confirmed', () => {
		const result = validateWaitlistJoin(fullShift, twoConfirmed, 'user-a');
		expect(result.ok).toBe(false);
	});

	it('rejects if user already waitlisted', () => {
		const withWaitlist: SignupRecord[] = [
			...twoConfirmed,
			{
				id: 's3',
				shiftId: 'shift-1',
				userId: 'user-c',
				status: 'WAITLISTED',
				createdAt: new Date('2026-03-22'),
			},
		];
		const result = validateWaitlistJoin(fullShift, withWaitlist, 'user-c');
		expect(result.ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getNextWaitlistEntry
// ---------------------------------------------------------------------------

describe('getNextWaitlistEntry', () => {
	it('returns earliest waitlisted signup (FIFO)', () => {
		const signups: SignupRecord[] = [
			{
				id: 's1',
				shiftId: 'shift-1',
				userId: 'user-a',
				status: 'CONFIRMED',
				createdAt: new Date('2026-03-20'),
			},
			{
				id: 's2',
				shiftId: 'shift-1',
				userId: 'user-b',
				status: 'WAITLISTED',
				createdAt: new Date('2026-03-22'),
			},
			{
				id: 's3',
				shiftId: 'shift-1',
				userId: 'user-c',
				status: 'WAITLISTED',
				createdAt: new Date('2026-03-21'),
			},
		];
		const next = getNextWaitlistEntry(signups);
		expect(next?.userId).toBe('user-c'); // earlier createdAt
	});

	it('returns undefined when no waitlist entries', () => {
		const signups: SignupRecord[] = [
			{
				id: 's1',
				shiftId: 'shift-1',
				userId: 'user-a',
				status: 'CONFIRMED',
				createdAt: new Date('2026-03-20'),
			},
		];
		expect(getNextWaitlistEntry(signups)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// getWaitlistPosition
// ---------------------------------------------------------------------------

describe('getWaitlistPosition', () => {
	const signups: SignupRecord[] = [
		{
			id: 's1',
			shiftId: 'shift-1',
			userId: 'user-a',
			status: 'WAITLISTED',
			createdAt: new Date('2026-03-20'),
		},
		{
			id: 's2',
			shiftId: 'shift-1',
			userId: 'user-b',
			status: 'WAITLISTED',
			createdAt: new Date('2026-03-21'),
		},
		{
			id: 's3',
			shiftId: 'shift-1',
			userId: 'user-c',
			status: 'WAITLISTED',
			createdAt: new Date('2026-03-22'),
		},
	];

	it('returns 1-based position', () => {
		expect(getWaitlistPosition(signups, 'user-a')).toBe(1);
		expect(getWaitlistPosition(signups, 'user-b')).toBe(2);
		expect(getWaitlistPosition(signups, 'user-c')).toBe(3);
	});

	it('returns null for non-waitlisted user', () => {
		expect(getWaitlistPosition(signups, 'user-x')).toBeNull();
	});
});
