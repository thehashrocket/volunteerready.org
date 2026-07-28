/**
 * Repository unit test for the ONE branch of `softDeleteOwnOrgVolunteer` that
 * Postgres cannot be made to demonstrate on demand (T32).
 *
 * `orgVolunteer.integration.test.ts` proves the security predicate and the
 * ordinary outcomes against a real database, which is where they belong. But
 * the lost-race branch — the read finds a live row, and by the time the UPDATE
 * runs a concurrent leave or a staff removal has already claimed it, so `count`
 * comes back 0 — needs two transactions interleaved at an exact point. Here it
 * is one stub.
 *
 * The branch matters because the return value is what stops `leaveOrgRoster`
 * writing a SECOND `VOLUNTEER_LEFT` audit row for a single departure. Returning
 * `row.orgId` unconditionally would look correct in every integration test in
 * the suite and double-count every two-tab leave in production.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./prisma', () => ({ prisma: {} }));

import { softDeleteOwnOrgVolunteer } from './orgVolunteerRepo';

function stubTx(row: { orgId: string } | null, updatedCount: number) {
	const findFirst = vi.fn().mockResolvedValue(row);
	const updateMany = vi.fn().mockResolvedValue({ count: updatedCount });
	return { tx: { orgVolunteer: { findFirst, updateMany } }, updateMany };
}

describe('softDeleteOwnOrgVolunteer — lost race', () => {
	it('returns null when the UPDATE matched nothing despite the read finding a row', async () => {
		const { tx } = stubTx({ orgId: 'org-1' }, 0);

		const result = await softDeleteOwnOrgVolunteer(
			tx as never,
			'user-1',
			'ov-1',
		);

		// Not 'org-1'. The winner of the race already wrote the audit row.
		expect(result).toBeNull();
	});

	it('SECURITY: scopes BOTH statements by userId, not just the read', async () => {
		// Documented as deliberate redundancy: either clause alone closes the
		// hole, so a mutation test on one of them stays green and neither is dead
		// code to be tidied away. Only an assertion on the query shapes keeps the
		// second one from being "simplified" out.
		const { tx, updateMany } = stubTx({ orgId: 'org-1' }, 1);

		await softDeleteOwnOrgVolunteer(tx as never, 'user-1', 'ov-1');

		expect(tx.orgVolunteer.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'ov-1', userId: 'user-1', deletedAt: null },
			}),
		);
		expect(updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'ov-1', userId: 'user-1', deletedAt: null },
			}),
		);
	});

	it('does not attempt the UPDATE at all when the read matched nothing', async () => {
		// A stranger's id must not reach a write statement even in a form that
		// would match zero rows — that is what keeps a future refactor of the
		// WHERE from turning this into a cross-user delete.
		const { tx, updateMany } = stubTx(null, 1);

		const result = await softDeleteOwnOrgVolunteer(
			tx as never,
			'attacker',
			'ov-victim',
		);

		expect(result).toBeNull();
		expect(updateMany).not.toHaveBeenCalled();
	});
});
