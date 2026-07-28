import { prisma } from './prisma';

/**
 * Flip an UNCLAIMED user to ACTIVE and stamp `claimedAt`.
 *
 * `updateMany` scoped on the CURRENT state, not `update` by id, for three
 * reasons that all point the same way:
 *
 *   1. Idempotence by construction. This runs on every sign-in, and the second
 *      one must not re-stamp `claimedAt` to a later date — that field is the
 *      answer to "when did this person first show up?", and an `update` by id
 *      would silently overwrite it on every subsequent login.
 *   2. It is a compare-and-set, so two concurrent sign-ins (a magic link
 *      clicked twice, a retried OAuth callback) cannot both report success.
 *      The returned count tells the caller which one actually claimed.
 *   3. It needs no prior read. The `User` object NextAuth hands to
 *      `events.signIn` does carry `accountState` today — PrismaAdapter runs no
 *      `select` — but that is an untyped field surviving an adapter cast, not
 *      a contract, and branching on it would make a privacy control depend on
 *      an implementation detail of a library upgrade.
 *
 * @returns true when this call performed the flip, false when the user was
 *          already ACTIVE (or does not exist).
 */
export async function claimUnclaimedUser(
	userId: string,
	claimedAt: Date,
): Promise<boolean> {
	const { count } = await prisma.user.updateMany({
		where: { id: userId, accountState: 'UNCLAIMED' },
		data: { accountState: 'ACTIVE', claimedAt },
	});
	return count > 0;
}
