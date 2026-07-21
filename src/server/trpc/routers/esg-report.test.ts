import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireCompanyAccess, mockGenerateESGReport } = vi.hoisted(() => ({
	mockRequireCompanyAccess: vi.fn(),
	mockGenerateESGReport: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {},
}));

vi.mock('@/server/auth', () => ({
	authOptions: {},
}));

vi.mock('@/server/services/companyAccessService', () => ({
	requireCompanyAccess: mockRequireCompanyAccess,
	CompanyAccessDeniedError: class CompanyAccessDeniedError extends Error {},
}));

vi.mock('@/server/services/employerReportService', () => ({
	generateESGReport: mockGenerateESGReport,
}));

import { t } from '@/server/trpc/init';
import { esgReportRouter } from './esg-report';

const callerFactory = t.createCallerFactory(esgReportRouter);
const COMPANY_ID = 'company-1';
const ACTOR_ID = 'target-1';
const ADMIN_ID = 'admin-1';

function makeCtx(overrides: { userId: string; realUserId: string | null }) {
	return callerFactory({
		session: { user: { id: overrides.userId } },
		realSession: null,
		realUserId: overrides.realUserId,
		impersonation: null,
		orgId: null,
		role: null,
		companyId: null,
		companyRole: null,
		prisma: {} as never,
		sessionToken: null,
		ip: null,
	} as Parameters<typeof callerFactory>[0]);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockRequireCompanyAccess.mockResolvedValue({ role: 'ADMIN' });
	mockGenerateESGReport.mockResolvedValue({ companyId: COMPANY_ID });
});

describe('esgReportRouter.getSummary — impersonatedBy audit trail', () => {
	it('sets impersonatedBy to null when not impersonating (realUserId === actorId)', async () => {
		const caller = makeCtx({ userId: ACTOR_ID, realUserId: ACTOR_ID });

		await caller.getSummary({ companyId: COMPANY_ID });

		expect(mockGenerateESGReport).toHaveBeenCalledWith(
			expect.objectContaining({ actorId: ACTOR_ID, impersonatedBy: null }),
		);
	});

	it('sets impersonatedBy to null when realUserId is missing', async () => {
		const caller = makeCtx({ userId: ACTOR_ID, realUserId: null });

		await caller.getSummary({ companyId: COMPANY_ID });

		expect(mockGenerateESGReport).toHaveBeenCalledWith(
			expect.objectContaining({ actorId: ACTOR_ID, impersonatedBy: null }),
		);
	});

	it('sets impersonatedBy to the real admin id when impersonating (realUserId !== actorId)', async () => {
		const caller = makeCtx({ userId: ACTOR_ID, realUserId: ADMIN_ID });

		await caller.getSummary({ companyId: COMPANY_ID });

		expect(mockGenerateESGReport).toHaveBeenCalledWith(
			expect.objectContaining({ actorId: ACTOR_ID, impersonatedBy: ADMIN_ID }),
		);
	});
});
