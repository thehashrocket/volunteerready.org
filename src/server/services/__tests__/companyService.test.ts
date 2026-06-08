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

vi.mock('@/server/repositories/companyRepo', () => ({
	findCompanyBySlug: vi.fn(async () => null), // slug is always available
	createCompanyWithOwnerTx: vi.fn(
		async (_tx: unknown, opts: { name: string; slug: string }) => ({
			id: 'company-1',
			slug: opts.slug,
		}),
	),
	getCompanyMembership: vi.fn(async () => ({ role: 'MEMBER' as const })),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(async () => ({ id: 'audit-1' })),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({ session: { update: vi.fn(async () => ({})) } }),
		),
		session: {
			update: vi.fn(async () => ({})),
		},
		companyAccount: {
			findUnique: vi.fn(async () => ({ name: 'Test Co' })),
		},
		user: {
			findFirst: vi.fn(async () => null),
		},
		companyMember: {
			findUnique: vi.fn(async () => null),
		},
		companyInvitation: {
			update: vi.fn(async () => ({})),
		},
		companyNonprofitLink: {
			findUnique: vi.fn(async () => ({ id: 'link-1' })),
		},
	},
}));

vi.mock('resend', () => ({
	// biome-ignore lint/complexity/useArrowFunction: must be a regular function so `new Resend()` works as a constructor
	Resend: vi.fn(function () {
		return { emails: { send: vi.fn(async () => ({})) } };
	}),
}));

const mockSendNewCompanyAlert = vi.fn(async () => undefined);
vi.mock('@/server/lib/admin-alerts', () => ({
	sendNewCompanyAlert: (...args: unknown[]) => mockSendNewCompanyAlert(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

import * as companyRepo from '@/server/repositories/companyRepo';
import { prisma } from '@/server/repositories/prisma';
import { createCompany, switchCompanyForSession } from '../companyService';

beforeEach(() => {
	mockSendNewCompanyAlert.mockReset();
	mockSendNewCompanyAlert.mockResolvedValue(undefined);
});

describe('createCompany', () => {
	it('creates company and returns it', async () => {
		const result = await createCompany({
			name: 'Test Company',
			userId: 'user-1',
			sessionToken: 'tok-1',
		});

		expect(result).toEqual({ id: 'company-1', slug: 'test-company' });
	});

	it('fires sendNewCompanyAlert after successful creation', async () => {
		await createCompany({
			name: 'Test Company',
			userId: 'user-1',
			sessionToken: 'tok-1',
		});

		await Promise.resolve();

		expect(mockSendNewCompanyAlert).toHaveBeenCalledWith({
			id: 'company-1',
			name: 'Test Company',
			slug: 'test-company',
		});
	});

	it('does not fire alert when transaction fails', async () => {
		vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('DB error'));

		await expect(
			createCompany({
				name: 'Test Co',
				userId: 'user-1',
				sessionToken: 'tok-1',
			}),
		).rejects.toThrow();

		await Promise.resolve();
		expect(mockSendNewCompanyAlert).not.toHaveBeenCalled();
	});

	it('throws BAD_REQUEST when name produces empty slug', async () => {
		const { generateSlug } = await import('@/lib/slug');
		vi.mocked(generateSlug).mockReturnValueOnce('');

		await expect(
			createCompany({ name: '!!!', userId: 'user-1', sessionToken: 'tok-1' }),
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
			createCompany({
				name: 'Test Co',
				userId: 'user-1',
				sessionToken: 'tok-1',
			}),
		).rejects.toThrow(TRPCError);
	});
});

describe('switchCompanyForSession', () => {
	it('updates session on valid membership', async () => {
		vi.mocked(companyRepo.getCompanyMembership).mockResolvedValueOnce({
			role: 'ADMIN',
		});

		const result = await switchCompanyForSession({
			userId: 'user-1',
			sessionToken: 'tok-1',
			targetCompanyId: 'company-1',
		});

		expect(result.companyId).toBe('company-1');
		expect(result.role).toBe('ADMIN');
	});

	it('throws FORBIDDEN when user is not a member', async () => {
		vi.mocked(companyRepo.getCompanyMembership).mockResolvedValueOnce(null);

		await expect(
			switchCompanyForSession({
				userId: 'user-1',
				sessionToken: 'tok-1',
				targetCompanyId: 'company-other',
			}),
		).rejects.toThrow(TRPCError);
	});
});
