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
	findOrgVolunteerById: vi.fn(),
	listAttendedShiftsForUserInOrg: vi.fn(),
	createOrgVolunteer: vi.fn(),
	softDeleteOrgVolunteer: vi.fn(),
	softDeleteOwnOrgVolunteerByOrg: vi.fn(),
	hasLeavableOrgRelationship: vi.fn(),
	restoreOrgVolunteer: vi.fn(),
	createOrgVolunteerBlock: vi.fn(),
	findOrgVolunteerBlock: vi.fn(),
	findRemovedOrgVolunteer: vi.fn(),
	writeAuditLogTx: vi.fn(),
	orgFindUnique: vi.fn(),
	sendRosterAddedEmail: vi.fn(),
	waitUntil: vi.fn(),
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

// The pass-through is re-applied in `beforeEach`, NOT here: `vi.resetAllMocks()`
// strips `mockImplementation`, so setting it at mock-definition time leaves a
// bare no-op spy in every test. The notification still runs either way because
// the promise is built eagerly as the call argument — but a future change to a
// lazier shape (`waitUntil(() => notify(...))`) would silently stop executing it,
// and the comment would be the thing that misled whoever debugged that.
vi.mock('@vercel/functions', () => ({
	waitUntil: mocks.waitUntil,
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	writeAuditLogTx: mocks.writeAuditLogTx,
}));

