import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanTier } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Mock module dependencies pulled in transitively by init.ts
// ---------------------------------------------------------------------------

vi.mock('@/server/repositories/orgRepo', () => ({
	getOrgPlanTier: vi.fn(),
	findOrgById: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findUnique: vi.fn().mockResolvedValue({ suspendedAt: null }),
		},
	},
}));

vi.mock('next-auth', () => ({
	getServerSession: vi.fn(),
}));

vi.mock('@/server/auth', () => ({
	authOptions: {},
}));

// ---------------------------------------------------------------------------
// Imports — must come AFTER vi.mock() calls (vitest hoists mocks)
// ---------------------------------------------------------------------------

import * as orgRepo from '@/server/repositories/orgRepo';
import { createTRPCRouter, planTierProcedure, t } from '@/server/trpc/init';

// ---------------------------------------------------------------------------
// Build a minimal test router with STARTER-gated and PRO-gated endpoints
// ---------------------------------------------------------------------------

const testRouter = createTRPCRouter({
	starterGated: planTierProcedure('STARTER').query(() => 'ok-starter' as const),
	proGated: planTierProcedure('PRO').query(() => 'ok-pro' as const),
});

const callerFactory = t.createCallerFactory(testRouter);

/**
 * Build a caller with the given orgId injected directly into the context,
 * bypassing the normal NextAuth session flow.
 */
function makeCaller(orgId: string | null): ReturnType<typeof callerFactory> {
	return callerFactory({
		session: { user: { id: 'user-1' } } as never,
		orgId,
		role: null,
		companyId: null,
		companyRole: null,
		prisma: {} as never,
		sessionToken: null,
	});
}

describe('planTierProcedure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws FORBIDDEN when FREE org accesses a STARTER-gated procedure', async () => {
		vi.mocked(orgRepo.getOrgPlanTier).mockResolvedValueOnce('FREE' as PlanTier);
		const caller = makeCaller('org-1');

		await expect(caller.starterGated()).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});
	});

	it('passes when STARTER org accesses a STARTER-gated procedure', async () => {
		vi.mocked(orgRepo.getOrgPlanTier).mockResolvedValueOnce(
			'STARTER' as PlanTier,
		);
		const caller = makeCaller('org-1');

		await expect(caller.starterGated()).resolves.toBe('ok-starter');
	});

	it('throws FORBIDDEN when STARTER org accesses a PRO-gated procedure', async () => {
		vi.mocked(orgRepo.getOrgPlanTier).mockResolvedValueOnce(
			'STARTER' as PlanTier,
		);
		const caller = makeCaller('org-1');

		await expect(caller.proGated()).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});
	});

	it('passes when PRO org accesses a PRO-gated procedure', async () => {
		vi.mocked(orgRepo.getOrgPlanTier).mockResolvedValueOnce('PRO' as PlanTier);
		const caller = makeCaller('org-1');

		await expect(caller.proGated()).resolves.toBe('ok-pro');
	});

	it('throws FORBIDDEN when no orgId is in session (orgProcedure guard)', async () => {
		const caller = makeCaller(null);

		// orgProcedure throws FORBIDDEN before getOrgPlanTier is even called
		await expect(caller.starterGated()).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});
		expect(orgRepo.getOrgPlanTier).not.toHaveBeenCalled();
	});
});
