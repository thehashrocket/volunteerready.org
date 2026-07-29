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
	declineApplicationForUser: vi.fn(),
	listClaimableApplicationsByEmail: vi.fn(),
	listUserApplications: vi.fn(),
	getUserApplicationDetail: vi.fn(),
	writeAuditLogTx: vi.fn(),
	ensureAppliedRosterRow: vi.fn(),
	liftOrgVolunteerBlock: vi.fn(),
	updateMany: vi.fn(),
	findEmailByUserId: vi.fn(),
	// Stand-in transaction client. Running the callback inline means a throw
	// inside it propagates exactly as a real rollback would surface.
	transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ tx: true })),
}));

vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	findEmailByUserId: mocks.findEmailByUserId,
}));

vi.mock('@/server/services/appliedRosterService', () => ({
	ensureAppliedRosterRow: mocks.ensureAppliedRosterRow,
}));

vi.mock('@/server/services/orgVolunteerAccessService', () => ({
	liftOrgVolunteerBlock: mocks.liftOrgVolunteerBlock,
}));

vi.mock('@/server/repositories/volunteer-applications', () => ({
	claimApplicationForUser: mocks.claimApplicationForUser,
	declineApplicationForUser: mocks.declineApplicationForUser,
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
	declineApplication,
	listClaimableApplications,
	listMyApplications,
} from '@/server/services/my-applications';
import { p2002Error } from '@/test/prisma-error-fixtures';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.findEmailByUserId.mockResolvedValue('bob@example.test');
	// `clearAllMocks` resets recorded CALLS but not implementations, so a
	// `mockRejectedValue` set by one test leaks into every later one. These two are
	// re-armed explicitly because tests below depend on their happy path.
	mocks.writeAuditLogTx.mockResolvedValue(undefined);
	mocks.ensureAppliedRosterRow.mockResolvedValue(true);
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

	// -------------------------------------------------------------------------
	// E1a — the roster edge an approved application implies
	// -------------------------------------------------------------------------

	it('creates the roster edge when claiming an already-APPROVED application', async () => {
		// The second E1a entry point. An application approved BEFORE the applicant
		// ever signed in gains `submittedByUserId` only at claim time, so without
		// this the roster row is never created and never reconciled.
		mocks.claimApplicationForUser.mockResolvedValue({
			id: 'app-1',
			orgId: 'org-1',
			status: 'APPROVED',
		});

		await claimApplication('user-1', 'app-1');

		expect(mocks.ensureAppliedRosterRow).toHaveBeenCalledWith(
			{ tx: true },
			expect.objectContaining({
				orgId: 'org-1',
				userId: 'user-1',
				applicationId: 'app-1',
				actorId: 'user-1',
				// Nobody added this volunteer — they added themselves.
				addedByUserId: null,
				fallbackDisplayName: 'bob@example.test',
			}),
		);
	});

	it('does NOT create a roster edge when claiming a still-pending application', async () => {
		// Claiming binds an application of ANY status. Only an APPROVED one means the
		// org has accepted this person as a volunteer.
		for (const status of ['SUBMITTED', 'REVIEW', 'REJECTED'] as const) {
			vi.clearAllMocks();
			mocks.findEmailByUserId.mockResolvedValue('bob@example.test');
			mocks.claimApplicationForUser.mockResolvedValue({
				id: 'app-1',
				orgId: 'org-1',
				status,
			});

			await claimApplication('user-1', 'app-1');

			expect(mocks.ensureAppliedRosterRow).not.toHaveBeenCalled();
		}
	});

	it('creates the roster edge on the same tx handle as the bind', async () => {
		mocks.claimApplicationForUser.mockResolvedValue({
			id: 'app-1',
			orgId: 'org-1',
			status: 'APPROVED',
		});

		await claimApplication('user-1', 'app-1');

		expect(mocks.ensureAppliedRosterRow.mock.calls[0][0]).toEqual({ tx: true });
	});

	it('lifts any block on the org, on the same tx handle', async () => {
		mocks.claimApplicationForUser.mockResolvedValue({
			id: 'app-1',
			orgId: 'org-1',
			status: 'SUBMITTED',
		});

		await claimApplication('user-1', 'app-1');

		// Claiming is an explicit "yes, this is mine" against a named org, so it is
		// one of the three volunteer-initiated acts that restore access. Unlike the
		// roster row above it is NOT conditional on status: a block should lift
		// whenever the volunteer re-engages, approved or not.
		expect(mocks.liftOrgVolunteerBlock).toHaveBeenCalledWith(
			{ tx: true },
			'org-1',
			'user-1',
		);
	});

	it('lifts the block BEFORE creating the roster row', async () => {
		mocks.claimApplicationForUser.mockResolvedValue({
			id: 'app-1',
			orgId: 'org-1',
			status: 'APPROVED',
		});

		await claimApplication('user-1', 'app-1');

		// Order is load-bearing: reversed, `ensureAppliedRosterRow` mints a roster
		// membership while the block still stands, and the org holds a volunteer it
		// cannot act on until something else happens to clear it.
		expect(
			mocks.liftOrgVolunteerBlock.mock.invocationCallOrder[0],
		).toBeLessThan(mocks.ensureAppliedRosterRow.mock.invocationCallOrder[0]);
	});

	// -------------------------------------------------------------------------
	// The duplicate-application collision
	// -------------------------------------------------------------------------

	it('maps a duplicate-application P2002 to CONFLICT, not a 500', async () => {
		// Setting the previously-null `submittedByUserId` collides with the partial
		// unique index when the caller ALREADY has an active application for the same
		// opportunity — reachable because `submitVolunteerApplication` only dedupes
		// once `submittedByUserId` is set. Unhandled, this surfaced as
		// INTERNAL_SERVER_ERROR and left the row permanently unclaimable.
		mocks.claimApplicationForUser.mockRejectedValue(
			p2002Error('VolunteerApplication_userId_opportunityId_active'),
		);

		const error = await claimApplication('user-1', 'app-1').catch(
			(e: TRPCError) => e,
		);

		expect((error as TRPCError).code).toBe('CONFLICT');
		expect((error as TRPCError).message).toMatch(/already applied/i);
	});

	it('deliberately does NOT collapse that collision into NOT_FOUND', async () => {
		// The indistinguishability rule governs the `!row` branch, which is what an
		// id probe reaches. Getting here means the repository's email predicate
		// already matched, so the row IS the caller's and the collision is with their
		// OWN other application — nothing about a third party is disclosed, and
		// NOT_FOUND would be a dead end they cannot act on.
		mocks.claimApplicationForUser.mockRejectedValue(
			p2002Error('VolunteerApplication_userId_opportunityId_active'),
		);

		const error = await claimApplication('user-1', 'app-1').catch(
			(e: TRPCError) => e,
		);

		expect((error as TRPCError).code).not.toBe('NOT_FOUND');
	});

	it('does not swallow an unrelated unique violation as CONFLICT', async () => {
		// Narrowing matters: reporting "you already applied" for a P2002 on some
		// other table would tell the user something false.
		mocks.claimApplicationForUser.mockRejectedValue(
			p2002Error('User_email_key'),
		);

		const error = await claimApplication('user-1', 'app-1').catch(
			(e: unknown) => e,
		);

		expect(error).not.toBeInstanceOf(TRPCError);
	});

	it('lets a non-P2002 failure propagate untouched', async () => {
		mocks.claimApplicationForUser.mockRejectedValue(
			new Error('connection lost'),
		);

		await expect(claimApplication('user-1', 'app-1')).rejects.toThrow(
			'connection lost',
		);
	});
});

