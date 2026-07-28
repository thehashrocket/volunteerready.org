/**
 * Integration tests for the T5 claim flip.
 *
 * Uses real Postgres. Run with: pnpm test:integration
 *
 * WHY INTEGRATION AND NOT UNIT
 * ----------------------------
 * The whole design of `claimUnclaimedUser` is a compare-and-set: the state
 * predicate lives in the WHERE clause so the flip is idempotent by
 * construction and two concurrent sign-ins cannot both claim. A mocked Prisma
 * client returns whatever count the test tells it to, so it can only assert
 * that we wrote the query we wrote. Postgres is the thing that decides whether
 * the semantics are actually right.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import {
	claimUnclaimedUser,
	wasUserCreatedWithin,
} from '@/server/repositories/userAccountStateRepo';

const PREFIX = '__account_claim_integration__';

afterEach(async () => {
	await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

async function makeUser(
	local: string,
	accountState: 'ACTIVE' | 'UNCLAIMED',
	claimedAt: Date | null = null,
) {
	return prisma.user.create({
		data: { email: `${PREFIX}${local}@example.com`, accountState, claimedAt },
		select: { id: true },
	});
}

describe('claimUnclaimedUser', () => {
	it('flips UNCLAIMED to ACTIVE and stamps claimedAt', async () => {
		const user = await makeUser('flip', 'UNCLAIMED');
		const at = new Date('2026-07-27T12:00:00.000Z');

		await expect(claimUnclaimedUser(user.id, at)).resolves.toBe(true);

		const after = await prisma.user.findUnique({ where: { id: user.id } });
		expect(after?.accountState).toBe('ACTIVE');
		expect(after?.claimedAt?.toISOString()).toBe(at.toISOString());
	});

	it('SECURITY: is idempotent — a second sign-in does not re-stamp claimedAt', async () => {
		// claimedAt answers "when did this person first show up?". An `update` by
		// id would overwrite it on every subsequent login, silently destroying
		// that answer.
		const user = await makeUser('idempotent', 'UNCLAIMED');
		const first = new Date('2026-07-27T12:00:00.000Z');
		const second = new Date('2026-08-01T12:00:00.000Z');

		await expect(claimUnclaimedUser(user.id, first)).resolves.toBe(true);
		await expect(claimUnclaimedUser(user.id, second)).resolves.toBe(false);

		const after = await prisma.user.findUnique({ where: { id: user.id } });
		expect(after?.claimedAt?.toISOString()).toBe(first.toISOString());
	});

	it('does not touch an already-ACTIVE user', async () => {
		// The overwhelmingly common case: every sign-in by every existing user.
		const user = await makeUser('active', 'ACTIVE');

		await expect(claimUnclaimedUser(user.id, new Date())).resolves.toBe(false);

		const after = await prisma.user.findUnique({ where: { id: user.id } });
		expect(after?.accountState).toBe('ACTIVE');
		expect(after?.claimedAt).toBeNull();
	});

	it('reports false rather than throwing for a user id that does not exist', async () => {
		// `update` would throw P2025 here and, since auth.ts awaits this on the
		// sign-in path, turn a stale id into a failed sign-in.
		await expect(
			claimUnclaimedUser('does-not-exist', new Date()),
		).resolves.toBe(false);
	});

	it('SECURITY: only one of two concurrent claims reports success', async () => {
		// A magic link clicked twice, or a retried OAuth callback. Both must not
		// report a claim — the audit row is written off this return value.
		const user = await makeUser('concurrent', 'UNCLAIMED');

		const results = await Promise.all([
			claimUnclaimedUser(user.id, new Date('2026-07-27T12:00:00.000Z')),
			claimUnclaimedUser(user.id, new Date('2026-07-27T12:00:01.000Z')),
		]);

		expect(results.filter(Boolean)).toHaveLength(1);

		const after = await prisma.user.findUnique({ where: { id: user.id } });
		expect(after?.accountState).toBe('ACTIVE');
	});

	it('claims only the named user, never a sibling', async () => {
		const target = await makeUser('target', 'UNCLAIMED');
		const bystander = await makeUser('bystander', 'UNCLAIMED');

		await claimUnclaimedUser(target.id, new Date());

		const other = await prisma.user.findUnique({
			where: { id: bystander.id },
		});
		expect(other?.accountState).toBe('UNCLAIMED');
		expect(other?.claimedAt).toBeNull();
	});
});

describe('wasUserCreatedWithin', () => {
	it('reports true for a row created moments ago', async () => {
		const user = await makeUser('fresh', 'ACTIVE');

		await expect(wasUserCreatedWithin(user.id, 5 * 60 * 1000)).resolves.toBe(
			true,
		);
	});

	it('SECURITY: reports false for a pre-existing row that was merely linked', async () => {
		// The staff-created volunteer case. createdAt is set by the database
		// default, so this backdates it the way a real shadow user would be.
		const user = await makeUser('stale', 'UNCLAIMED');
		await prisma.user.update({
			where: { id: user.id },
			data: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
		});

		await expect(wasUserCreatedWithin(user.id, 5 * 60 * 1000)).resolves.toBe(
			false,
		);
	});

	it('reports false for an id that does not exist', async () => {
		await expect(
			wasUserCreatedWithin('does-not-exist', 5 * 60 * 1000),
		).resolves.toBe(false);
	});
});
