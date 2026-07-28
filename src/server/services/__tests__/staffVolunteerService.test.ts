/**
 * Service-level tests for staffVolunteerService (T3).
 *
 * Mocks the repository layer, not a Prisma client, per repo convention.
 * `$transaction` is stubbed as `async (fn) => fn(fakeTx)` so the transactional
 * shape is exercised without a database. The partial-unique-index behaviour
 * these tests simulate with P2002 is separately proven for real against
 * Postgres in `orgVolunteer.integration.test.ts`.
 */

const mocks = vi.hoisted(() => ({
	userFindUnique: vi.fn(),
	userCreate: vi.fn(),
	userUpdate: vi.fn(),
	findLiveOrgVolunteer: vi.fn(),
	createOrgVolunteer: vi.fn(),
	softDeleteOrgVolunteer: vi.fn(),
	softDeleteOwnOrgVolunteer: vi.fn(),
	restoreOrgVolunteer: vi.fn(),
	writeAuditLogTx: vi.fn(),
	orgFindUnique: vi.fn(),
	sendRosterAddedEmail: vi.fn(),
}));

const fakeTx = {
	user: {
		findUnique: mocks.userFindUnique,
		create: mocks.userCreate,
		update: mocks.userUpdate,
	},
};

vi.mock('@/server/repositories/prisma', () => ({
	prisma: {
		$transaction: async (fn: (tx: unknown) => unknown) => fn(fakeTx),
		// Used by the post-commit notification lookup, outside the transaction.
		organization: { findUnique: mocks.orgFindUnique },
		user: { findUnique: mocks.userFindUnique },
	},
}));