vi.mock('@/server/repositories/orgVolunteerRepo', () => ({
	findLiveOrgVolunteer: mocks.findLiveOrgVolunteer,
	findOrgVolunteerById: mocks.findOrgVolunteerById,
	listAttendedShiftsForUserInOrg: mocks.listAttendedShiftsForUserInOrg,
	createOrgVolunteer: mocks.createOrgVolunteer,
	softDeleteOrgVolunteer: mocks.softDeleteOrgVolunteer,
	softDeleteOwnOrgVolunteerByOrg: mocks.softDeleteOwnOrgVolunteerByOrg,
	restoreOrgVolunteer: mocks.restoreOrgVolunteer,
	createOrgVolunteerBlock: mocks.createOrgVolunteerBlock,
	findOrgVolunteerBlock: mocks.findOrgVolunteerBlock,
	findRemovedOrgVolunteer: mocks.findRemovedOrgVolunteer,
	listOrgVolunteers: vi.fn(),
	listMyOrgRelationships: vi.fn(),
	hasLeavableOrgRelationship: mocks.hasLeavableOrgRelationship,
	countOrgVolunteers: vi.fn(),
	countAttendedShiftsByUser: vi.fn(),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	INDISTINGUISHABLE_OUTCOMES,
	SHIFT_HISTORY_WIRE_CAP,
} from '@/server/domain/org-volunteer';
import { p2002Error } from '@/test/prisma-error-fixtures';
import {
	addVolunteer,
	getVolunteerDetail,
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
	// Unblocked is the default; the block describe below overrides it.
	mocks.findOrgVolunteerBlock.mockResolvedValue(null);
	mocks.createOrgVolunteerBlock.mockResolvedValue({ id: 'block-1' });
	mocks.findRemovedOrgVolunteer.mockResolvedValue({
		id: 'ov-1',
		userId: 'user-1',
	});
	mocks.createOrgVolunteer.mockResolvedValue({ id: 'ov-1' });
	mocks.userCreate.mockResolvedValue({ id: 'user-new' });
	mocks.orgFindUnique.mockResolvedValue({ name: 'Helping Hands' });
	// `true`, not `undefined`. `sendRosterAddedEmail` returns whether the send
	// actually happened, and `notifyRosterAdd` logs NOTICE NOT SENT on a falsy
	// result — so a mock resolving `undefined` fires that branch on every ACTIVE
	// add, meaning the success path never executes in ANY test and the
	// send-failed test below passes for the wrong reason.
	mocks.sendRosterAddedEmail.mockResolvedValue(true);
	// Re-applied after resetAllMocks — see the @vercel/functions mock above.
	mocks.waitUntil.mockImplementation((p: Promise<unknown>) => p);
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

	it('SECURITY: refuses to add a volunteer who has blocked this org', async () => {
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-1',
			name: 'Ada',
			accountState: 'ACTIVE',
		});
		mocks.findOrgVolunteerBlock.mockResolvedValue({ id: 'block-1' });

		// The whole point of the block: `addVolunteer` takes an email and needs no
		// consent, so without this refusal staff undo a volunteer's departure in
		// one call and the exit revokes nothing durable.
		await expect(addVolunteer(baseInput())).rejects.toMatchObject({
			code: 'FORBIDDEN',
		});

		expect(mocks.createOrgVolunteer).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('SECURITY: the block is checked against the resolved user, not the raw email', async () => {
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-1',
			name: 'Ada',
			accountState: 'ACTIVE',
		});
		mocks.findOrgVolunteerBlock.mockResolvedValue(null);

		await addVolunteer(baseInput({ email: 'ADA@Example.com ' }));

		// Blocks key on (orgId, userId). Checking a caller-supplied address instead
		// would miss whenever the same person's row is reached by a different
		// spelling — the exact failure `normalizeEmail` exists to prevent.
		expect(mocks.findOrgVolunteerBlock).toHaveBeenCalledWith(
			ORG,
			'user-1',
			fakeTx,
		);
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

	it('hands the notice to waitUntil, not a bare floating promise', async () => {
		// On Vercel the function can be frozen as soon as the tRPC response is
		// written, so a floating `void` promise races the freeze — and the thing
		// dropped is the only notice telling this person they are on a roster,
		// carrying the only link to the page where they can leave it.
		//
		// Without this assertion, "simplifying" `waitUntil(p)` back to `void p` is
		// invisible to the entire suite (the promise is built eagerly either way)
		// and breaks in production only. Same test `backgroundCheckService` carries
		// for the same reason.
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-active',
			name: 'Ada',
			accountState: 'ACTIVE',
		});

		await addVolunteer(baseInput());
		await flushNotifications();

		expect(mocks.waitUntil).toHaveBeenCalledTimes(1);
		expect(mocks.waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
	});

	it('does not reach waitUntil for a branch that owes no notice', async () => {
		// The contrast case. Without it the assertion above passes for a service
		// that wraps every add, including the two branches that must send nothing.
		mocks.userFindUnique.mockResolvedValue(null);

		await addVolunteer(baseInput());
		await flushNotifications();

		expect(mocks.waitUntil).not.toHaveBeenCalled();
	});

	it('still returns success when the notification send THROWS', async () => {
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

	it('logs NOTICE NOT SENT when the send RESOLVES FALSE', async () => {
		// `sendEmail` returns `false` — it does not throw — for a Resend error and
		// for a bounce-suppressed address, so the throw test above never exercised
		// the likeliest failure. Both are needed; neither implies the other.
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-active',
			name: 'Ada',
			accountState: 'ACTIVE',
		});
		mocks.sendRosterAddedEmail.mockResolvedValue(false);
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});

		const result = await addVolunteer(baseInput());
		await flushNotifications();

		expect(result.volunteerId).toBe('ov-1');
		expect(consoleError).toHaveBeenCalledWith(
			expect.stringContaining('NOTICE NOT SENT'),
		);
		consoleError.mockRestore();
	});

	it('logs NOTHING on the success path', async () => {
		// The contrast that makes the two failure assertions above mean something.
		// A stale `mockResolvedValue(undefined)` in the shared setup used to fire
		// the NOTICE NOT SENT branch on EVERY active add, so the success path never
		// ran and the throw test passed with its rejection removed.
		mocks.userFindUnique.mockResolvedValue({
			id: 'user-active',
			name: 'Ada',
			accountState: 'ACTIVE',
		});
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});

		await addVolunteer(baseInput());
		await flushNotifications();

		expect(consoleError).not.toHaveBeenCalled();
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

	it('a staff removal is NOT a volunteer refusal, so it writes no block', async () => {
		mocks.softDeleteOrgVolunteer.mockResolvedValue(1);

		await removeVolunteer({ orgId: ORG, volunteerId: 'ov-1', actorId: ACTOR });

		// The contrast to leaveOrgRoster, which DOES write one. The whole premise
		// is that these are different acts by different parties. A future edit
		// "making them consistent" by adding createOrgVolunteerBlock here would
		// pass every other test in this file while permanently breaking staff's own
		// Undo — restoreVolunteer now refuses while a block stands.
		expect(mocks.createOrgVolunteerBlock).not.toHaveBeenCalled();
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
	it('SECURITY: refuses to restore a volunteer who has blocked this org', async () => {
		mocks.findOrgVolunteerBlock.mockResolvedValue({ id: 'block-1' });

		// The fourth roster-creating path, and the one that does not look like a
		// create. `restoreOrgVolunteer` matches ANY row with deletedAt set for the
		// org, and a volunteer's own leave produces exactly such a row — nothing on
		// OrgVolunteer records who deleted it. Without this check staff undo a
		// departure the volunteer chose, using an id their roster page handed them
		// before the volunteer left. Found by five independent review specialists.
		await expect(
			restoreVolunteer({ orgId: ORG, volunteerId: 'ov-1', actorId: ACTOR }),
		).rejects.toMatchObject({ code: 'FORBIDDEN' });

		expect(mocks.restoreOrgVolunteer).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('checks the block against the removed row own userId', async () => {
		mocks.findRemovedOrgVolunteer.mockResolvedValue({
			id: 'ov-1',
			userId: 'user-99',
		});
		mocks.restoreOrgVolunteer.mockResolvedValue(1);

		await restoreVolunteer({ orgId: ORG, volunteerId: 'ov-1', actorId: ACTOR });

		// The caller supplies an OrgVolunteer.id, never a userId — blocks are keyed
		// on (orgId, userId), so the id has to be resolved through the row first or
		// the lookup silently checks nothing.
		expect(mocks.findOrgVolunteerBlock).toHaveBeenCalledWith(
			ORG,
			'user-99',
			fakeTx,
		);
	});

	it('is NOT_FOUND when the row to restore no longer exists', async () => {
		mocks.findRemovedOrgVolunteer.mockResolvedValue(null);

		await expect(
			restoreVolunteer({ orgId: ORG, volunteerId: 'ov-1', actorId: ACTOR }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		expect(mocks.restoreOrgVolunteer).not.toHaveBeenCalled();
	});

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
 * T32 — the volunteer's own exit, widened in v0.37.0.0 from "leave a roster" to
 * "revoke this org's access".
 *
 * Keyed on `orgId` now, not `OrgVolunteer.id`. The roster row became the
 * OPTIONAL half: an org holding only an application or a shift signup has no
 * roster row at all, still has access, and must still be leavable — otherwise
 * an org denies the remedy by removing the volunteer first.
 *
 * The security predicate lives in the repository's WHERE
 * (`softDeleteOwnOrgVolunteerByOrg` scopes by `userId`), which these tests can
 * only observe as "the repo returned null". The predicate itself is proven
 * against real Postgres in `orgVolunteer.integration.test.ts`; what this suite
 * pins is the service's own decisions.
 */
describe('leaveOrgRoster', () => {
	const VOLUNTEER = 'user-42';

	beforeEach(() => {
		// Default: a real relationship exists and is not yet blocked.
		mocks.hasLeavableOrgRelationship.mockResolvedValue(true);
	});

	it('soft-deletes the roster row and audits VOLUNTEER_LEFT against the named org', async () => {
		mocks.softDeleteOwnOrgVolunteerByOrg.mockResolvedValue('ov-1');

		const result = await leaveOrgRoster({ userId: VOLUNTEER, orgId: ORG });

		expect(result).toEqual({ orgId: ORG });
		expect(mocks.softDeleteOwnOrgVolunteerByOrg).toHaveBeenCalledWith(
			fakeTx,
			VOLUNTEER,
			ORG,
		);
		expect(mocks.writeAuditLogTx).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				orgId: ORG,
				actorId: VOLUNTEER,
				action: 'VOLUNTEER_LEFT',
				entityType: 'OrgVolunteer',
				entityId: 'ov-1',
			}),
		);
	});

	it('SECURITY: writes the block on the same tx handle as the soft delete', async () => {
		mocks.softDeleteOwnOrgVolunteerByOrg.mockResolvedValue('ov-1');

		await leaveOrgRoster({ userId: VOLUNTEER, orgId: ORG });

		// The half of leaving that actually revokes. Without it, an APPLICATION the
		// volunteer sent or a SHIFT_SIGNUP staff created keeps satisfying
		// requireOrgVolunteerRelationship forever — and addVolunteer can recreate
		// the roster row from an email address regardless.
		expect(mocks.createOrgVolunteerBlock).toHaveBeenCalledWith(
			fakeTx,
			ORG,
			VOLUNTEER,
		);
	});

	it('revokes an org that has NO roster row — the whole point of the widening', async () => {
		// Application-only or shift-only. Under the id-keyed version this org never
		// appeared on the volunteer's list and had no Leave button, so an org could
		// pre-empt a departure it saw coming by removing the volunteer first and
		// keeping everything the surviving edges authorize.
		mocks.softDeleteOwnOrgVolunteerByOrg.mockResolvedValue(null);

		const result = await leaveOrgRoster({ userId: VOLUNTEER, orgId: ORG });

		expect(result).toEqual({ orgId: ORG });
		// The block is written even though nothing was soft-deleted.
		expect(mocks.createOrgVolunteerBlock).toHaveBeenCalledWith(
			fakeTx,
			ORG,
			VOLUNTEER,
		);
	});

	it('audits against the user, not a roster row, when there was no roster row', async () => {
		mocks.softDeleteOwnOrgVolunteerByOrg.mockResolvedValue(null);

		await leaveOrgRoster({ userId: VOLUNTEER, orgId: ORG });

		const [, entry] = mocks.writeAuditLogTx.mock.calls[0];
		// Pointing at a stale or absent OrgVolunteer id would be worse than
		// pointing at the person the entry is actually about.
		expect(entry).toMatchObject({
			entityType: 'OrgVolunteerBlock',
			entityId: VOLUNTEER,
		});
		expect(entry.metadata).toMatchObject({ hadRosterRow: false });
	});

	it('SECURITY: refuses an org the caller has no relationship with', async () => {
		mocks.hasLeavableOrgRelationship.mockResolvedValue(false);

		await expect(
			leaveOrgRoster({ userId: VOLUNTEER, orgId: 'org-never-heard-of' }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		// orgId is caller-supplied now, so without this precondition any
		// authenticated user could mint block rows against arbitrary orgs.
		expect(mocks.createOrgVolunteerBlock).not.toHaveBeenCalled();
		expect(mocks.softDeleteOwnOrgVolunteerByOrg).not.toHaveBeenCalled();
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('checks the relationship BEFORE writing anything', async () => {
		mocks.hasLeavableOrgRelationship.mockResolvedValue(false);

		await leaveOrgRoster({ userId: VOLUNTEER, orgId: ORG }).catch(() => {});

		// A stranger's orgId must not reach a write statement at all, not even one
		// that would match zero rows.
		expect(mocks.hasLeavableOrgRelationship).toHaveBeenCalledWith(
			fakeTx,
			ORG,
			VOLUNTEER,
		);
	});

	it('refuses a second leave rather than double-auditing one departure', async () => {
		mocks.findOrgVolunteerBlock.mockResolvedValue({ id: 'block-1' });

		await expect(
			leaveOrgRoster({ userId: VOLUNTEER, orgId: ORG }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		// Reachable from a stale tab: the listing filters blocked orgs out, so the
		// only way here is a client that has not refetched. The upsert would make
		// the write itself harmless, but the audit row would count one departure
		// twice.
		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});

	it('stamps impersonatedBy when an admin leaves on the volunteer behalf', async () => {
		mocks.softDeleteOwnOrgVolunteerByOrg.mockResolvedValue('ov-1');

		await leaveOrgRoster({
			userId: VOLUNTEER,
			orgId: ORG,
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
		mocks.softDeleteOwnOrgVolunteerByOrg.mockResolvedValue('ov-1');

		await leaveOrgRoster({ userId: VOLUNTEER, orgId: ORG });

		const [, entry] = mocks.writeAuditLogTx.mock.calls[0];
		expect(entry.metadata).not.toHaveProperty('impersonatedBy');
	});
});

describe('getVolunteerDetail', () => {
	const ROSTER_ROW = {
		id: 'ov-1',
		displayName: 'Maria Garcia',
		phone: '555-0100',
		source: 'STAFF_ADDED' as const,
		createdAt: new Date('2026-03-01T00:00:00Z'),
		addedByUserId: ACTOR,
		userId: 'user-maria',
		user: {
			id: 'user-maria',
			email: 'maria@example.com',
			accountState: 'UNCLAIMED' as const,
		},
	};

	beforeEach(() => {
		mocks.findOrgVolunteerById.mockResolvedValue(ROSTER_ROW);
		mocks.listAttendedShiftsForUserInOrg.mockResolvedValue([]);
	});

	it('SECURITY: a volunteerId from another org is NOT_FOUND', async () => {
		// This throw IS the authorization outcome. `findOrgVolunteerById` carries
		// orgId inside its WHERE, so a crafted id from another tenant resolves to
		// null — which is the entire reason this procedure needs no
		// requireOrgVolunteerRelationship. Nothing else in the suite exercises the
		// refusal: the router test mocks this service away, the integration test
		// covers the repo underneath it, and the e2e only walks the happy path.
		mocks.findOrgVolunteerById.mockResolvedValue(null);

		await expect(
			getVolunteerDetail({ orgId: ORG, volunteerId: 'ov-from-other-org' }),
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		// And it refuses BEFORE reading any shift history, so a foreign id cannot
		// be used to probe another org's data even for timing.
		expect(mocks.listAttendedShiftsForUserInOrg).not.toHaveBeenCalled();
	});

	it('SECURITY: scopes the lookup by the CALLING org, not by the id alone', async () => {
		await getVolunteerDetail({ orgId: ORG, volunteerId: 'ov-1' });

		expect(mocks.findOrgVolunteerById).toHaveBeenCalledWith(ORG, 'ov-1');
	});

	it('SECURITY: never returns userId, including inside shift rows', async () => {
		// User.id is shared across orgs by design in the shadow-user model, so
		// putting it on the wire hands one org a stable global identifier for a
		// person. The service comment says so; without this test a future edit
		// spreading `...volunteer` into the return would pass everything else.
		// A non-empty history on purpose: the shift rows are where a widened repo
		// `select` would leak, and with an empty list the assertion below cannot
		// reach the projection at all. The extra `userId` here stands in for that
		// future widening.
		mocks.listAttendedShiftsForUserInOrg.mockResolvedValue([
			{
				shiftId: 'sh-1',
				title: 'Saturday morning',
				startTime: new Date('2026-03-07T09:00:00Z'),
				endTime: new Date('2026-03-07T12:00:00Z'),
				userId: 'user-maria',
			},
		]);

		const detail = await getVolunteerDetail({
			orgId: ORG,
			volunteerId: 'ov-1',
		});

		expect(detail).not.toHaveProperty('userId');
		expect(Object.keys(detail.shifts[0]).sort()).toEqual([
			'endTime',
			'hours',
			'shiftId',
			'startTime',
			'title',
		]);
		expect(JSON.stringify(detail)).not.toContain('user-maria');
	});

	it('caps what it SENDS but counts and sums everything', async () => {
		// The invariant the wire cap has to preserve: `shiftCount` and
		// `totalHours` must still match the roster row's uncapped Shifts cell.
		mocks.listAttendedShiftsForUserInOrg.mockResolvedValue(
			Array.from({ length: SHIFT_HISTORY_WIRE_CAP + 5 }, (_, i) => ({
				shiftId: `sh-${i}`,
				title: `Shift ${i}`,
				startTime: new Date('2026-03-07T09:00:00Z'),
				endTime: new Date('2026-03-07T10:00:00Z'),
			})),
		);

		const detail = await getVolunteerDetail({
			orgId: ORG,
			volunteerId: 'ov-1',
		});

		expect(detail.shifts).toHaveLength(SHIFT_HISTORY_WIRE_CAP);
		expect(detail.shiftCount).toBe(SHIFT_HISTORY_WIRE_CAP + 5);
		expect(detail.totalHours).toBe(SHIFT_HISTORY_WIRE_CAP + 5);
	});

	it('reads history with the RESOLVED userId, not the roster row id', async () => {
		// Passing input.volunteerId here would return an empty list rather than an
		// error, so the only symptom would be a dialog quietly claiming this
		// volunteer has never worked a shift.
		await getVolunteerDetail({ orgId: ORG, volunteerId: 'ov-1' });

		expect(mocks.listAttendedShiftsForUserInOrg).toHaveBeenCalledWith(
			ORG,
			'user-maria',
		);
	});

	it('sums hours across every attended row and stamps each row with its own', async () => {
		mocks.listAttendedShiftsForUserInOrg.mockResolvedValue([
			{
				shiftId: 'sh-1',
				title: 'Saturday morning',
				startTime: new Date('2026-03-07T09:00:00Z'),
				endTime: new Date('2026-03-07T12:00:00Z'),
			},
			{
				shiftId: 'sh-2',
				title: 'Sunday intake',
				startTime: new Date('2026-03-08T09:00:00Z'),
				endTime: new Date('2026-03-08T11:30:00Z'),
			},
		]);

		const detail = await getVolunteerDetail({
			orgId: ORG,
			volunteerId: 'ov-1',
		});

		expect(detail.totalHours).toBe(5.5);
		expect(detail.shifts.map((s) => s.hours)).toEqual([3, 2.5]);
	});

	it('returns the org-owned facts the dialog renders', async () => {
		const detail = await getVolunteerDetail({
			orgId: ORG,
			volunteerId: 'ov-1',
		});

		expect(detail).toMatchObject({
			id: 'ov-1',
			displayName: 'Maria Garcia',
			email: 'maria@example.com',
			phone: '555-0100',
			accountState: 'UNCLAIMED',
			source: 'STAFF_ADDED',
			totalHours: 0,
			shiftCount: 0,
			shifts: [],
		});
	});

	it('writes no audit row — this is a read', async () => {
		// Every other export in this file mutates and audits. Pattern-matching
		// them would put a row in the org's audit log every time a coordinator
		// opened a dialog, which is noise that buries the real entries.
		await getVolunteerDetail({ orgId: ORG, volunteerId: 'ov-1' });

		expect(mocks.writeAuditLogTx).not.toHaveBeenCalled();
	});
});
