import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/lib/case-study-token', () => ({
	verifyConsentToken: vi.fn(() => null),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: { findUnique: vi.fn(async () => null) },
	},
}));

vi.mock('@/server/services/caseStudyService', () => ({
	setOrgConsent: vi.fn(async () => {}),
}));

vi.mock('@/server/lib/html', () => ({
	escapeHtml: vi.fn((s: string) => s),
}));

import { NextRequest } from 'next/server';
import { verifyConsentToken } from '@/server/lib/case-study-token';
import { escapeHtml } from '@/server/lib/html';
import { prisma } from '@/server/repositories/prisma';
import { setOrgConsent } from '@/server/services/caseStudyService';
import { GET, POST } from '../route';

const BASE_URL = 'http://localhost:3005';

function makeGetRequest(token?: string): NextRequest {
	const url = token
		? `${BASE_URL}/api/case-study/consent?token=${encodeURIComponent(token)}`
		: `${BASE_URL}/api/case-study/consent`;
	return new NextRequest(new URL(url));
}

function makePostRequest(token?: string): NextRequest {
	const body = new URLSearchParams();
	if (token) body.set('token', token);
	return new NextRequest(new URL(`${BASE_URL}/api/case-study/consent`), {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
	});
}

describe('GET /api/case-study/consent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('redirects to consent-expired when no token param', async () => {
		const res = await GET(makeGetRequest());
		expect(res.status).toBe(307);
		expect(new URL(res.headers.get('location')!).pathname).toBe(
			'/stories/consent-expired',
		);
	});

	it('redirects to consent-expired when token is invalid/expired', async () => {
		vi.mocked(verifyConsentToken).mockReturnValue(null);

		const res = await GET(makeGetRequest('bad-token'));
		expect(res.status).toBe(307);
		expect(new URL(res.headers.get('location')!).pathname).toBe(
			'/stories/consent-expired',
		);
	});

	it('redirects to consent-expired when org not found', async () => {
		vi.mocked(verifyConsentToken).mockReturnValue('org-123');
		vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

		const res = await GET(makeGetRequest('valid-token'));
		expect(res.status).toBe(307);
		expect(new URL(res.headers.get('location')!).pathname).toBe(
			'/stories/consent-expired',
		);
	});

	it('returns 200 HTML with org name and form when token + org valid', async () => {
		vi.mocked(verifyConsentToken).mockReturnValue('org-123');
		vi.mocked(prisma.organization.findUnique).mockResolvedValue({
			name: 'Helping Hands',
		} as any);

		const res = await GET(makeGetRequest('valid-token'));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');

		const html = await res.text();
		expect(html).toContain('Helping Hands');
		expect(html).toContain('<form method="POST"');
		expect(html).toContain('value="valid-token"');
	});

	it('HTML-escapes the org name in the response', async () => {
		vi.mocked(verifyConsentToken).mockReturnValue('org-xss');
		vi.mocked(prisma.organization.findUnique).mockResolvedValue({
			name: '<script>alert("xss")</script>',
		} as any);
		vi.mocked(escapeHtml).mockImplementation((s: string) =>
			s
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;'),
		);

		const res = await GET(makeGetRequest('valid-token'));
		const html = await res.text();

		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(escapeHtml).toHaveBeenCalled();
	});
});

describe('POST /api/case-study/consent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('redirects 303 to consent-expired when no token in form body', async () => {
		const res = await POST(makePostRequest());
		expect(res.status).toBe(303);
		expect(new URL(res.headers.get('location')!).pathname).toBe(
			'/stories/consent-expired',
		);
	});

	it('redirects 303 to consent-expired when token is invalid', async () => {
		vi.mocked(verifyConsentToken).mockReturnValue(null);

		const res = await POST(makePostRequest('bad-token'));
		expect(res.status).toBe(303);
		expect(new URL(res.headers.get('location')!).pathname).toBe(
			'/stories/consent-expired',
		);
	});

	it('redirects 303 to consent-expired when org not found', async () => {
		vi.mocked(verifyConsentToken).mockReturnValue('org-123');
		vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

		const res = await POST(makePostRequest('valid-token'));
		expect(res.status).toBe(303);
		expect(new URL(res.headers.get('location')!).pathname).toBe(
			'/stories/consent-expired',
		);
	});

	it('calls setOrgConsent and redirects 303 to consent-confirmed with org slug', async () => {
		vi.mocked(verifyConsentToken).mockReturnValue('org-123');
		vi.mocked(prisma.organization.findUnique).mockResolvedValue({
			slug: 'helping-hands',
		} as any);

		const res = await POST(makePostRequest('valid-token'));

		expect(setOrgConsent).toHaveBeenCalledWith('org-123', true);
		expect(res.status).toBe(303);

		const location = new URL(res.headers.get('location')!);
		expect(location.pathname).toBe('/stories/consent-confirmed');
		expect(location.searchParams.get('org')).toBe('helping-hands');
	});

	it('redirects 303 to consent-expired and logs error when setOrgConsent throws', async () => {
		vi.mocked(verifyConsentToken).mockReturnValue('org-123');
		vi.mocked(prisma.organization.findUnique).mockResolvedValue({
			slug: 'helping-hands',
		} as any);
		vi.mocked(setOrgConsent).mockRejectedValue(new Error('DB connection lost'));

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const res = await POST(makePostRequest('valid-token'));

		expect(res.status).toBe(303);
		expect(new URL(res.headers.get('location')!).pathname).toBe(
			'/stories/consent-expired',
		);
		expect(errorSpy).toHaveBeenCalledWith(
			'[consent] Failed to set org consent',
			expect.objectContaining({
				orgId: 'org-123',
				error: 'DB connection lost',
			}),
		);

		errorSpy.mockRestore();
	});
});
