/**
 * Unit tests for feedback attribution (issue #127, eng T8) and page-name
 * resolution for the renamed ESG route (eng T9).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePageName } from '@/server/domain/user-feedback';

const { mockCreateFeedback } = vi.hoisted(() => ({
	mockCreateFeedback: vi.fn(),
}));

const txClient = {};
vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: (cb: (tx: typeof txClient) => Promise<unknown>) =>
			cb(txClient),
	},
}));
vi.mock('@/server/repositories/feedbackRepo', () => ({
	createFeedback: (...args: unknown[]) => mockCreateFeedback(...args),
	findFeedbackById: vi.fn(),
	getFeedbackStats: vi.fn(),
	listByUser: vi.fn(),
	listFeedback: vi.fn(),
	updateFeedbackStatus: vi.fn(),
	updateFeedbackReply: vi.fn(),
}));
vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn().mockResolvedValue({ id: 'a1' }),
}));
vi.mock('@/server/lib/admin-recipients', () => ({
	getAdminEmails: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/server/lib/email', () => ({ sendEmail: vi.fn() }));

import { isOrgScopedPage, submitFeedback } from './feedbackService';

beforeEach(() => {
	mockCreateFeedback.mockReset();
	mockCreateFeedback.mockResolvedValue({ id: 'fb1' });
});

describe('isOrgScopedPage', () => {
	it('treats org staff pages as org-scoped', () => {
		expect(isOrgScopedPage('/app/opportunities')).toBe(true);
		expect(isOrgScopedPage('/app/settings/team')).toBe(true);
	});

	it('does NOT attribute company pages to an org (T8 regression)', () => {
		expect(isOrgScopedPage('/app/company')).toBe(false);
		expect(isOrgScopedPage('/app/company/c1')).toBe(false);
		expect(isOrgScopedPage('/app/company/c1/esg')).toBe(false);
	});

	it('keeps existing exemptions', () => {
		expect(isOrgScopedPage('/app/profile')).toBe(false);
		expect(isOrgScopedPage('/app/admin/feedback')).toBe(false);
	});

	it('handles full URLs', () => {
		expect(
			isOrgScopedPage('https://volunteerready.org/app/company/c1/esg'),
		).toBe(false);
	});
});

describe('submitFeedback attribution (service level)', () => {
	const input = {
		mood: 'HAPPY' as const,
		message: 'great',
		pageUrl: '/app/company/c1/esg',
	};

	it('nulls orgId for feedback submitted from a company page', async () => {
		await submitFeedback('u1', 'org1', 'OWNER', input);
		expect(mockCreateFeedback).toHaveBeenCalledWith(
			txClient,
			expect.objectContaining({ orgId: null }),
		);
	});

	it('preserves orgId for feedback from an org-scoped page', async () => {
		await submitFeedback('u1', 'org1', 'OWNER', {
			...input,
			pageUrl: '/app/opportunities',
		});
		expect(mockCreateFeedback).toHaveBeenCalledWith(
			txClient,
			expect.objectContaining({ orgId: 'org1' }),
		);
	});
});

describe('resolvePageName — dynamic company routes', () => {
	it('names the renamed ESG route correctly (not "Esg")', () => {
		expect(resolvePageName('/app/company/abc123/esg')).toBe('ESG Report');
	});

	it('names the company dashboard', () => {
		expect(resolvePageName('/app/company/abc123')).toBe('Company Dashboard');
		expect(resolvePageName('/app/company')).toBe('Company Dashboard');
	});

	it('names the new settings routes', () => {
		expect(resolvePageName('/app/settings')).toBe('Organization Settings');
		expect(resolvePageName('/app/settings/background-checks')).toBe(
			'Background Checks',
		);
	});
});
