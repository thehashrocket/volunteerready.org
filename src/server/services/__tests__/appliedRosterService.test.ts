/**
 * Unit coverage for E1a roster convergence.
 *
 * Before this, `/app/volunteers` listed only volunteers a coordinator had typed
 * in by hand — every volunteer who applied and was approved was missing, so the
 * roster was not the org's volunteer list. These tests pin the two behaviours
 * that are easy to get wrong: idempotence (the insert must not raise inside a
 * transaction that has to commit) and audit attribution.
 */

const mocks = vi.hoisted(() => ({
	createOrgVolunteerIfAbsent: vi.fn(),
	findLiveOrgVolunteer: vi.fn(),
	findOrgVolunteerBlock: vi.fn(),
	findUserIdentity: vi.fn(),
	writeAuditLogTx: vi.fn(),
}));

vi.mock('@/server/repositories/orgVolunteerRepo', () => ({
	createOrgVolunteerIfAbsent: mocks.createOrgVolunteerIfAbsent,
	findLiveOrgVolunteer: mocks.findLiveOrgVolunteer,
	findOrgVolunteerBlock: mocks.findOrgVolunteerBlock,
}));

vi.mock('@/server/repositories/userAccountStateRepo', () => ({
	findUserIdentity: mocks.findUserIdentity,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAppliedRosterRow } from '@/server/services/appliedRosterService';

const tx = { fake: true } as never;

function input(overrides: Record<string, unknown> = {}) {
	return {
		orgId: 'org-1',
		userId: 'user-1',
		applicationId: 'app-1',
		actorId: 'staff-1',
		addedByUserId: 'staff-1',
		fallbackDisplayName: 'fallback@example.test',
		...overrides,
	} as Parameters<typeof ensureAppliedRosterRow>[1];
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.findUserIdentity.mockResolvedValue({
		name: 'Bob Volunteer',
		email: 'bob@example.test',
	});
	mocks.createOrgVolunteerIfAbsent.mockResolvedValue(true);
	mocks.findLiveOrgVolunteer.mockResolvedValue({ id: 'vol-1' });
	mocks.findOrgVolunteerBlock.mockResolvedValue(null);
});

describe('ensureAppliedRosterRow', () => {
	it('SECURITY: creates NO roster row when the volunteer has blocked the org', async () => {
		mocks.findOrgVolunteerBlock.mockResolvedValue({ id: 'block-1' });

		// Reachable with no staff misbehaviour at all: apply → join the roster →
		// leave (which writes the block) → staff approve the application that was
		// already sitting in their queue. Without this the approval puts the
		// volunteer back on /app/volunteers, and `assignVolunteerToShift` reads
		// roster rows directly rather than through requireOrgVolunteerRelationship
		// — so the org could schedule and email someone who had refused them.
		const created = await ensureAppliedRosterRow(tx, input());

		expect(created).toBe(false);
		expect(mocks.createOrgVolunteerIfAbsent).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('checks the block on the caller transaction handle', async () => {
		await ensureAppliedRosterRow(tx, input());

		// Escaping the tx would read a block that a concurrent leave has written
		// but not yet committed — or miss one it has.
		expect(mocks.findOrgVolunteerBlock).toHaveBeenCalledWith(
			'org-1',
			'user-1',
			tx,
		);
	});

	it('creates the roster edge with source APPLIED', async () => {
		const created = await ensureAppliedRosterRow(tx, input());

		expect(created).toBe(true);
		expect(mocks.createOrgVolunteerIfAbsent).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				orgId: 'org-1',
				userId: 'user-1',
				source: 'APPLIED',
				addedByUserId: 'staff-1',
			}),
		);
	});

	it('passes the caller-supplied transaction client, never a fresh connection', async () => {
		// The row must commit with the approval (or the claim and its audit row). A
		// separate connection would let the application be approved while the roster
		// row silently rolls back — the inconsistency this design exists to prevent.
		await ensureAppliedRosterRow(tx, input());

		expect(mocks.createOrgVolunteerIfAbsent.mock.calls[0][0]).toBe(tx);
		expect(mocks.findLiveOrgVolunteer.mock.calls[0][2]).toBe(tx);
	});

	it('prefers User.name as the roster label', async () => {
		await ensureAppliedRosterRow(tx, input());

		expect(mocks.createOrgVolunteerIfAbsent).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({ displayName: 'Bob Volunteer' }),
		);
	});

	it('falls back to the email when User.name is null', async () => {
		// Null for anyone who signed up by magic link without filling in a profile,
		// which is the common case for an applicant.
		mocks.findUserIdentity.mockResolvedValue({
			name: null,
			email: 'bob@example.test',
		});

		await ensureAppliedRosterRow(tx, input());

		expect(mocks.createOrgVolunteerIfAbsent).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({ displayName: 'bob@example.test' }),
		);
	});

	it('falls back to the email when User.name is whitespace only', async () => {
		mocks.findUserIdentity.mockResolvedValue({
			name: '   ',
			email: 'bob@example.test',
		});

		await ensureAppliedRosterRow(tx, input());

		expect(mocks.createOrgVolunteerIfAbsent).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({ displayName: 'bob@example.test' }),
		);
	});

	it('falls back to the caller-supplied name when both name and email are null', async () => {
		// `displayName` is NOT NULL but both User columns are nullable, so the caller
		// hands over an address it already holds.
		mocks.findUserIdentity.mockResolvedValue({ name: null, email: null });

		await ensureAppliedRosterRow(tx, input());

		expect(mocks.createOrgVolunteerIfAbsent).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({ displayName: 'fallback@example.test' }),
		);
	});

	it('writes VOLUNTEER_ADDED tagged with source APPLIED and the application id', async () => {
		// Same action as a hand-typed add so one query returns the whole roster
		// history; the metadata is what distinguishes how the edge came to exist.
		await ensureAppliedRosterRow(tx, input());

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				orgId: 'org-1',
				actorId: 'staff-1',
				action: 'VOLUNTEER_ADDED',
				entityType: 'OrgVolunteer',
				entityId: 'vol-1',
				metadata: expect.objectContaining({
					source: 'APPLIED',
					applicationId: 'app-1',
					email: 'bob@example.test',
				}),
			}),
		);
	});

	it('stamps impersonatedBy when the approval was taken while impersonating', async () => {
		await ensureAppliedRosterRow(tx, input({ impersonatedBy: 'admin-9' }));

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				metadata: expect.objectContaining({ impersonatedBy: 'admin-9' }),
			}),
		);
	});

	it('omits impersonatedBy entirely when not impersonating', async () => {
		// Stamping it unconditionally would mark every row as impersonated and make
		// the audit query's impersonatedOnly filter useless.
		await ensureAppliedRosterRow(tx, input());

		const metadata = mocks.writeAuditLogTx.mock.calls[0][1].metadata;
		expect(metadata).not.toHaveProperty('impersonatedBy');
	});

	it('is idempotent: writes no audit row when the edge already existed', async () => {
		// `createOrgVolunteerIfAbsent` returns false on ON CONFLICT DO NOTHING. A
		// second audit row here would double-count one edge, and re-approving an
		// application is a normal thing for staff to do.
		mocks.createOrgVolunteerIfAbsent.mockResolvedValue(false);

		const created = await ensureAppliedRosterRow(tx, input());

		expect(created).toBe(false);
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
		// No point looking up a row we did not create.
		expect(mocks.findLiveOrgVolunteer).not.toHaveBeenCalled();
	});

	it('does nothing when the application points at a user that no longer exists', async () => {
		// Throwing would roll back an approval over a dangling reference.
		mocks.findUserIdentity.mockResolvedValue(null);

		const created = await ensureAppliedRosterRow(tx, input());

		expect(created).toBe(false);
		expect(mocks.createOrgVolunteerIfAbsent).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('records a self-service claim with no adder', async () => {
		// Nobody "added" a volunteer who added themselves, so the roster row must not
		// name one — but the audit row still attributes the action to them.
		await ensureAppliedRosterRow(
			tx,
			input({ actorId: 'user-1', addedByUserId: null }),
		);

		expect(mocks.createOrgVolunteerIfAbsent).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({ addedByUserId: null }),
		);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({ actorId: 'user-1' }),
		);
	});
});