// ---------------------------------------------------------------------------
// Declining
// ---------------------------------------------------------------------------

describe('declineApplication', () => {
	beforeEach(() => {
		mocks.declineApplicationForUser.mockResolvedValue({
			id: 'app-1',
			orgId: 'org-1',
		});
	});

	it('records the decline and audits it', async () => {
		// The audit row is the point as much as the suppression: a decline is
		// EVIDENCE of a planted application, and a cluster against one org is a
		// platform-admin signal.
		const result = await declineApplication('user-1', 'app-1');

		expect(result).toEqual({ id: 'app-1' });
		expect(mocks.declineApplicationForUser).toHaveBeenCalledWith(
			'app-1',
			'user-1',
			'bob@example.test',
			{ tx: true },
		);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			{ tx: true },
			expect.objectContaining({
				orgId: 'org-1',
				actorId: 'user-1',
				action: 'APPLICATION_CLAIM_DECLINED',
				entityType: 'VolunteerApplication',
				entityId: 'app-1',
			}),
		);
	});

	it('SECURITY: resolves the address from the id, never from a caller argument', async () => {
		// Same reasoning as the claim path: under impersonation
		// `session.user.email` is the real admin's while `id` is the target's.
		await declineApplication('user-1', 'app-1');

		expect(mocks.findEmailByUserId).toHaveBeenCalledWith('user-1');
	});

	it("SECURITY: throws NOT_FOUND for a row that is not the caller's", async () => {
		// The repository enforces the email match in its `where`, so one user cannot
		// suppress another user's claim candidate.
		mocks.declineApplicationForUser.mockResolvedValue(null);

		const error = await declineApplication('attacker', 'victims-app').catch(
			(e: TRPCError) => e,
		);

		expect((error as TRPCError).code).toBe('NOT_FOUND');
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('SECURITY: never creates a roster edge — declining grants nothing', async () => {
		await declineApplication('user-1', 'app-1');

		expect(mocks.ensureAppliedRosterRow).not.toHaveBeenCalled();
	});

	it('SECURITY: an audit-write failure aborts the decline', async () => {
		mocks.writeAuditLogTx.mockRejectedValue(new Error('audit table down'));

		await expect(declineApplication('user-1', 'app-1')).rejects.toThrow(
			'audit table down',
		);
	});

	it('refuses when the user has no email on file', async () => {
		mocks.findEmailByUserId.mockResolvedValue(null);

		const error = await declineApplication('user-1', 'app-1').catch(
			(e: TRPCError) => e,
		);

		expect((error as TRPCError).code).toBe('PRECONDITION_FAILED');
		expect(mocks.declineApplicationForUser).not.toHaveBeenCalled();
	});
});
