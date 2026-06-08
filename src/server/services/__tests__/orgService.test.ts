import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Mock modules before importing the service under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/slug', () => ({
	generateSlug: vi.fn((name: string) =>
		name.toLowerCase().replace(/\s+/g, '-'),
	),
	findUniqueSlug: vi.fn(async (base: string) => base),
}));

vi.mock('@/server/repositories/orgRepo', () => ({
	findOrgBySlug: vi.fn(async () => null),
	userIsMemberOfOrg: vi.fn(async () => ({ role: 'OWNER' as const })),
	getFirstOrgForUser: vi.fn(async () => null),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(async () => ({ id: 'audit-1' })),
}));

vi.mock('@/server/repositories/screenerQuestionsRepo', () => ({
	seedDefaultQuestions: vi.fn(async () => undefined),
}));

vi.mock('@/server/repositories/sessionRepo', () => ({
	getSessionByToken: vi.fn(async () => null),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({
				organization: {
					create: vi.fn(async () => ({
						id: 'org-1',
						name: 'Test Org',
						slug: 'test-org',
					})),
				},
				organizationMember: { create: vi.fn(async () => ({})) },
				session: { update: vi.fn(async () => ({})) },
			}),
		),
		session: { update: vi.fn(async () => ({})) },
	},
}));

const mockSendNewOrgAlert = vi.fn(async () => undefined);
vi.mock('@/server/lib/admin-alerts', () => ({
	sendNewOrgAlert: (...args: unknown[]) => mockSendNewOrgAlert(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { prisma } from '@/server/repositories/prisma';
import { createOrg } from '../orgService';

// ---------------------------------------------------------------------------

beforeEach(() => {
	mockSendNewOrgAlert.mockReset();
	mockSendNewOrgAlert.mockResolvedValue(undefined);
});

describe('createOrg', () => {
	it('creates org and returns it', async () => {
		const result = await createOrg({
			name: 'Test Org',
			userId: 'user-1',
			sessionToken: 'tok-1',
		});

		expect(result).toEqual({ id: 'org-1', name: 'Test Org', slug: 'test-org' });
	});

	it('fires sendNewOrgAlert after successful creation', async () => {
		await createOrg({
			name: 'Test Org',
			userId: 'user-1',
			sessionToken: 'tok-1',
		});

		// Allow micro-task queue to flush (fire-and-forget)
		await Promise.resolve();

		expect(mockSendNewOrgAlert).toHaveBeenCalledWith({
			id: 'org-1',
			name: 'Test Org',
			slug: 'test-org',
		});
	});

	it('throws BAD_REQUEST when name produces empty slug', async () => {
		const { generateSlug } = await import('@/lib/slug');
		vi.mocked(generateSlug).mockReturnValueOnce('');

		await expect(
			createOrg({ name: '!!!', userId: 'user-1', sessionToken: 'tok-1' }),
		).rejects.toThrow(TRPCError);
	});

	it('throws CONFLICT on P2002 slug collision', async () => {
		vi.mocked(prisma.$transaction).mockRejectedValueOnce(
			new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
				code: 'P2002',
				clientVersion: '5',
				meta: {},
			}),
		);

		await expect(
			createOrg({ name: 'Test Org', userId: 'user-1', sessionToken: 'tok-1' }),
		).rejects.toThrow(TRPCError);
	});

	it('does not fire alert when transaction fails', async () => {
		vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('DB error'));

		await expect(
			createOrg({ name: 'Test Org', userId: 'user-1', sessionToken: 'tok-1' }),
		).rejects.toThrow();

		await Promise.resolve();
		expect(mockSendNewOrgAlert).not.toHaveBeenCalled();
	});
});