vi.mock('@/server/repositories/sendRosterAddedEmail', () => ({
	sendRosterAddedEmail: mocks.sendRosterAddedEmail,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/repositories/orgVolunteerRepo', () => ({
	findLiveOrgVolunteer: mocks.findLiveOrgVolunteer,
	createOrgVolunteer: mocks.createOrgVolunteer,
	softDeleteOrgVolunteer: mocks.softDeleteOrgVolunteer,
	softDeleteOwnOrgVolunteer: mocks.softDeleteOwnOrgVolunteer,
	restoreOrgVolunteer: mocks.restoreOrgVolunteer,
	listOrgVolunteers: vi.fn(),
	listOrgVolunteersByUser: vi.fn(),
	countOrgVolunteers: vi.fn(),
	countAttendedShiftsByUser: vi.fn(),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INDISTINGUISHABLE_OUTCOMES } from '@/server/domain/org-volunteer';
import { p2002Error } from '@/test/prisma-error-fixtures';
import {
	addVolunteer,
	leaveOrgRoster,
	removeVolunteer,
	restoreVolunteer,
} from '../staffVolunteerService';

const ORG = 'org-1';
const ACTOR = 'actor-1';

/** Local alias: this suite always means the roster constraint. */
function p2002(
	modelName = 'OrgVolunteer',
	constraint = 'OrgVolunteer_orgId_userId_active',
) {
	return p2002Error(constraint, modelName);
}

function baseInput(
	overrides: Partial<Parameters<typeof addVolunteer>[0]> = {},
) {
	return {
		orgId: ORG,
		displayName: 'Ada Lovelace',
		email: 'ada@example.com',
		actorId: ACTOR,
		...overrides,
	};
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.findLiveOrgVolunteer.mockResolvedValue(null);
	mocks.createOrgVolunteer.mockResolvedValue({ id: 'ov-1' });
	mocks.userCreate.mockResolvedValue({ id: 'user-new' });
	mocks.orgFindUnique.mockResolvedValue({ name: 'Helping Hands' });
	mocks.sendRosterAddedEmail.mockResolvedValue(undefined);
});

/** The notification is fired post-commit and not awaited; let it settle. */
async function flushNotifications() {
	await new Promise((resolve) => setImmediate(resolve));
}

describe('addVolunteer', () => {
	it('mints a shadow UNCLAIMED user with a PRIVATE profile when the email is unknown', async () => {
		mocks.userFindUnique.mockResolvedValue(null);

		const result = await addVolunteer(baseInput());

		expect(result.outcome).toBe('CREATED_SHADOW');
		expect(result.notify).toBe(false);

		const data = mocks.userCreate.mock.calls[0][0].data;
		expect(data.accountState).toBe('UNCLAIMED');
		// PRIVATE keeps the shadow user out of volunteer discovery, which
		// hardcodes visibility PUBLIC.
		expect(data.profile.create.visibility).toBe('PRIVATE');
	});

	it('links an ACTIVE user without creating one, and flags them for notification', async () => {
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-active',
			name: 'Ada',
			accountState: 'ACTIVE',
		});

		const result = await addVolunteer(baseInput());

		expect(result.outcome).toBe('LINKED_ACTIVE');
		expect(result.notify).toBe(true);
		expect(mocks.userCreate).not.toHaveBeenCalled();
	});

	it('links an UNCLAIMED user from another org and sends NO email', async () => {
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-other-org',
			name: 'Ada',
			accountState: 'UNCLAIMED',
		});

		const result = await addVolunteer(baseInput());

		expect(result.outcome).toBe('LINKED_UNCLAIMED');
		expect(result.notify).toBe(false);
		expect(mocks.userCreate).not.toHaveBeenCalled();
	});

	it('SECURITY: the unknown-email and other-org-UNCLAIMED branches are indistinguishable', async () => {
		// Security §7 accepted account enumeration by reasoning about two
		// branches. There are three. If the other-org-UNCLAIMED case is
		// distinguishable from the unknown-email case, the coordinator learns
		// that ANOTHER ORGANISATION already has this person on their roster —
		// cross-org membership disclosure, which §7 never accepted.
		mocks.userFindUnique.mockResolvedValue(null);
		const created = await addVolunteer(baseInput());

		vi.clearAllMocks();
		mocks.findLiveOrgVolunteer.mockResolvedValue(null);
		mocks.createOrgVolunteer.mockResolvedValue({ id: 'ov-2' });
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-other-org',
			name: 'Ada',
			accountState: 'UNCLAIMED',
		});
		const linked = await addVolunteer(baseInput());

		// Both must be silent, so neither leaks via an email side effect.
		expect(created.notify).toBe(linked.notify);
		expect(created.notify).toBe(false);
		// And both are declared indistinguishable for the UI layer (T25).
		expect(INDISTINGUISHABLE_OUTCOMES).toContain(created.outcome);
		expect(INDISTINGUISHABLE_OUTCOMES).toContain(linked.outcome);
	});

	it('sets User.name when it is null (first-writer-wins)', async () => {
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-1',
			name: null,
			accountState: 'ACTIVE',
		});

		await addVolunteer(baseInput({ displayName: 'Grace Hopper' }));

		expect(mocks.userUpdate).toHaveBeenCalledWith({
			where: { id: 'user-1' },
			data: { name: 'Grace Hopper' },
		});
	});

	it('does NOT overwrite an existing User.name', async () => {
		// Overwriting would let org B rename a person across every surface that
		// reads User.name — credentials, background-check screens and emails.
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-1',
			name: 'Existing Name',
			accountState: 'ACTIVE',
		});

		await addVolunteer(baseInput({ displayName: 'Different Name' }));

		expect(mocks.userUpdate).not.toHaveBeenCalled();
	});

	it('normalizes the email to the same form the DB trigger stores', async () => {
		mocks.userFindUnique.mockResolvedValue(null);

		await addVolunteer(baseInput({ email: '  Ada@Example.COM ' }));

		expect(mocks.userFindUnique).toHaveBeenCalledWith(
			expect.objectContaining({ where: { email: 'ada@example.com' } }),
		);
		expect(mocks.userCreate.mock.calls[0][0].data.email).toBe(
			'ada@example.com',
		);
	});

	it('rejects a volunteer already on the live roster as CONFLICT', async () => {
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-1',
			name: 'Ada',
			accountState: 'ACTIVE',
		});
		mocks.findLiveOrgVolunteer.mockResolvedValue({ id: 'existing' });

		await expect(addVolunteer(baseInput())).rejects.toMatchObject({
			code: 'CONFLICT',
			message: 'Already on your roster',
		});
	});

	it('maps a concurrent P2002 to the same CONFLICT message', async () => {
		// Two coordinators adding the same email at once: findLiveOrgVolunteer
		// passes for both and the partial unique index rejects the loser.
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-1',
			name: 'Ada',
			accountState: 'ACTIVE',
		});
		mocks.createOrgVolunteer.mockRejectedValue(p2002());

		await expect(addVolunteer(baseInput())).rejects.toMatchObject({
			code: 'CONFLICT',
			message: 'Already on your roster',
		});
	});

	it('writes a VOLUNTEER_ADDED audit row stamped with impersonatedBy', async () => {
		mocks.userFindUnique.mockResolvedValue(null);

		await addVolunteer(baseInput({ impersonatedBy: 'real-admin' }));

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				orgId: ORG,
				actorId: ACTOR,
				action: 'VOLUNTEER_ADDED',
				entityType: 'OrgVolunteer',
				entityId: 'ov-1',
				metadata: expect.objectContaining({ impersonatedBy: 'real-admin' }),
			}),
		);
	});

	it('omits impersonatedBy when not impersonating', async () => {
		mocks.userFindUnique.mockResolvedValue(null);

		await addVolunteer(baseInput());

		const metadata = mocks.writeAuditLogTx.mock.calls[0][1].metadata;
		expect(metadata).not.toHaveProperty('impersonatedBy');
	});

	it('emails ONLY the ACTIVE branch (T12)', async () => {
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-active',
			name: 'Ada',
			accountState: 'ACTIVE',
		});

		await addVolunteer(baseInput());
		await flushNotifications();

		expect(mocks.sendRosterAddedEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'ada@example.com',
				orgName: 'Helping Hands',
			}),
		);
	});

	it('SECURITY: sends NO email for the shadow-mint branch', async () => {
		// The address may be a typo, and nobody has asked to hear from us.
		mocks.userFindUnique.mockResolvedValue(null);

		await addVolunteer(baseInput());
		await flushNotifications();

		expect(mocks.sendRosterAddedEmail).not.toHaveBeenCalled();
	});

	it('SECURITY: sends NO email for the other-org-UNCLAIMED branch', async () => {
		// Mailing here would tell the recipient that some OTHER org had already
		// put them on a roster — a disclosure §7 never accepted.
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-other-org',
			name: 'Ada',
			accountState: 'UNCLAIMED',
		});

		await addVolunteer(baseInput());
		await flushNotifications();

		expect(mocks.sendRosterAddedEmail).not.toHaveBeenCalled();
	});

	it('still returns success when the notification send fails', async () => {
		// Resend being down must not roll back a roster row the coordinator can
		// already see. The failure mode is "one email missing", not "row vanished".
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-active',
			name: 'Ada',
			accountState: 'ACTIVE',
		});
		mocks.sendRosterAddedEmail.mockRejectedValue(new Error('Resend is down'));
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});

		const result = await addVolunteer(baseInput());
		await flushNotifications();

		expect(result.volunteerId).toBe('ov-1');
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});
});

