/**
 * Regression tests for the application-claim path.
 *
 * These pin the fix for the unscoped `linkApplicationsToUser()` auto-link:
 * `screener.submit` is a publicProcedure taking an arbitrary `submittedByEmail`,
 * so an orphan application is attacker-controllable. Auto-attaching one on
 * sign-in minted an `APPLICATION` edge that `requireOrgVolunteerRelationship()`
 * accepts as authorization for `profile.getOrgVisibleProfile` and
 * `credentials.issue`. Claiming must now be an explicit act by the address
 * owner, and the email predicate must be enforced server-side.
 */

const mocks = vi.hoisted(() => ({
	claimApplicationForUser: vi.fn(),
	listClaimableApplicationsByEmail: vi.fn(),
	listUserApplications: vi.fn(),
	getUserApplicationDetail: vi.fn(),
	writeAuditLogTx: vi.fn(),
	updateMany: vi.fn(),
	findEmailByUserId: vi.fn(),
	// Stand-in transaction client. Running the callback inline means a throw
	// inside it propagates exactly as a real rollback would surface.
	transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ tx: true })),
}));

vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	findEmailByUserId: mocks.findEmailByUserId,
}));

vi.mock('@/server/repositories/volunteer-applications', () => ({
	claimApplicationForUser: mocks.claimApplicationForUser,
	getApplicationStatusTimeline: vi.fn(),
	getScreenerQuestionsByIds: vi.fn().mockResolvedValue([]),
	getUserApplicationDetail: mocks.getUserApplicationDetail,
	listClaimableApplicationsByEmail: mocks.listClaimableApplicationsByEmail,
	listUserApplications: mocks.listUserApplications,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: mocks.transaction,
		volunteerApplication: {
			findFirst: vi.fn(),
			updateMany: mocks.updateMany,
		},
	},
}));

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	claimApplication,
	listClaimableApplications,
	listMyApplications,
} from '@/server/services/my-applications';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.findEmailByUserId.mockResolvedValue('bob@example.test');
});

describe('listMyApplications', () => {
	it('SECURITY: never writes — listing applications does not attach orphans', async () => {
		mocks.listUserApplications.mockResolvedValue([]);

		await listMyApplications('user-1');

		// The old implementation ran an unscoped updateMany on every page load.
		expect(mocks.updateMany).not.toHaveBeenCalled();
	});
});

describe('listClaimableApplications', () => {
	it('returns orphan applications matching the address as candidates only', async () => {
		mocks.listClaimableApplicationsByEmail.mockResolvedValue([
			{
				id: 'app-1',
				submittedAt: new Date('2026-07-01'),
				organization: { id: 'org-1', name: 'Shelter', slug: 'shelter' },
			},
		]);

		const result = await listClaimableApplications('user-1');

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('app-1');
		expect(mocks.updateMany).not.toHaveBeenCalled();
	});

	it('SECURITY: resolves the address from the user id, never from a caller-supplied one', async () => {
		// Under impersonation session.user.email is the real admin's address
		// while session.user.id is the target's. Sourcing the address from the
		// id is what keeps the two halves of the identity together.
		mocks.listClaimableApplicationsByEmail.mockResolvedValue([]);

		await listClaimableApplications('user-1');

		expect(mocks.findEmailByUserId).toHaveBeenCalledWith('user-1');
		expect(mocks.listClaimableApplicationsByEmail).toHaveBeenCalledWith(
			'bob@example.test',
		);
	});

	it('returns nothing when the user has no email on file', async () => {
		mocks.findEmailByUserId.mockResolvedValue(null);

		expect(await listClaimableApplications('user-1')).toEqual([]);
		expect(mocks.listClaimableApplicationsByEmail).not.toHaveBeenCalled();
	});
});

describe('claimApplication', () => {
	it('binds the application and audits the claim', async () => {
		mocks.claimApplicationForUser.mockResolvedValue({
			id: 'app-1',
			orgId: 'org-1',
		});

		const result = await claimApplication('user-1', 'app-1');

		expect(result).toEqual({ id: 'app-1' });
		// Address resolved from the id, not handed in — see the impersonation
		// note on listClaimableApplications.
		expect(mocks.findEmailByUserId).toHaveBeenCalledWith('user-1');
		expect(mocks.claimApplicationForUser).toHaveBeenCalledWith(
			'app-1',
			'user-1',
			'bob@example.test',
			{ tx: true },
		);
		// Audited on the SAME tx handle the bind used — that is what makes the
		// two commit or roll back together.
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			{ tx: true },
			expect.objectContaining({
				orgId: 'org-1',
				actorId: 'user-1',
				action: 'APPLICATION_CLAIMED',
				entityType: 'VolunteerApplication',
				entityId: 'app-1',
			}),
		);
	});

	it("SECURITY: throws NOT_FOUND when the row does not match the caller's email", async () => {
		// The repository enforces the email match in its `where`, so a
		// non-matching id yields null rather than a bound row.
		mocks.claimApplicationForUser.mockResolvedValue(null);
		mocks.findEmailByUserId.mockResolvedValue('attacker@example.test');

		await expect(claimApplication('attacker', 'victims-app')).rejects.toThrow(
			TRPCError,
		);
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('SECURITY: an audit-write failure aborts the claim rather than binding untracked', async () => {
		// The bind grants an authorization edge. If the audit row cannot be
		// written the whole transaction must roll back — otherwise the edge
		// exists with no record of who acquired it, which is the blind spot the
		// transactional wrapper exists to close.
		mocks.claimApplicationForUser.mockResolvedValue({
			id: 'app-1',
			orgId: 'org-1',
		});
		mocks.writeAuditLogTx.mockRejectedValue(new Error('audit table down'));

		await expect(claimApplication('user-1', 'app-1')).rejects.toThrow(
			'audit table down',
		);
	});

	it('SECURITY: refuses to claim when the user has no email on file', async () => {
		mocks.findEmailByUserId.mockResolvedValue(null);

		await expect(claimApplication('user-1', 'app-1')).rejects.toThrow(
			TRPCError,
		);
		expect(mocks.claimApplicationForUser).not.toHaveBeenCalled();
	});

	it('SECURITY: pins the exact refusal codes — NOT_FOUND for a bad id, PRECONDITION_FAILED for no email', async () => {
		// The codes are the contract, not decoration. "Already claimed", "not
		// yours" and "does not exist" must ALL surface as NOT_FOUND so an id probe
		// cannot distinguish them; a FORBIDDEN there would confirm the row exists
		// and belongs to someone. The no-email case is a different fact about the
		// caller's own account, so it is allowed to be specific.
		mocks.claimApplicationForUser.mockResolvedValue(null);

		const notFound = await claimApplication('attacker', 'victims-app').catch(
			(error: TRPCError) => error,
		);
		expect((notFound as TRPCError).code).toBe('NOT_FOUND');

		mocks.findEmailByUserId.mockResolvedValue(null);
		const noEmail = await claimApplication('user-1', 'app-1').catch(
			(error: TRPCError) => error,
		);
		expect((noEmail as TRPCError).code).toBe('PRECONDITION_FAILED');
	});
});
