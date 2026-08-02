import { describe, expect, it, vi } from 'vitest';

// Both refusals under test fire BEFORE any database work, so these stubs only
// have to satisfy module load.
vi.mock('@/server/repositories/prisma', () => ({ prisma: {} }));
vi.mock('@/server/lib/email', () => ({ sendEmail: vi.fn() }));
vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(),
}));
vi.mock('@/server/repositories/shiftRepo', () => ({
	createShift: vi.fn(),
	deleteShift: vi.fn(),
	getShiftById: vi.fn(),
	getShiftWithSignups: vi.fn(),
	listShiftsByOpportunity: vi.fn(),
	listShiftsByOrg: vi.fn(),
	listUpcomingShiftsForOrg: vi.fn(),
	updateShift: vi.fn(),
}));
vi.mock('@/server/services/notificationService', () => ({
	tryNotify: vi.fn(),
}));
vi.mock('@/server/services/shiftAccessService', () => ({
	isOrgShift: vi.fn(),
	requireOrgOpportunity: vi.fn(),
	requireOrgShift: vi.fn().mockResolvedValue({ id: 'shift-1' }),
}));

import { isClientSafeErrorCode } from '@/server/domain/error-disclosure';
import { createNewShift, updateExistingShift } from '../shiftService';

/**
 * `validateShiftTimes` returns hand-authored copy — "End time must be after
 * start time.", "Shift duration cannot exceed 24 hours." — which is the entire
 * value of the refusal: a coordinator entering a bad time needs to read WHICH
 * rule they hit to fix the form.
 *
 * Those two throws were plain `Error`s until T37. tRPC maps a plain Error to
 * INTERNAL_SERVER_ERROR and `errorFormatter` redacts it, so the coordinator
 * would have got "Something went wrong. Please try again." and no way to tell
 * what was wrong with their times.
 *
 * This file exists because nothing else covers `shiftService`'s validation at
 * all — the closest suite mocks the service out entirely and tests the domain
 * function `validateShiftTimes` in isolation, which cannot see how the service
 * reports it.
 */
const START = new Date('2026-09-01T18:00:00Z');
const END_BEFORE_START = new Date('2026-09-01T09:00:00Z');

describe('shiftService time-validation refusals carry an allowlisted code', () => {
	it('createNewShift refuses with BAD_REQUEST and states the reason', async () => {
		await expect(
			createNewShift(
				{
					orgId: 'org-1',
					title: 'Backwards',
					startTime: START,
					endTime: END_BEFORE_START,
					capacity: 5,
				} as Parameters<typeof createNewShift>[0],
				'actor-1',
			),
		).rejects.toMatchObject({
			code: 'BAD_REQUEST',
			message: expect.stringContaining('End time must be after start time'),
		});
	});

	it('updateExistingShift refuses with BAD_REQUEST too', async () => {
		// The same rule, a second callsite. Converting only the create path is
		// the shape of miss this pins — the edit form is where a coordinator is
		// most likely to produce an invalid range.
		await expect(
			updateExistingShift(
				{
					id: 'shift-1',
					startTime: START,
					endTime: END_BEFORE_START,
				} as Parameters<typeof updateExistingShift>[0],
				'org-1',
				'actor-1',
			),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('BAD_REQUEST is in the shared allowlist, so the reason actually ships', () => {
		// The code is only worth asserting because the formatter lets it through.
		expect(isClientSafeErrorCode('BAD_REQUEST')).toBe(true);
	});
});
