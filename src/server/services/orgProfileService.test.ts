/**
 * Unit tests for orgService.updateOrgProfile (issue #127, decision 4A/5A/8A).
 *
 * Paths covered:
 * 1. Name-only change: org updated, NO slug history row, audit metadata nameOnly
 * 2. Slug change: org updated + OrgSlugHistory row (oldSlug) + audit old/new
 * 3. P2002 (slug taken, incl. concurrent race) → TRPCError CONFLICT
 * 4. Reserved slug rejected before any DB write
 * 5. Invalid slug format rejected before any DB write
 * 6. Unknown org → NOT_FOUND
 * 7. Legacy-invalid slug + name-only change still saves (slug rules apply
 *    only to CHANGED slugs)
 * 8. Current-slug read happens INSIDE the transaction (TOCTOU guard)
 * 9. Non-P2002 errors rethrown unchanged
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/prisma/generated/client';

const mockTxOrgFindUnique = vi.fn();
const mockOrgUpdateMany = vi.fn();
const mockSlugHistoryCreate = vi.fn();
const mockSlugHistoryFindFirst = vi.fn();
const mockSlugHistoryCount = vi.fn();
const mockWriteAuditLogTx = vi.fn();

const txClient = {
	organization: {
		findUnique: (...args: unknown[]) => mockTxOrgFindUnique(...args),
		updateMany: (...args: unknown[]) => mockOrgUpdateMany(...args),
	},
	orgSlugHistory: {
		create: (...args: unknown[]) => mockSlugHistoryCreate(...args),
		findFirst: (...args: unknown[]) => mockSlugHistoryFindFirst(...args),
		count: (...args: unknown[]) => mockSlugHistoryCount(...args),
	},
};

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: (cb: (tx: typeof txClient) => Promise<unknown>) =>
			cb(txClient),
	},
}));

vi.mock('../repositories/orgRepo', () => ({
	findOrgBySlug: vi.fn(),
	getFirstOrgForUser: vi.fn(),
	getOrgProfile: vi.fn(),
	userIsMemberOfOrg: vi.fn(),
}));

vi.mock('../repositories/auditRepo', () => ({
	writeAuditLogTx: (...args: unknown[]) => mockWriteAuditLogTx(...args),
}));

vi.mock('../repositories/screenerQuestionsRepo', () => ({
	seedDefaultQuestions: vi.fn(),
}));

vi.mock('../repositories/sessionRepo', () => ({
	getSessionByToken: vi.fn(),
}));

vi.mock('@/server/lib/admin-alerts', () => ({
	sendNewOrgAlert: vi.fn(),
}));

import { updateOrgProfile } from './orgService';

const CURRENT = { id: 'org1', name: 'Old Name', slug: 'old-slug' };

beforeEach(() => {
	vi.clearAllMocks();
	mockTxOrgFindUnique.mockResolvedValue(CURRENT);
	mockOrgUpdateMany.mockResolvedValue({ count: 1 });
	mockSlugHistoryCreate.mockResolvedValue({ id: 'h1' });
	mockSlugHistoryFindFirst.mockResolvedValue(null);
	mockSlugHistoryCount.mockResolvedValue(0);
	mockWriteAuditLogTx.mockResolvedValue({ id: 'a1' });
});

describe('updateOrgProfile', () => {
	it('updates name only without writing slug history', async () => {
		const result = await updateOrgProfile({
			orgId: 'org1',
			actorId: 'user1',
			name: 'New Name',
			slug: 'old-slug',
		});

		expect(result.name).toBe('New Name');
		expect(mockSlugHistoryCreate).not.toHaveBeenCalled();
		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			txClient,
			expect.objectContaining({
				action: 'ORG_PROFILE_UPDATE',
				metadata: expect.objectContaining({ nameOnly: true }),
			}),
		);
	});

	it('reads the current slug through the transaction client (TOCTOU guard)', async () => {
		await updateOrgProfile({
			orgId: 'org1',
			actorId: 'user1',
			name: 'New Name',
			slug: 'old-slug',
		});
		expect(mockTxOrgFindUnique).toHaveBeenCalledWith({
			where: { id: 'org1' },
			select: { id: true, name: true, slug: true },
		});
	});

	it('records the old slug in history when the slug changes', async () => {
		await updateOrgProfile({
			orgId: 'org1',
			actorId: 'user1',
			name: 'Old Name',
			slug: 'new-slug',
		});

		expect(mockSlugHistoryCreate).toHaveBeenCalledWith({
			data: { orgId: 'org1', oldSlug: 'old-slug' },
		});
		expect(mockWriteAuditLogTx).toHaveBeenCalledWith(
			txClient,
			expect.objectContaining({
				metadata: expect.objectContaining({
					oldSlug: 'old-slug',
					newSlug: 'new-slug',
				}),
			}),
		);
	});

	it('maps P2002 (slug taken) to a CONFLICT TRPCError', async () => {
		mockOrgUpdateMany.mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Unique constraint', {
				code: 'P2002',
				clientVersion: 'test',
			}),
		);

		await expect(
			updateOrgProfile({
				orgId: 'org1',
				actorId: 'user1',
				name: 'Old Name',
				slug: 'taken-slug',
			}),
		).rejects.toMatchObject({ code: 'CONFLICT' });
	});

	it('rejects reserved slugs before writing', async () => {
		await expect(
			updateOrgProfile({
				orgId: 'org1',
				actorId: 'user1',
				name: 'Old Name',
				slug: 'status',
			}),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mockOrgUpdateMany).not.toHaveBeenCalled();
	});

	it('rejects invalid slug formats before writing', async () => {
		await expect(
			updateOrgProfile({
				orgId: 'org1',
				actorId: 'user1',
				name: 'Old Name',
				slug: 'x!',
			}),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mockOrgUpdateMany).not.toHaveBeenCalled();
	});

	it('allows a name-only save when the UNCHANGED slug violates current rules (legacy slug)', async () => {
		mockTxOrgFindUnique.mockResolvedValue({
			id: 'org1',
			name: 'Old Name',
			slug: 'ab', // predates the 3-char minimum
		});
		const result = await updateOrgProfile({
			orgId: 'org1',
			actorId: 'user1',
			name: 'New Name',
			slug: 'ab',
		});
		expect(result.name).toBe('New Name');
		expect(result.slug).toBe('ab');
		expect(mockSlugHistoryCreate).not.toHaveBeenCalled();
	});

	it('maps a lost concurrent-rename race (guarded update count 0) to CONFLICT', async () => {
		mockOrgUpdateMany.mockResolvedValue({ count: 0 });
		await expect(
			updateOrgProfile({
				orgId: 'org1',
				actorId: 'user1',
				name: 'New Name',
				slug: 'new-slug',
			}),
		).rejects.toMatchObject({ code: 'CONFLICT' });
		expect(mockSlugHistoryCreate).not.toHaveBeenCalled();
	});

	it('guards the update on the slug read inside the transaction', async () => {
		await updateOrgProfile({
			orgId: 'org1',
			actorId: 'user1',
			name: 'Old Name',
			slug: 'new-slug',
		});
		expect(mockOrgUpdateMany).toHaveBeenCalledWith({
			where: { id: 'org1', slug: 'old-slug' },
			data: { name: 'Old Name', slug: 'new-slug' },
		});
	});

	it('blocks claiming a slug from ANOTHER org’s history (anti-squatting)', async () => {
		mockSlugHistoryFindFirst.mockResolvedValue({ id: 'h-foreign' });
		await expect(
			updateOrgProfile({
				orgId: 'org1',
				actorId: 'user1',
				name: 'Old Name',
				slug: 'someone-elses-old-slug',
			}),
		).rejects.toMatchObject({ code: 'CONFLICT' });
		expect(mockOrgUpdateMany).not.toHaveBeenCalled();
		expect(mockSlugHistoryFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { oldSlug: 'someone-elses-old-slug', orgId: { not: 'org1' } },
			}),
		);
	});

	it('allows an org to reclaim its OWN old slug (foreign-history query excludes self)', async () => {
		// findFirst filters orgId != self, so own history rows return null
		mockSlugHistoryFindFirst.mockResolvedValue(null);
		const result = await updateOrgProfile({
			orgId: 'org1',
			actorId: 'user1',
			name: 'Old Name',
			slug: 'my-own-old-slug',
		});
		expect(result.slug).toBe('my-own-old-slug');
	});

	it('rate-limits slug changes to 3 per 24h (TOO_MANY_REQUESTS)', async () => {
		mockSlugHistoryCount.mockResolvedValue(3);
		await expect(
			updateOrgProfile({
				orgId: 'org1',
				actorId: 'user1',
				name: 'Old Name',
				slug: 'new-slug',
			}),
		).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
		expect(mockOrgUpdateMany).not.toHaveBeenCalled();
	});

	it('does not consult history or the rate limit for name-only changes', async () => {
		await updateOrgProfile({
			orgId: 'org1',
			actorId: 'user1',
			name: 'New Name',
			slug: 'old-slug',
		});
		expect(mockSlugHistoryFindFirst).not.toHaveBeenCalled();
		expect(mockSlugHistoryCount).not.toHaveBeenCalled();
	});

	it('rethrows non-P2002 errors unchanged (no CONFLICT mapping)', async () => {
		mockOrgUpdateMany.mockRejectedValue(new Error('connection lost'));
		await expect(
			updateOrgProfile({
				orgId: 'org1',
				actorId: 'user1',
				name: 'Old Name',
				slug: 'old-slug',
			}),
		).rejects.toThrow('connection lost');
	});

	it('throws NOT_FOUND (as TRPCError) for an unknown org', async () => {
		mockTxOrgFindUnique.mockResolvedValue(null);
		const attempt = updateOrgProfile({
			orgId: 'nope',
			actorId: 'user1',
			name: 'Name',
			slug: 'valid-slug',
		});
		await expect(attempt).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(
			updateOrgProfile({
				orgId: 'nope',
				actorId: 'user1',
				name: 'Name',
				slug: 'valid-slug',
			}),
		).rejects.toBeInstanceOf(TRPCError);
	});
});
