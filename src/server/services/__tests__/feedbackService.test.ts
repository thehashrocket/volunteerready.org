import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock modules before importing the service under test
// ---------------------------------------------------------------------------

vi.mock('@/server/repositories/feedbackRepo', () => ({
	createFeedback: vi.fn(async (_tx: unknown, data: { mood: string }) => ({
		id: 'fb-1',
		mood: data.mood,
		status: 'NEW',
	})),
	findFeedbackById: vi.fn(async () => ({
		id: 'fb-1',
		message: 'Original message',
		pageName: 'Dashboard',
		user: { email: 'user@test.com', name: 'Jane' },
	})),
	listFeedback: vi.fn(async () => ({
		items: [],
		total: 0,
		page: 1,
		pageSize: 20,
	})),
	listByUser: vi.fn(async () => []),
	updateFeedbackStatus: vi.fn(
		async (_tx: unknown, id: string, status: string) => ({
			id,
			status,
			resolvedAt: status === 'RESOLVED' ? new Date() : null,
			resolvedBy: status === 'RESOLVED' ? 'admin-1' : null,
		}),
	),
	updateFeedbackReply: vi.fn(async (_tx: unknown, id: string, msg: string) => ({
		id,
		replyMessage: msg,
		repliedAt: new Date(),
	})),
	getFeedbackStats: vi.fn(async () => ({ newCount: 0 })),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(async () => ({ id: 'audit-1' })),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({}),
		),
		user: {
			findMany: vi.fn(async () => [{ email: 'admin@test.com' }]),
		},
	},
}));

vi.mock('@/server/lib/email', () => ({
	sendEmail: vi.fn(async () => true),
}));

vi.mock('@/server/lib/html', () => ({
	escapeHtml: vi.fn((s: string) => s),
}));

vi.mock('resend', () => ({
	// biome-ignore lint/complexity/useArrowFunction: must be a regular function so `new Resend()` works as a constructor
	Resend: vi.fn(function () {
		return { emails: { send: vi.fn(async () => ({})) } };
	}),
}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

import { sendEmail } from '@/server/lib/email';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import * as feedbackRepo from '@/server/repositories/feedbackRepo';
import { prisma } from '@/server/repositories/prisma';
import {
	getMyFeedback,
	replyToFeedback,
	submitFeedback,
	updateFeedbackStatus,
} from '../feedbackService';

describe('submitFeedback', () => {
	it('creates record and audit log via transaction', async () => {
		await submitFeedback('user-1', 'org-1', 'ADMIN', {
			mood: 'HAPPY',
			message: 'Great app!',
			pageUrl: '/app',
		});

		expect(prisma.$transaction).toHaveBeenCalled();
		expect(feedbackRepo.createFeedback).toHaveBeenCalled();
		expect(writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'feedback.submit' }),
		);
	});

	it('resolves pageName from URL', async () => {
		await submitFeedback('user-1', 'org-1', 'ADMIN', {
			mood: 'NEUTRAL',
			message: 'Test',
			pageUrl: '/app/shifts',
		});

		expect(feedbackRepo.createFeedback).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ pageName: 'Shift Management' }),
		);
	});

	it('sets orgId=null for non-org-scoped pages', async () => {
		await submitFeedback('user-1', 'org-1', 'VOLUNTEER', {
			mood: 'IDEA',
			message: 'Feature idea',
			pageUrl: '/app/my-shifts',
		});

		expect(feedbackRepo.createFeedback).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ orgId: null }),
		);
	});

	it('sets orgId when on org-scoped page', async () => {
		await submitFeedback('user-1', 'org-1', 'ADMIN', {
			mood: 'HAPPY',
			message: 'Nice',
			pageUrl: '/app/opportunities',
		});

		expect(feedbackRepo.createFeedback).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ orgId: 'org-1' }),
		);
	});

	it('defaults role to VOLUNTEER when null', async () => {
		await submitFeedback('user-1', 'org-1', null, {
			mood: 'HAPPY',
			message: 'Hi',
			pageUrl: '/app',
		});

		expect(feedbackRepo.createFeedback).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ userRole: 'VOLUNTEER' }),
		);
	});

	it('sends notification email (fire-and-forget)', async () => {
		await submitFeedback('user-1', 'org-1', 'ADMIN', {
			mood: 'BUG',
			message: 'Something broke',
			pageUrl: '/app',
		});

		// Give fire-and-forget promise time to resolve
		await new Promise((r) => setTimeout(r, 50));

		expect(sendEmail).toHaveBeenCalled();
	});
});

describe('updateFeedbackStatus', () => {
	it('updates status and writes audit log', async () => {
		await updateFeedbackStatus('fb-1', 'IN_PROGRESS', 'admin-1');

		expect(prisma.$transaction).toHaveBeenCalled();
		expect(feedbackRepo.updateFeedbackStatus).toHaveBeenCalledWith(
			expect.anything(),
			'fb-1',
			'IN_PROGRESS',
			'admin-1',
		);
		expect(writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'feedback.updateStatus' }),
		);
	});

	it('sets resolvedAt/resolvedBy for RESOLVED status', async () => {
		const result = await updateFeedbackStatus('fb-1', 'RESOLVED', 'admin-1');

		expect(feedbackRepo.updateFeedbackStatus).toHaveBeenCalledWith(
			expect.anything(),
			'fb-1',
			'RESOLVED',
			'admin-1',
		);
		expect(result.resolvedAt).toBeTruthy();
		expect(result.resolvedBy).toBe('admin-1');
	});

	it('clears resolvedAt/resolvedBy for non-RESOLVED status', async () => {
		const result = await updateFeedbackStatus('fb-1', 'DISMISSED', 'admin-1');

		expect(result.resolvedAt).toBeNull();
		expect(result.resolvedBy).toBeNull();
	});
});

describe('replyToFeedback', () => {
	it('updates reply fields and writes audit log', async () => {
		await replyToFeedback('fb-1', 'Thanks for the feedback', 'admin-1');

		expect(feedbackRepo.updateFeedbackReply).toHaveBeenCalledWith(
			expect.anything(),
			'fb-1',
			'Thanks for the feedback',
			'admin-1',
		);
		expect(writeAuditLogTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ action: 'feedback.reply' }),
		);
	});

	it('sends reply email to user', async () => {
		await replyToFeedback('fb-1', 'We fixed it', 'admin-1');

		// Give fire-and-forget promise time to resolve
		await new Promise((r) => setTimeout(r, 50));

		expect(sendEmail).toHaveBeenCalledWith(
			'user@test.com',
			expect.stringContaining('Re: Your feedback'),
			expect.any(String),
		);
	});
});

describe('getMyFeedback', () => {
	it('delegates to repo listByUser', async () => {
		await getMyFeedback('user-1');
		expect(feedbackRepo.listByUser).toHaveBeenCalledWith('user-1');
	});
});
