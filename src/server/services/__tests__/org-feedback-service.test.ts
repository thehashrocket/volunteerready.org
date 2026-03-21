import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindManyOrgs = vi.fn(async () => []);
const mockCreateFeedback = vi.fn(async () => ({}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		organization: {
			findMany: (...args: unknown[]) => mockFindManyOrgs(...args),
		},
		orgFeedback: {
			create: (...args: unknown[]) => mockCreateFeedback(...args),
		},
	},
}));

const mockSendEmail = vi.fn(async () => true);
vi.mock('@/server/lib/email', () => ({
	sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@/server/lib/email-template', () => ({
	buildEmailHtml: (content: string) => `<html>${content}</html>`,
}));

import { sendOrgFeedbackEmails } from '../org-feedback-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrg(
	overrides: Partial<{
		id: string;
		name: string;
		slug: string;
		members: { user: { email: string | null } }[];
	}> = {},
) {
	return {
		id: overrides.id ?? 'org-1',
		name: overrides.name ?? 'Test Org',
		slug: overrides.slug ?? 'test-org',
		members: overrides.members ?? [{ user: { email: 'admin@test.com' } }],
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendOrgFeedbackEmails', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('sends feedback emails for eligible orgs and returns counts', async () => {
		const org = makeOrg();
		// Called twice: once for DAY_7 window, once for DAY_30 window
		mockFindManyOrgs.mockResolvedValueOnce([org]).mockResolvedValueOnce([]);

		const result = await sendOrgFeedbackEmails();

		expect(result).toEqual({ sent: 1, skipped: 0, failed: 0 });
		expect(mockCreateFeedback).toHaveBeenCalledOnce();
		expect(mockCreateFeedback).toHaveBeenCalledWith({
			data: { orgId: 'org-1', type: 'DAY_7' },
		});
		expect(mockSendEmail).toHaveBeenCalledOnce();
		expect(mockSendEmail).toHaveBeenCalledWith(
			'admin@test.com',
			expect.stringContaining('first week'),
			expect.any(String),
		);
	});

	it('returns all zeros when no eligible orgs exist', async () => {
		mockFindManyOrgs.mockResolvedValue([]);

		const result = await sendOrgFeedbackEmails();

		expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
		expect(mockCreateFeedback).not.toHaveBeenCalled();
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('skips org with no admin email', async () => {
		const orgNoEmail = makeOrg({ members: [] });
		mockFindManyOrgs
			.mockResolvedValueOnce([orgNoEmail])
			.mockResolvedValueOnce([]);

		const result = await sendOrgFeedbackEmails();

		expect(result).toEqual({ sent: 0, skipped: 1, failed: 0 });
		expect(mockCreateFeedback).not.toHaveBeenCalled();
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('counts unique constraint violation as skipped (idempotency)', async () => {
		const org = makeOrg();
		mockFindManyOrgs.mockResolvedValueOnce([org]).mockResolvedValueOnce([]);
		mockCreateFeedback.mockRejectedValueOnce(
			new Error('Unique constraint failed on the fields: (`orgId`,`type`)'),
		);

		const result = await sendOrgFeedbackEmails();

		expect(result).toEqual({ sent: 0, skipped: 1, failed: 0 });
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('counts email send failure as failed', async () => {
		const org = makeOrg();
		mockFindManyOrgs.mockResolvedValueOnce([org]).mockResolvedValueOnce([]);
		mockCreateFeedback.mockResolvedValueOnce({});
		mockSendEmail.mockRejectedValueOnce(new Error('SMTP connection refused'));

		const result = await sendOrgFeedbackEmails();

		expect(result).toEqual({ sent: 0, skipped: 0, failed: 1 });
	});

	it('processes both DAY_7 and DAY_30 windows in a single call', async () => {
		const org7 = makeOrg({ id: 'org-7', name: 'Week Org', slug: 'week-org' });
		const org30 = makeOrg({
			id: 'org-30',
			name: 'Month Org',
			slug: 'month-org',
		});
		mockFindManyOrgs
			.mockResolvedValueOnce([org7])
			.mockResolvedValueOnce([org30]);

		const result = await sendOrgFeedbackEmails();

		expect(result).toEqual({ sent: 2, skipped: 0, failed: 0 });
		expect(mockCreateFeedback).toHaveBeenCalledTimes(2);
		expect(mockCreateFeedback).toHaveBeenCalledWith({
			data: { orgId: 'org-7', type: 'DAY_7' },
		});
		expect(mockCreateFeedback).toHaveBeenCalledWith({
			data: { orgId: 'org-30', type: 'DAY_30' },
		});
		expect(mockSendEmail).toHaveBeenCalledTimes(2);
	});

	it('creates OrgFeedback record BEFORE sending email', async () => {
		const callOrder: string[] = [];
		const org = makeOrg();
		mockFindManyOrgs.mockResolvedValueOnce([org]).mockResolvedValueOnce([]);
		mockCreateFeedback.mockImplementationOnce(async () => {
			callOrder.push('create');
			return {};
		});
		mockSendEmail.mockImplementationOnce(async () => {
			callOrder.push('send');
			return true;
		});

		await sendOrgFeedbackEmails();

		expect(callOrder).toEqual(['create', 'send']);
	});

	it('DAY_7 email contains 3 questions and no impact report section', async () => {
		const org = makeOrg();
		mockFindManyOrgs.mockResolvedValueOnce([org]).mockResolvedValueOnce([]);

		await sendOrgFeedbackEmails();

		const html = mockSendEmail.mock.calls[0][2] as string;
		expect(html).toContain('been a week since');
		expect(html).toContain("What's working well?");
		expect(html).toContain("What's confusing or broken?");
		expect(html).toContain("Anything you expected that's missing?");
		// DAY_7 should NOT have these DAY_30-specific items
		expect(html).not.toContain('Would you pay');
		expect(html).not.toContain('Impact Report');
	});

	it('DAY_30 email contains 5 questions and impact report section', async () => {
		const org = makeOrg({ name: 'Month Org', slug: 'month-org' });
		mockFindManyOrgs.mockResolvedValueOnce([]).mockResolvedValueOnce([org]);

		await sendOrgFeedbackEmails();

		const html = mockSendEmail.mock.calls[0][2] as string;
		expect(html).toContain('30 days');
		expect(html).toContain("What's working well?");
		expect(html).toContain("What's confusing or broken?");
		expect(html).toContain("Anything you expected that's missing?");
		expect(html).toContain('Would you pay $29/mo');
		expect(html).toContain("Can we use your org's name");
		expect(html).toContain('Impact Report is ready');
		expect(html).toContain('View Impact Report');
	});

	it('handles mixed results: one sent, one skipped, one failed', async () => {
		const orgGood = makeOrg({ id: 'org-good' });
		const orgNoAdmin = makeOrg({ id: 'org-no-admin', members: [] });
		const orgFail = makeOrg({ id: 'org-fail' });
		mockFindManyOrgs
			.mockResolvedValueOnce([orgGood, orgNoAdmin, orgFail])
			.mockResolvedValueOnce([]);

		mockCreateFeedback
			.mockResolvedValueOnce({}) // orgGood succeeds
			.mockRejectedValueOnce(new Error('DB connection lost')); // orgFail fails
		mockSendEmail.mockResolvedValueOnce(true);

		const result = await sendOrgFeedbackEmails();

		expect(result).toEqual({ sent: 1, skipped: 1, failed: 1 });
	});
});