describe('removeVolunteer', () => {
	it('soft-deletes and audits VOLUNTEER_REMOVED', async () => {
		mocks.softDeleteOrgVolunteer.mockResolvedValue(1);

		await removeVolunteer({ orgId: ORG, volunteerId: 'ov-1', actorId: ACTOR });

		expect(mocks.softDeleteOrgVolunteer).toHaveBeenCalledWith(
			fakeTx,
			ORG,
			'ov-1',
		);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({ action: 'VOLUNTEER_REMOVED' }),
		);
	});

	it('SECURITY: a row that does not belong to this org is NOT_FOUND', async () => {
		// The repo scopes its updateMany by orgId, so a crafted id from another
		// org matches nothing and comes back as a zero count.
		mocks.softDeleteOrgVolunteer.mockResolvedValue(0);

		await expect(
			removeVolunteer({ orgId: ORG, volunteerId: 'other-org', actorId: ACTOR }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});
});

describe('restoreVolunteer', () => {
	it('restores the same row and audits VOLUNTEER_RESTORED', async () => {
		mocks.restoreOrgVolunteer.mockResolvedValue(1);

		await restoreVolunteer({ orgId: ORG, volunteerId: 'ov-1', actorId: ACTOR });

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				action: 'VOLUNTEER_RESTORED',
				entityId: 'ov-1',
			}),
		);
	});

	it('reports a clear conflict when they were re-added before the undo', async () => {
		// Restoring would violate the partial unique index against the new live
		// row. The user's intent is already satisfied, so say so plainly.
		mocks.restoreOrgVolunteer.mockRejectedValue(p2002());

		await expect(
			restoreVolunteer({ orgId: ORG, volunteerId: 'ov-1', actorId: ACTOR }),
		).rejects.toMatchObject({
			code: 'CONFLICT',
			message: 'They are already back on your roster.',
		});
	});

	it('is NOT_FOUND when the removal is too old to undo', async () => {
		mocks.restoreOrgVolunteer.mockResolvedValue(0);

		await expect(
			restoreVolunteer({ orgId: ORG, volunteerId: 'gone', actorId: ACTOR }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});
});

