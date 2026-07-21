import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockResolveEffectiveUserId,
	mockRequireCompanyAccess,
	mockGenerateESGCsvExport,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockResolveEffectiveUserId: vi.fn(),
	mockRequireCompanyAccess: vi.fn(),
	mockGenerateESGCsvExport: vi.fn(),
}));

vi.mock('next-auth', () => ({
	getServerSession: mockGetServerSession,
}));

vi.mock('@/server/auth', () => ({
	authOptions: {},
}));

vi.mock('@/server/lib/impersonation-context', () => ({
	resolveEffectiveUserId: mockResolveEffectiveUserId,
}));

vi.mock('@/server/services/companyAccessService', () => {
	class CompanyAccessDeniedError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'CompanyAccessDeniedError';
		}
	}
	return {
		requireCompanyAccess: mockRequireCompanyAccess,
		CompanyAccessDeniedError,
	};
});

vi.mock('@/server/services/employerReportService', () => ({
	generateESGCsvExport: mockGenerateESGCsvExport,
}));

import { CompanyAccessDeniedError } from '@/server/services/companyAccessService';
import { GET } from '../route';

const BASE_URL = 'http://localhost:3005';
const ADMIN_ID = 'admin-1';
const TARGET_ID = 'target-1';
const TARGET_COMPANY_ID = 'company-target';

function makeRequest({
	companyId,
	from,
	to,
	cookieValue,
}: {
	companyId?: string | null;
	from?: string;
	to?: string;
	cookieValue?: string;
} = {}): NextRequest {
	const url = new URL(`${BASE_URL}/api/esg-report/csv`);
	if (companyId) url.searchParams.set('companyId', companyId);
	if (from) url.searchParams.set('from', from);
	if (to) url.searchParams.set('to', to);

	return new NextRequest(url, {
		headers: cookieValue
			? { cookie: `impersonation-session-id=${cookieValue}` }
			: undefined,
	});
}

function notImpersonating(userId: string | null) {
	return {
		effectiveUserId: userId,
		isImpersonating: false,
		impersonatedBy: null,
		impersonationSessionId: null,
		expiresAt: null,
	};
}

function impersonating(targetId: string) {
	return {
		effectiveUserId: targetId,
		isImpersonating: true,
		impersonatedBy: ADMIN_ID,
		impersonationSessionId: 'sess-1',
		expiresAt: new Date('2026-07-20T21:00:00Z'),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/esg-report/csv', () => {
	it('returns 401 when there is no session', async () => {
		mockGetServerSession.mockResolvedValueOnce(null);
		mockResolveEffectiveUserId.mockResolvedValueOnce(notImpersonating(null));

		const res = await GET(makeRequest({ companyId: 'company-1' }));

		expect(res.status).toBe(401);
		expect(mockRequireCompanyAccess).not.toHaveBeenCalled();
		expect(mockGenerateESGCsvExport).not.toHaveBeenCalled();
	});

	it('returns 400 when companyId is missing', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);

		const res = await GET(makeRequest({}));

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe('Invalid parameters');
		expect(mockRequireCompanyAccess).not.toHaveBeenCalled();
	});

	it('returns 400 when the date range is inverted', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);

		const res = await GET(
			makeRequest({
				companyId: 'company-1',
				from: '2026-07-20',
				to: '2026-01-01',
			}),
		);

		expect(res.status).toBe(400);
	});

	it('returns 403 when the effective user lacks company access', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockRequireCompanyAccess.mockRejectedValueOnce(
			new CompanyAccessDeniedError('Not a member of this company'),
		);

		const res = await GET(makeRequest({ companyId: 'company-1' }));

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({
			error: 'Not a member of this company',
		});
		expect(mockGenerateESGCsvExport).not.toHaveBeenCalled();
	});

	it('happy path: returns the CSV for the real (non-impersonating) user', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockRequireCompanyAccess.mockResolvedValueOnce({ role: 'ADMIN' });
		mockGenerateESGCsvExport.mockResolvedValueOnce(
			'org,hours\nHelping Hands,10',
		);

		const res = await GET(makeRequest({ companyId: 'company-1' }));

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
		expect(await res.text()).toBe('org,hours\nHelping Hands,10');
		expect(mockRequireCompanyAccess).toHaveBeenCalledWith({
			userId: ADMIN_ID,
			companyId: 'company-1',
			minRole: 'ADMIN',
			minPlanTier: 'PRO',
		});
	});

	it('cross-company impersonation: checks access and exports for the impersonated target, not the admin', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockRequireCompanyAccess.mockResolvedValueOnce({ role: 'ADMIN' });
		mockGenerateESGCsvExport.mockResolvedValueOnce('org,hours\nOther Org,5');

		const res = await GET(makeRequest({ companyId: TARGET_COMPANY_ID }));

		expect(res.status).toBe(200);
		// Company access is checked against the target user, not the real admin —
		// this is the fix: previously the raw admin session would have been used
		// here regardless of impersonation, silently ignoring the target's access.
		expect(mockRequireCompanyAccess).toHaveBeenCalledWith({
			userId: TARGET_ID,
			companyId: TARGET_COMPANY_ID,
			minRole: 'ADMIN',
			minPlanTier: 'PRO',
		});
	});

	it('audit actorId: tags the export with actorId=target and impersonatedBy=admin under impersonation', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(impersonating(TARGET_ID));
		mockRequireCompanyAccess.mockResolvedValueOnce({ role: 'ADMIN' });
		mockGenerateESGCsvExport.mockResolvedValueOnce('csv');

		await GET(makeRequest({ companyId: TARGET_COMPANY_ID }));

		expect(mockGenerateESGCsvExport).toHaveBeenCalledWith({
			companyId: TARGET_COMPANY_ID,
			actorId: TARGET_ID,
			impersonatedBy: ADMIN_ID,
			dateRange: { from: null, to: null },
		});
	});

	it('audit actorId: impersonatedBy is null when not impersonating', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockRequireCompanyAccess.mockResolvedValueOnce({ role: 'ADMIN' });
		mockGenerateESGCsvExport.mockResolvedValueOnce('csv');

		await GET(makeRequest({ companyId: 'company-1' }));

		expect(mockGenerateESGCsvExport).toHaveBeenCalledWith({
			companyId: 'company-1',
			actorId: ADMIN_ID,
			impersonatedBy: null,
			dateRange: { from: null, to: null },
		});
	});

	it('passes the parsed impersonation cookie value to resolveEffectiveUserId', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockRequireCompanyAccess.mockResolvedValueOnce({ role: 'ADMIN' });
		mockGenerateESGCsvExport.mockResolvedValueOnce('csv');

		await GET(makeRequest({ companyId: 'company-1', cookieValue: 'sess-1' }));

		expect(mockResolveEffectiveUserId).toHaveBeenCalledWith(ADMIN_ID, 'sess-1');
	});
});
