/**
 * Unit tests for marketplaceService.ts — toggleInterest (T2).
 *
 * Tests 7 paths:
 * 1. Toggle on: creates interest + upserts UserMarketplacePreference WEEKLY
 * 2. Toggle off: deletes existing interest
 * 3. P2002 on create (concurrent create) → idempotently returns interested: true
 * 4. P2025 on delete (concurrent delete) → idempotently returns interested: false
 * 5. Opportunity not found → returns interested: false (no-op)
 * 6. getMyInterests returns filtered opportunity IDs
 * 7. Upsert is NOT called on toggle-off
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOppFindFirst = vi.fn();
const mockInterestFindUnique = vi.fn();
const mockInterestCreate = vi.fn();
const mockInterestDelete = vi.fn();
const mockInterestFindMany = vi.fn();
const mockPrefUpsert = vi.fn();

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		volunteerOpportunity: {
			findFirst: (...args: unknown[]) => mockOppFindFirst(...args),
		},
		opportunityInterest: {
			findUnique: (...args: unknown[]) => mockInterestFindUnique(...args),
			create: (...args: unknown[]) => mockInterestCreate(...args),
			delete: (...args: unknown[]) => mockInterestDelete(...args),
			findMany: (...args: unknown[]) => mockInterestFindMany(...args),
		},
		userMarketplacePreference: {
			upsert: (...args: unknown[]) => mockPrefUpsert(...args),
		},
	},
}));

// Prisma error class factory
function makePrismaError(code: string) {
	const err = new Error('Prisma error') as Error & { code: string };
	err.code = code;
	// Simulate PrismaClientKnownRequestError instanceof check
	Object.setPrototypeOf(err, {
		constructor: { name: 'PrismaClientKnownRequestError' },
	});
	return err;
}

import { getMyInterests, toggleInterest } from './marketplaceService';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('toggleInterest', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOppFindFirst.mockResolvedValue({ id: 'opp-1' });
		mockInterestFindUnique.mockResolvedValue(null);
		mockInterestCreate.mockResolvedValue({ id: 'interest-1' });
		mockInterestDelete.mockResolvedValue({ id: 'interest-1' });
		mockPrefUpsert.mockResolvedValue({});
	});

	it('creates interest and upserts WEEKLY preference on first toggle-on', async () => {
		const result = await toggleInterest('user-1', 'opp-1');

		expect(result).toEqual({ interested: true });
		expect(mockInterestCreate).toHaveBeenCalledWith({
			data: { userId: 'user-1', opportunityId: 'opp-1' },
		});
		expect(mockPrefUpsert).toHaveBeenCalledWith({
			where: { userId: 'user-1' },
			create: { userId: 'user-1', digestFrequency: 'WEEKLY' },
			update: {},
		});
	});

	it('deletes existing interest on toggle-off', async () => {
		mockInterestFindUnique.mockResolvedValue({ id: 'interest-1' });

		const result = await toggleInterest('user-1', 'opp-1');

		expect(result).toEqual({ interested: false });
		expect(mockInterestDelete).toHaveBeenCalled();
		expect(mockInterestCreate).not.toHaveBeenCalled();
	});

	it('does NOT upsert preference on toggle-off', async () => {
		mockInterestFindUnique.mockResolvedValue({ id: 'interest-1' });

		await toggleInterest('user-1', 'opp-1');

		expect(mockPrefUpsert).not.toHaveBeenCalled();
	});

	it('handles P2002 on create (concurrent create) — idempotently returns interested: true', async () => {
		const { Prisma } = await import('@/prisma/generated/client');
		const p2002 = new Prisma.PrismaClientKnownRequestError(
			'Unique constraint',
			{
				code: 'P2002',
				clientVersion: '5',
			},
		);
		mockInterestCreate.mockRejectedValue(p2002);

		const result = await toggleInterest('user-1', 'opp-1');

		expect(result).toEqual({ interested: true });
	});

	it('handles P2025 on delete (concurrent delete) — idempotently returns interested: false', async () => {
		mockInterestFindUnique.mockResolvedValue({ id: 'interest-1' });

		const { Prisma } = await import('@/prisma/generated/client');
		const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
			code: 'P2025',
			clientVersion: '5',
		});
		mockInterestDelete.mockRejectedValue(p2025);

		const result = await toggleInterest('user-1', 'opp-1');

		expect(result).toEqual({ interested: false });
	});

	it('returns interested: false when opportunity is not on marketplace', async () => {
		mockOppFindFirst.mockResolvedValue(null);

		const result = await toggleInterest('user-1', 'opp-not-visible');

		expect(result).toEqual({ interested: false });
		expect(mockInterestCreate).not.toHaveBeenCalled();
		expect(mockPrefUpsert).not.toHaveBeenCalled();
	});

	it('rethrows non-P2002 errors on create', async () => {
		mockInterestCreate.mockRejectedValue(new Error('DB connection lost'));

		await expect(toggleInterest('user-1', 'opp-1')).rejects.toThrow(
			'DB connection lost',
		);
	});
});

describe('getMyInterests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns opportunityIds for the user', async () => {
		mockInterestFindMany.mockResolvedValue([
			{ opportunityId: 'opp-1' },
			{ opportunityId: 'opp-2' },
		]);

		const result = await getMyInterests('user-1');

		expect(result).toEqual(['opp-1', 'opp-2']);
		expect(mockInterestFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ userId: 'user-1' }),
			}),
		);
	});

	it('returns empty array when user has no interests', async () => {
		mockInterestFindMany.mockResolvedValue([]);

		const result = await getMyInterests('user-1');

		expect(result).toEqual([]);
	});
});
