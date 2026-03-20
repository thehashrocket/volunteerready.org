import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindMany = vi.fn(async () => []);
const mockUpdate = vi.fn(async () => ({}));
const mockFindUnique = vi.fn(async () => null);

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organizationMember: {
			findMany: (...args: unknown[]) => mockFindMany(...args),
			update: (...args: unknown[]) => mockUpdate(...args),
			findUnique: (...args: unknown[]) => mockFindUnique(...args),
		},
	},
}));

import {
	findInactiveMembers,
	findMemberByUserAndOrg,
	markReengagementSent,
	touchMemberActivity,
} from '../reengagement-repo';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reengagement-repo', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('findInactiveMembers', () => {
		it('queries with correct filters for 30d segment', async () => {
			const inactiveBefore = new Date('2026-02-17');
			await findInactiveMembers({
				inactiveBefore,
				segment: '30d',
			});

			expect(mockFindMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						role: { notIn: ['OWNER', 'ADMIN'] },
					}),
					take: 100,
					orderBy: { id: 'asc' },
				}),
			);
		});

		it('passes cursor and skip when cursor is provided', async () => {
			await findInactiveMembers({
				inactiveBefore: new Date(),
				segment: '30d',
				cursor: 'member-50',
			});

			expect(mockFindMany).toHaveBeenCalledWith(
				expect.objectContaining({
					cursor: { id: 'member-50' },
					skip: 1,
				}),
			);
		});
	});

	describe('touchMemberActivity', () => {
		it('updates lastActivityAt and resets segment', async () => {
			await touchMemberActivity('member-1');

			expect(mockUpdate).toHaveBeenCalledWith({
				where: { id: 'member-1' },
				data: {
					lastActivityAt: expect.any(Date),
					lastReengagementSegment: null,
				},
			});
		});
	});

	describe('markReengagementSent', () => {
		it('updates the segment on the member', async () => {
			await markReengagementSent('member-1', '30d');

			expect(mockUpdate).toHaveBeenCalledWith({
				where: { id: 'member-1' },
				data: { lastReengagementSegment: '30d' },
			});
		});
	});

	describe('findMemberByUserAndOrg', () => {
		it('returns member id when found', async () => {
			mockFindUnique.mockResolvedValueOnce({ id: 'member-1' });

			const result = await findMemberByUserAndOrg('user-1', 'org-1');

			expect(result).toBe('member-1');
			expect(mockFindUnique).toHaveBeenCalledWith({
				where: {
					organizationId_userId: {
						organizationId: 'org-1',
						userId: 'user-1',
					},
				},
				select: { id: true },
			});
		});

		it('returns null when not found', async () => {
			mockFindUnique.mockResolvedValueOnce(null);

			const result = await findMemberByUserAndOrg('user-1', 'org-1');

			expect(result).toBeNull();
		});
	});
});
