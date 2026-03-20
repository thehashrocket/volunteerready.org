import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindMany = vi.fn(async () => []);

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		shift: {
			findMany: (...args: unknown[]) => mockFindMany(...args),
		},
	},
}));

const mockCompleteShift = vi.fn(async () => ({}));
vi.mock('@/server/services/shiftService', () => ({
	completeShift: (...args: unknown[]) => mockCompleteShift(...args),
}));

import { autoCloseExpiredShifts } from '../shift-auto-close-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShift(
	overrides: Partial<{ id: string; orgId: string; title: string }> = {},
) {
	return {
		id: overrides.id ?? 'shift-1',
		orgId: overrides.orgId ?? 'org-1',
		title: overrides.title ?? 'Beach Cleanup',
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('autoCloseExpiredShifts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns zero counts when no expired shifts exist', async () => {
		mockFindMany.mockResolvedValueOnce([]);

		const result = await autoCloseExpiredShifts();

		expect(result).toEqual({ processed: 0, completed: 0, errors: 0 });
		expect(mockCompleteShift).not.toHaveBeenCalled();
	});

	it('queries for OPEN and FULL shifts with endTime in the past', async () => {
		mockFindMany.mockResolvedValueOnce([]);

		await autoCloseExpiredShifts();

		expect(mockFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					status: { in: ['OPEN', 'FULL'] },
					endTime: { lt: expect.any(Date) },
				},
				select: { id: true, orgId: true, title: true },
				take: 200,
			}),
		);
	});

	it('completes each expired shift with null actorId', async () => {
		const shifts = [
			makeShift({ id: 'shift-1', orgId: 'org-1' }),
			makeShift({ id: 'shift-2', orgId: 'org-2' }),
		];
		mockFindMany.mockResolvedValueOnce(shifts);
		mockCompleteShift.mockResolvedValue({});

		const result = await autoCloseExpiredShifts();

		expect(result).toEqual({ processed: 2, completed: 2, errors: 0 });
		expect(mockCompleteShift).toHaveBeenCalledTimes(2);
		expect(mockCompleteShift).toHaveBeenCalledWith('shift-1', 'org-1', null);
		expect(mockCompleteShift).toHaveBeenCalledWith('shift-2', 'org-2', null);
	});

	it('handles P2025 race condition gracefully', async () => {
		mockFindMany.mockResolvedValueOnce([makeShift()]);
		mockCompleteShift.mockRejectedValueOnce({ code: 'P2025' });

		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await autoCloseExpiredShifts();

		expect(result).toEqual({ processed: 1, completed: 0, errors: 1 });
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('already modified'),
		);
		consoleSpy.mockRestore();
	});

	it('isolates errors per shift — one failure does not block others', async () => {
		const shifts = [
			makeShift({ id: 'shift-ok', orgId: 'org-1', title: 'Good Shift' }),
			makeShift({ id: 'shift-fail', orgId: 'org-1', title: 'Bad Shift' }),
			makeShift({ id: 'shift-ok2', orgId: 'org-2', title: 'Another Good' }),
		];
		mockFindMany.mockResolvedValueOnce(shifts);
		mockCompleteShift
			.mockResolvedValueOnce({}) // shift-ok succeeds
			.mockRejectedValueOnce(new Error('DB timeout')) // shift-fail fails
			.mockResolvedValueOnce({}); // shift-ok2 succeeds

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await autoCloseExpiredShifts();

		expect(result).toEqual({ processed: 3, completed: 2, errors: 1 });
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to close shift shift-fail'),
			expect.any(Error),
		);
		consoleSpy.mockRestore();
	});
});
