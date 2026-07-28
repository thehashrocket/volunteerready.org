import { Prisma } from '@/prisma/generated/client';

/**
 * True only for a P2002 raised by the named unique constraint.
 *
 * Narrowing matters whenever a transaction touches more than one unique index:
 * mapping any P2002 to one constraint's user-facing message tells the caller
 * something false, and can leak the existence of a row on an unrelated table.
 *
 * Prisma 7 with the PrismaPg driver adapter does NOT populate `meta.target` —
 * the pre-adapter field most examples still show. Verified empirically against
 * this database, a violation produces:
 *   meta.modelName = 'OrgVolunteer'
 *   meta.driverAdapterError.cause.originalMessage =
 *     'duplicate key value violates unique constraint "OrgVolunteer_orgId_userId_active"'
 * Reading `meta.target` returns undefined for EVERY P2002 here, which would
 * silently disable duplicate detection altogether.
 *
 * The constraint name is AUTHORITATIVE. An earlier version of this function
 * accepted a `modelName` and short-circuited on it, which made the constraint
 * argument dead at every call site that passed one — and so made this function's
 * own promise false. It happened to be safe only because `OrgVolunteer` and
 * `VolunteerApplication` each own exactly one unique index besides their primary
 * key. The day a second one is added to either, every violation of it would have
 * started reporting the first one's user-facing message.
 *
 * `modelName` survives only as a fallback for the case the docstring above says
 * should not happen: the adapter not reporting a message at all. It is checked
 * against the constraint's table prefix rather than supplied separately, so the
 * two cannot drift.
 *
 * @param constraint Index name as Postgres reports it, e.g.
 *                   `OrgVolunteer_orgId_userId_active`. Must be prefixed with the
 *                   Prisma model name for the fallback to work.
 */
export function isUniqueViolationOn(err: unknown, constraint: string): boolean {
	if (
		!(err instanceof Prisma.PrismaClientKnownRequestError) ||
		err.code !== 'P2002'
	) {
		return false;
	}

	const meta = err.meta as
		| {
				modelName?: string;
				driverAdapterError?: { cause?: { originalMessage?: string } };
		  }
		| undefined;

	const message = meta?.driverAdapterError?.cause?.originalMessage;

	if (message) {
		return message.includes(constraint);
	}

	// No adapter message to read. Fall back to the model, which is strictly
	// coarser — it cannot distinguish two indexes on the same table, so it is only
	// reached when the precise signal is unavailable.
	return Boolean(meta?.modelName && constraint.startsWith(meta.modelName));
}
