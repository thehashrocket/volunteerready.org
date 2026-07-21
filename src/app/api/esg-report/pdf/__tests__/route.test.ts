import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetServerSession,
	mockResolveEffectiveUserId,
	mockRequireCompanyAccess,
	mockGenerateESGPdfExport,
} = vi.hoisted(() => ({
	mockGetServerSession: vi.fn(),
	mockResolveEffectiveUserId: vi.fn(),
	mockRequireCompanyAccess: vi.fn(),
	mockGenerateESGPdfExport: vi.fn(),
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
	generateESGPdfExport: mockGenerateESGPdfExport,
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
	const url = new URL(`${BASE_URL}/api/esg-report/pdf`);
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

describe('GET /api/esg-report/pdf', () => {
	it('returns 401 when there is no session', async () => {
		mockGetServerSession.mockResolvedValueOnce(null);
		mockResolveEffectiveUserId.mockResolvedValueOnce(notImpersonating(null));

		const res = await GET(makeRequest({ companyId: 'company-1' }));

		expect(res.status).toBe(401);
		expect(mockRequireCompanyAccess).not.toHaveBeenCalled();
		expect(mockGenerateESGPdfExport).not.toHaveBeenCalled();
	});

	it('returns 400 when companyId is missing', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);

		const res = await GET(makeRequest({}));

		expect(res.status).toBe(400);
		expect(mockRequireCompanyAccess).not.toHaveBeenCalled();
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
		expect(mockGenerateESGPdfExport).not.toHaveBeenCalled();
	});

	it('returns 500 without leaking internals when PDF generation fails', async () => {
		const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockRequireCompanyAccess.mockResolvedValueOnce({ role: 'ADMIN' });
		mockGenerateESGPdfExport.mockRejectedValueOnce(
			new Error('react-pdf: renderer crashed'),
		);

		const res = await GET(makeRequest({ companyId: 'company-1' }));

		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe('Failed to generate PDF report');
		expect(body.error).not.toMatch(/react-pdf|renderer crashed/i);
		consoleErr.mockRestore();
	});

	it('happy path: returns the PDF for the real (non-impersonating) user', async () => {
		mockGetServerSession.mockResolvedValueOnce({ user: { id: ADMIN_ID } });
		mockResolveEffectiveUserId.mockResolvedValueOnce(
			notImpersonating(ADMIN_ID),
		);
		mockRequireCompanyAccess.mockResolvedValueOnce({ role: 'ADMIN' });
		mockGenerateESGPdfExport.mockResolvedValueOnce(Buffer.from('%PDF-1.4'));

		const res = await GET(makeRequest({ companyId: 'company-1' }));

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/pdf');
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
		mockGenerateESGPdfExport.mockResolvedValueOnce(Buffer.from('%PDF-1.4'));

		const res = await GET(makeRequest({ companyId: TARGET_COMPANY_ID }));

		expect(res.status).toBe(200);
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
		mockGenerateESGPdfExport.mockResolvedValueOnce(Buffer.from('%PDF-1.4'));

		await GET(makeRequest({ companyId: TARGET_COMPANY_ID }));

		expect(mockGenerateESGPdfExport).toHaveBeenCalledWith({
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
		mockGenerateESGPdfExport.mockResolvedValueOnce(Buffer.from('%PDF-1.4'));

		await GET(makeRequest({ companyId: 'company-1' }));

		expect(mockGenerateESGPdfExport).toHaveBeenCalledWith({
			companyId: 'company-1',
			actorId: ADMIN_ID,
			impersonatedBy: null,
			dateRange: { from: null, to: null },
		});
	});
});
