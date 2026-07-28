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
 * @param constraint Index name as Postgres reports it, e.g.
 *                   `OrgVolunteer_orgId_userId_active`.
 * @param modelName  Prisma model to accept as a match when the adapter reports
 *                   one. Omit when a model owns several unique indexes and only
 *                   the specific constraint should match.
 */
export function isUniqueViolationOn(
	err: unknown,
	constraint: string,
	modelName?: string,
): boolean {
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

	if (modelName && meta?.modelName === modelName) return true;

	// Belt and braces if modelName is ever absent.
	return Boolean(
		meta?.driverAdapterError?.cause?.originalMessage?.includes(constraint),
	);
}
