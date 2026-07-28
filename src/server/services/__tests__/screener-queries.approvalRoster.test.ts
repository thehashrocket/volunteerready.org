/**
 * E1a, approval entry point: approving an application makes the applicant one of
 * this org's volunteers.
 *
 * The gate is on the TRANSITION into APPROVED, not on the resulting status, and
 * that distinction is the whole test file. `updateOrgApplicationStatus` is not
 * idempotent — re-saving an already-APPROVED application re-runs the update and
 * re-writes STATUS_CHANGED — so gating on `status === 'APPROVED'` alone would
 * resurrect a volunteer a coordinator had deliberately removed, because the
 * soft-deleted roster row does not block a fresh insert.
 */

const mocks = vi.hoisted(() => ({
	updateApplicationStatusTx: vi.fn(),
	writeAuditLogTx: vi.fn(),
	ensureAppliedRosterRow: vi.fn(),
	sendEmail: vi.fn().mockResolvedValue(true),
	findUnique: vi.fn().mockResolvedValue({ title: 'Dog walking' }),
	transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ tx: true })),
}));

vi.mock('@/server/repositories/volunteer-applications', () => ({
	countApplicationsByStatus: vi.fn(),
	findActiveApplicationByUserAndOpportunity: vi.fn(),
	getApplicationDetail: vi.fn(),
	getRecentApplications: vi.fn(),
	getScreenerQuestionsByIds: vi.fn(),
	listApplications: vi.fn(),
	listUserAppliedOpportunities: vi.fn(),
	listUserAppliedOpportunitiesCrossOrg: vi.fn(),
	updateApplicationStatusTx: mocks.updateApplicationStatusTx,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/services/appliedRosterService', () => ({
	ensureAppliedRosterRow: mocks.ensureAppliedRosterRow,
}));

vi.mock('@/server/lib/email', () => ({ sendEmail: mocks.sendEmail }));

vi.mock('@/server/repositories/opportunityRepo', () => ({
	countOpportunitiesByStatus: vi.fn(),
}));

vi.mock('@/server/repositories/publicApplyRepo', () => ({
	getPublicFormByOrgSlug: vi.fn(),
}));

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: mocks.transaction,
		volunteerOpportunity: { findUnique: mocks.findUnique },
	},
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateOrgApplicationStatus } from '@/server/services/screener-queries';

const LINKED = {
	id: 'app-1',
	orgId: 'org-1',
	submittedByUserId: 'user-1',
	submittedByEmail: 'bob@example.test',
	opportunityId: 'opp-1',
};

function transition(previousStatus: string, updated = LINKED) {
	mocks.updateApplicationStatusTx.mockResolvedValue({
		updated,
		previousStatus,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.sendEmail.mockResolvedValue(true);
	mocks.findUnique.mockResolvedValue({ title: 'Dog walking' });
});

describe('updateOrgApplicationStatus — roster convergence', () => {
	it('creates the roster edge when an application transitions into APPROVED', async () => {
		transition('REVIEW');

		await updateOrgApplicationStatus('org-1', 'app-1', 'APPROVED', 'staff-1');

		expect(mocks.ensureAppliedRosterRow).toHaveBeenCalledWith(
			{ tx: true },
			expect.objectContaining({
				orgId: 'org-1',
				userId: 'user-1',
				applicationId: 'app-1',
				actorId: 'staff-1',
				addedByUserId: 'staff-1',
				fallbackDisplayName: 'bob@example.test',
			}),
		);
	});

	it('creates it inside the same transaction as the status change', async () => {
		// A partial commit would leave an approved, linked application with no roster
		// row and nothing to reconcile it.
		transition('SUBMITTED');

		await updateOrgApplicationStatus('org-1', 'app-1', 'APPROVED', 'staff-1');

		expect(mocks.ensureAppliedRosterRow.mock.calls[0][0]).toEqual({ tx: true });
		expect(mocks.transaction).toHaveBeenCalledTimes(1);
	});

	it('does NOT resurrect a removed volunteer when an APPROVED application is re-saved', async () => {
		// The regression this gate exists for. Staff approve, later remove the
		// volunteer from the roster (soft delete), then re-save the still-APPROVED
		// application. Gating on the resulting status alone would silently put the
		// removed person back, because the partial unique index ignores soft-deleted
		// rows.
		transition('APPROVED');

		await updateOrgApplicationStatus('org-1', 'app-1', 'APPROVED', 'staff-1');

		expect(mocks.ensureAppliedRosterRow).not.toHaveBeenCalled();
	});

	it('does not create a roster edge for any non-APPROVED status', async () => {
		for (const status of ['SUBMITTED', 'REVIEW', 'REJECTED'] as const) {
			vi.clearAllMocks();
			transition('SUBMITTED');

			await updateOrgApplicationStatus('org-1', 'app-1', status, 'staff-1');

			expect(mocks.ensureAppliedRosterRow).not.toHaveBeenCalled();
		}
	});

	it('does not create a roster edge for an anonymous application', async () => {
		// `submittedByUserId: null` means there is no user to put on a roster.
		// Minting a shadow User from `submittedByEmail` on every public approval is
		// deferred to v1b, so an org with anonymous applicants carries a partial
		// roster until then — knowingly.
		transition('REVIEW', { ...LINKED, submittedByUserId: null });

		await updateOrgApplicationStatus('org-1', 'app-1', 'APPROVED', 'staff-1');

		expect(mocks.ensureAppliedRosterRow).not.toHaveBeenCalled();
	});

	it('re-approving after a REJECTED detour does create the edge again', async () => {
		// REJECTED -> APPROVED is a genuine transition and an affirmative act, unlike
		// the no-op re-save above.
		transition('REJECTED');

		await updateOrgApplicationStatus('org-1', 'app-1', 'APPROVED', 'staff-1');

		expect(mocks.ensureAppliedRosterRow).toHaveBeenCalledTimes(1);
	});

	it('threads impersonatedBy onto the roster audit row', async () => {
		transition('REVIEW');

		await updateOrgApplicationStatus(
			'org-1',
			'app-1',
			'APPROVED',
			'target-1',
			'admin-9',
		);

		expect(mocks.ensureAppliedRosterRow).toHaveBeenCalledWith(
			{ tx: true },
			expect.objectContaining({ impersonatedBy: 'admin-9' }),
		);
	});

	it('still writes the STATUS_CHANGED audit row alongside the roster edge', async () => {
		transition('REVIEW');

		await updateOrgApplicationStatus('org-1', 'app-1', 'APPROVED', 'staff-1');

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			{ tx: true },
			expect.objectContaining({
				action: 'STATUS_CHANGED',
				metadata: { from: 'REVIEW', to: 'APPROVED' },
			}),
		);
	});
});
