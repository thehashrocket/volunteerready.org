/**
 * Repository unit test for the ONE branch of `softDeleteOwnOrgVolunteerByOrg`
 * that Postgres cannot be made to demonstrate on demand (T32).
 *
 * `orgVolunteer.integration.test.ts` proves the security predicate and the
 * ordinary outcomes against a real database, which is where they belong. But
 * the lost-race branch — the read finds a live row, and by the time the UPDATE
 * runs a concurrent leave or a staff removal has already claimed it, so `count`
 * comes back 0 — needs two transactions interleaved at an exact point. Here it
 * is one stub.
 *
 * The branch matters because the return value is the roster row id the audit
 * entry points at. Returning `row.id` unconditionally would look correct in
 * every integration test in the suite while attributing a departure to a row
 * this call did not actually delete.
 *
 * NOTE the argument order and meaning changed in v0.37.0.0: this is keyed on
 * `orgId`, not `OrgVolunteer.id`. Leaving is addressed by org now, because an
 * org holding only an application or a shift signup has no roster row to name
 * and must still be leavable.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./prisma', () => ({ prisma: {} }));

import { softDeleteOwnOrgVolunteerByOrg } from './orgVolunteerRepo';

function stubTx(row: { id: string } | null, updatedCount: number) {
	const findFirst = vi.fn().mockResolvedValue(row);
	const updateMany = vi.fn().mockResolvedValue({ count: updatedCount });
	return { tx: { orgVolunteer: { findFirst, updateMany } }, updateMany };
}

describe('softDeleteOwnOrgVolunteerByOrg — lost race', () => {
	it('returns null when the UPDATE matched nothing despite the read finding a row', async () => {
		const { tx } = stubTx({ id: 'ov-1' }, 0);

		const result = await softDeleteOwnOrgVolunteerByOrg(
			tx as never,
			'user-1',
			'org-1',
		);

		// Not 'ov-1'. The winner of the race already soft-deleted that row.
		expect(result).toBeNull();
	});

	it('SECURITY: scopes BOTH statements by userId, not just the read', async () => {
		// Deliberate redundancy: either clause alone closes the hole, so a
		// mutation test on one of them stays green and neither is dead code to be
		// tidied away. Only an assertion on the query shapes keeps the second one
		// from being "simplified" out.
		//
		// Note the read is keyed on (orgId, userId) while the write is keyed on
		// (id, userId) — the read resolves the row id, so the write can use the
		// primary key without widening its scope.
		const { tx, updateMany } = stubTx({ id: 'ov-1' }, 1);

		await softDeleteOwnOrgVolunteerByOrg(tx as never, 'user-1', 'org-1');

		expect(tx.orgVolunteer.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { orgId: 'org-1', userId: 'user-1', deletedAt: null },
			}),
		);
		expect(updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'ov-1', userId: 'user-1', deletedAt: null },
			}),
		);
	});

	it('does not attempt the UPDATE at all when the read matched nothing', async () => {
		// An org the caller has no roster row at must not reach a write statement
		// even in a form that would match zero rows — that is what keeps a future
		// refactor of the WHERE from turning this into a cross-user delete.
		//
		// This is now a NORMAL outcome, not only an attack: an application-only or
		// shift-only org has no roster row by definition, and `leaveOrgRoster`
		// treats the null as "nothing to soft-delete" and writes the block anyway.
		const { tx, updateMany } = stubTx(null, 1);

		const result = await softDeleteOwnOrgVolunteerByOrg(
			tx as never,
			'user-1',
			'org-with-no-roster-row',
		);

		expect(result).toBeNull();
		expect(updateMany).not.toHaveBeenCalled();
	});
});
