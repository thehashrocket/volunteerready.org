/**
 * Service-level tests for getOrgActivityFeed.
 *
 * Verifies that only curated action types are returned and results
 * are ordered by createdAt DESC with a limit of 20.
 */

const mocks = vi.hoisted(() => ({
	findMany: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		auditLog: { findMany: mocks.findMany },
		screenerQuestion: { count: vi.fn() },
		shift: { count: vi.fn() },
		volunteerCredential: { count: vi.fn() },
	},
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: vi.fn(),
}));

vi.mock('@/server/repositories/volunteer-applications', () => ({
	countApplicationsByStatus: vi.fn(),
	getApplicationDetail: vi.fn(),
	getRecentApplications: vi.fn(),
	getScreenerQuestionsByIds: vi.fn(),
	listApplications: vi.fn(),
	updateApplicationStatusTx: vi.fn(),
}));

vi.mock('@/server/repositories/opportunityRepo', () => ({
	countOpportunitiesByStatus: vi.fn(),
}));

vi.mock('@/server/repositories/publicApplyRepo', () => ({
	getPublicFormByOrgSlug: vi.fn(),
}));

vi.mock('@/server/services/my-applications', () => ({
	formatAnswerValue: vi.fn(),
	normalizeAnswerValue: vi.fn(),
	normalizeReasons: vi.fn(),
	listMyApplications: vi.fn(),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrgActivityFeed } from '../screener-queries';

const ORG_ID = 'org-1';

function makeEvent(action: string, minutesAgo: number) {
	return {
		id: `evt-${action}-${minutesAgo}`,
		action,
		metadata: {},
		createdAt: new Date(Date.now() - minutesAgo * 60_000),
		actor: { name: 'Test User', email: 'test@example.com' },
	};
}

describe('getOrgActivityFeed', () => {
	beforeEach(() => {
		mocks.findMany.mockReset();
	});

	it('queries with the 5 curated action types', async () => {
		mocks.findMany.mockResolvedValue([]);

		await getOrgActivityFeed(ORG_ID);

		expect(mocks.findMany).toHaveBeenCalledOnce();
		const args = mocks.findMany.mock.calls[0][0];
		expect(args.where.orgId).toBe(ORG_ID);
		expect(args.where.action.in).toEqual(
			expect.arrayContaining([
				'volunteer_application.submitted',
				'shift.attendance.attended',
				'CREDENTIAL_ISSUED',
				'shift.completed',
				'MEMBER_INVITED',
				'MEMBER_REMOVED',
				'ROLE_CHANGED',
			]),
		);
		expect(args.where.action.in).toHaveLength(7);
	});

	it('orders by createdAt DESC and limits to 20', async () => {
		mocks.findMany.mockResolvedValue([]);

		await getOrgActivityFeed(ORG_ID);

		const args = mocks.findMany.mock.calls[0][0];
		expect(args.orderBy).toEqual({ createdAt: 'desc' });
		expect(args.take).toBe(20);
	});

	it('includes actor name and email in select', async () => {
		mocks.findMany.mockResolvedValue([]);

		await getOrgActivityFeed(ORG_ID);

		const args = mocks.findMany.mock.calls[0][0];
		expect(args.select.actor).toEqual({
			select: { name: true, email: true },
		});
	});

	it('returns events as-is from the query', async () => {
		const events = [
			makeEvent('volunteer_application.submitted', 5),
			makeEvent('CREDENTIAL_ISSUED', 10),
			makeEvent('MEMBER_INVITED', 30),
		];
		mocks.findMany.mockResolvedValue(events);

		const result = await getOrgActivityFeed(ORG_ID);

		expect(result).toHaveLength(3);
		expect(result[0].action).toBe('volunteer_application.submitted');
		expect(result[2].action).toBe('MEMBER_INVITED');
	});

	it('returns empty array when no matching events exist', async () => {
		mocks.findMany.mockResolvedValue([]);

		const result = await getOrgActivityFeed(ORG_ID);

		expect(result).toEqual([]);
	});
});
