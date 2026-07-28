/**
 * Integration tests for `createOrgVolunteerIfAbsent` (E1a roster convergence).
 *
 * Uses real Postgres. Requires DATABASE_URL. Run with: pnpm test:integration
 *
 * WHY THESE MUST BE INTEGRATION TESTS
 * -----------------------------------
 * Every claim this function rests on is a property of the database engine, and a
 * mocked Prisma client asserts none of them:
 *
 *   1. A P2002 swallowed INSIDE an interactive transaction poisons that
 *      transaction — Postgres refuses every later statement with "current
 *      transaction is aborted". This is why E1a does NOT use the
 *      findFirst-then-create-then-catch shape that `addVolunteer` uses and the
 *      design doc originally prescribed: the enclosing transaction has to COMMIT
 *      (it carries the application approval, or the claim and its audit row), and
 *      a concurrent roster race would otherwise roll the approval back.
 *   2. `createMany({ skipDuplicates: true })` compiles to `ON CONFLICT DO
 *      NOTHING`, which Postgres resolves without raising, so the transaction
 *      survives and later statements still commit.
 *   3. `ON CONFLICT DO NOTHING` honours the hand-written PARTIAL index
 *      (`WHERE "deletedAt" IS NULL`), so a soft-deleted row does not suppress a
 *      fresh insert.
 *
 * Test 1 is the load-bearing one: if Postgres ever stopped aborting the
 * transaction, the simpler shape would become available and this design could be
 * revisited. If `skipDuplicates` ever stopped honouring the partial index, E1a
 * would silently stop re-adding previously-removed volunteers.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import {
	createOrgVolunteerIfAbsent,
	findLiveOrgVolunteer,
} from './orgVolunteerRepo';

const PREFIX = '__appliedroster_integration__';

const createdOrgIds: string[] = [];
const createdUserIds: string[] = [];

async function fixture(suffix: string) {
	const org = await prisma.organization.create({
		data: { name: `${PREFIX}${suffix}`, slug: `${PREFIX}${suffix}` },
	});
	const user = await prisma.user.create({
		data: {
			email: `${PREFIX}${suffix}@example.test`,
			accountState: 'UNCLAIMED',
		},
	});
	createdOrgIds.push(org.id);
	createdUserIds.push(user.id);
	return { org, user };
}

function row(orgId: string, userId: string) {
	return {
		orgId,
		userId,
		displayName: 'Applied Volunteer',
		source: 'APPLIED' as const,
	};
}

// Deletes ONLY the ids this file created — never an unscoped prefix sweep, which
// could catch a sibling worker's live rows (CLAUDE.md).
afterEach(async () => {
	if (createdOrgIds.length > 0) {
		await prisma.auditLog.deleteMany({
			where: { orgId: { in: createdOrgIds } },
		});
		await prisma.orgVolunteer.deleteMany({
			where: { orgId: { in: createdOrgIds } },
		});
		await prisma.organization.deleteMany({
			where: { id: { in: createdOrgIds } },
		});
		createdOrgIds.length = 0;
	}
	if (createdUserIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
		createdUserIds.length = 0;
	}
});

describe('transaction-abort semantics', () => {
	it('a P2002 swallowed inside a transaction poisons it — the reason for skipDuplicates', async () => {
		const { org, user } = await fixture('abort');
		await prisma.orgVolunteer.create({ data: row(org.id, user.id) });

		// Swallow the P2002 and then try to keep using the transaction, exactly as
		// the findFirst+create+catch shape would.
		const attempt = prisma.$transaction(async (tx) => {
			try {
				await tx.orgVolunteer.create({ data: row(org.id, user.id) });
			} catch (err) {
				if ((err as { code?: string }).code !== 'P2002') throw err;
			}
			// In a healthy transaction this commits. Here Postgres refuses it.
			await tx.auditLog.create({
				data: { action: 'PROBE', entityType: 'Probe', orgId: org.id },
			});
		});

		await expect(attempt).rejects.toThrow(/current transaction is aborted/i);

		// And nothing from that transaction landed.
		const audits = await prisma.auditLog.count({ where: { orgId: org.id } });
		expect(audits).toBe(0);
	});
});

describe('createOrgVolunteerIfAbsent', () => {
	it('inserts and reports true when no live edge exists', async () => {
		const { org, user } = await fixture('insert');

		const created = await prisma.$transaction((tx) =>
			createOrgVolunteerIfAbsent(tx, row(org.id, user.id)),
		);

		expect(created).toBe(true);
		expect(await findLiveOrgVolunteer(org.id, user.id)).not.toBeNull();
	});

	it('reports false and raises nothing when a live edge already exists', async () => {
		const { org, user } = await fixture('dup');
		await prisma.orgVolunteer.create({ data: row(org.id, user.id) });

		const created = await prisma.$transaction((tx) =>
			createOrgVolunteerIfAbsent(tx, row(org.id, user.id)),
		);

		expect(created).toBe(false);
		expect(await prisma.orgVolunteer.count({ where: { orgId: org.id } })).toBe(
			1,
		);
	});

	it('leaves the enclosing transaction usable after a conflict', async () => {
		// The whole point. The application approval that wraps this call must still
		// commit when the roster row turns out to already exist.
		const { org, user } = await fixture('survive');
		await prisma.orgVolunteer.create({ data: row(org.id, user.id) });

		const created = await prisma.$transaction(async (tx) => {
			const inserted = await createOrgVolunteerIfAbsent(
				tx,
				row(org.id, user.id),
			);
			// Would throw "current transaction is aborted" if the conflict had raised.
			await tx.auditLog.create({
				data: {
					action: 'STATUS_CHANGED',
					entityType: 'APPLICATION',
					orgId: org.id,
				},
			});
			return inserted;
		});

		expect(created).toBe(false);
		// The sibling write COMMITTED — proving the conflict was absorbed, not raised.
		expect(await prisma.auditLog.count({ where: { orgId: org.id } })).toBe(1);
	});

	it('honours the partial index: a soft-deleted edge does not block a fresh insert', async () => {
		// Makes re-approval after a deliberate removal re-add the volunteer rather
		// than silently skipping. Also why the transition gate in
		// `updateOrgApplicationStatus` is necessary — without it, re-saving an
		// already-APPROVED application would resurrect a removed volunteer.
		const { org, user } = await fixture('softdel');
		const first = await prisma.orgVolunteer.create({
			data: row(org.id, user.id),
		});
		await prisma.orgVolunteer.update({
			where: { id: first.id },
			data: { deletedAt: new Date() },
		});

		const created = await prisma.$transaction((tx) =>
			createOrgVolunteerIfAbsent(tx, row(org.id, user.id)),
		);

		expect(created).toBe(true);
		expect(await prisma.orgVolunteer.count({ where: { orgId: org.id } })).toBe(
			2,
		);
		const live = await findLiveOrgVolunteer(org.id, user.id);
		expect(live?.id).not.toBe(first.id);
	});

	it('persists source APPLIED, distinguishing it from a hand-typed add', async () => {
		const { org, user } = await fixture('source');

		await prisma.$transaction((tx) =>
			createOrgVolunteerIfAbsent(tx, row(org.id, user.id)),
		);

		const saved = await prisma.orgVolunteer.findFirst({
			where: { orgId: org.id },
			select: { source: true, addedByUserId: true },
		});
		expect(saved?.source).toBe('APPLIED');
		expect(saved?.addedByUserId).toBeNull();
	});
});