describe('P2002 discrimination', () => {
	// Two coordinators at DIFFERENT orgs adding the same brand-new address race
	// on User.email, not on the roster index. Reporting that as "Already on your
	// roster" is false about their own roster AND an oracle that the address now
	// exists platform-wide.
	it('SECURITY: a User-email P2002 is NOT reported as a roster duplicate', async () => {
		mocks.userFindUnique.mockResolvedValue(null);
		mocks.userCreate.mockRejectedValue(p2002('User', 'User_email_key'));

		await expect(addVolunteer(baseInput())).rejects.not.toMatchObject({
			message: 'Already on your roster',
		});
	});

	it('a roster P2002 IS reported as a roster duplicate', async () => {
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-1',
			name: 'Ada',
			accountState: 'ACTIVE',
		});
		mocks.createOrgVolunteer.mockRejectedValue(p2002());

		await expect(addVolunteer(baseInput())).rejects.toMatchObject({
			code: 'CONFLICT',
			message: 'Already on your roster',
		});
	});
});

/**
 * T32 — the volunteer's own exit from a roster edge staff created without asking.
 *
 * The security predicate lives in the repository's WHERE (`softDeleteOwnOrgVolunteer`
 * scopes by `userId`), which these tests can only observe as "the repo returned
 * null". The predicate itself is proven against real Postgres in
 * `orgVolunteer.integration.test.ts`; what this suite pins is that the service
 * refuses rather than auditing a departure that never happened.
 */
describe('leaveOrgRoster', () => {
	const VOLUNTEER = 'user-42';

	it('soft-deletes the edge and audits VOLUNTEER_LEFT against the row own org', async () => {
		mocks.softDeleteOwnOrgVolunteer.mockResolvedValue(ORG);

		const result = await leaveOrgRoster({
			userId: VOLUNTEER,
			volunteerId: 'ov-1',
		});

		expect(result).toEqual({ id: 'ov-1' });
		expect(mocks.softDeleteOwnOrgVolunteer).toHaveBeenCalledWith(
			fakeTx,
			VOLUNTEER,
			'ov-1',
		);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				// orgId comes from the ROW, not from any caller input — the volunteer
				// never names an org, so this is the only way the audit row can be
				// scoped to the org that loses them.
				orgId: ORG,
				actorId: VOLUNTEER,
				action: 'VOLUNTEER_LEFT',
				entityType: 'OrgVolunteer',
				entityId: 'ov-1',
			}),
		);
	});

	it('refuses and audits NOTHING whenever the repo reports no row', async () => {
		// The repo collapses three causes to one `null` — an unknown id, someone
		// else's id, and a row a concurrent leave already claimed — so this pins
		// the service's response to all three at once: refuse, and write no audit
		// row. That last assertion is the load-bearing one. A departure that never
		// happened must not be recorded, and a concurrent leave must not be
		// recorded twice for a single edge.
		//
		// It does NOT pin the userId predicate itself: the mock is what returns
		// null here, so the WHERE clause could be deleted and this stays green.
		// That predicate is proven against real Postgres in
		// `orgVolunteer.integration.test.ts` ("SECURITY: cannot leave a roster on
		// someone else's behalf"), and its shape in `orgVolunteerRepo.leave.test.ts`.
		mocks.softDeleteOwnOrgVolunteer.mockResolvedValue(null);

		await expect(
			leaveOrgRoster({ userId: VOLUNTEER, volunteerId: 'someone-elses-row' }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('stamps impersonatedBy when an admin leaves on the volunteer behalf', async () => {
		mocks.softDeleteOwnOrgVolunteer.mockResolvedValue(ORG);

		await leaveOrgRoster({
			userId: VOLUNTEER,
			volunteerId: 'ov-1',
			impersonatedBy: 'real-admin',
		});

		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				actorId: VOLUNTEER,
				metadata: expect.objectContaining({ impersonatedBy: 'real-admin' }),
			}),
		);
	});

	it('omits impersonatedBy entirely when the volunteer acts for themselves', async () => {
		// Not `impersonatedBy: null` — an always-present key makes every row look
		// like it was considered for impersonation and defeats a metadata filter.
		mocks.softDeleteOwnOrgVolunteer.mockResolvedValue(ORG);

		await leaveOrgRoster({ userId: VOLUNTEER, volunteerId: 'ov-1' });

		const [, entry] = mocks.writeAuditLogTx.mock.calls[0];
		expect(entry.metadata).not.toHaveProperty('impersonatedBy');
	});
});
