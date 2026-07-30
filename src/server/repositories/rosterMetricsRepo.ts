import type { OrgVolunteerSource } from '@/prisma/generated/client';
import { prisma } from './prisma';

/**
 * How many orgs have a roster of at least `threshold` live rows.
 *
 * Raw SQL, and it has to be. The `withinDaysOfSignup` window compares
 * `OrgVolunteer.createdAt` against `Organization.createdAt` — a predicate across
 * two tables — and Prisma's `groupBy` cannot express a HAVING over a joined
 * column. Splitting it into "group, then filter in JS" would pull one row per
 * org into memory to answer a single number.
 *
 * ONE STATIC TEMPLATE with NULL-checked optional filters, never composed
 * `Prisma.sql` fragments: Turbopack dev duplicates the generated client's `Sql`
 * class across module graphs, `instanceof` fails, and a composed fragment is
 * sent to Postgres as one literal parameter — a 500 that reproduces only under
 * `next dev`. See the raw-SQL rule in CLAUDE.md.
 */
export async function countOrgsWithPopulatedRoster(options: {
	threshold: number;
	/** Restrict to one source. Null/omitted counts every source. */
	source?: OrgVolunteerSource | null;
	/**
	 * Only count rows added within N days of the org signing up. Null/omitted
	 * counts rows added at any time.
	 */
	withinDaysOfSignup?: number | null;
}): Promise<number> {
	const source = options.source ?? null;
	const withinDays = options.withinDaysOfSignup ?? null;

	const rows = await prisma.$queryRaw<Array<{ count: number }>>`
		SELECT COUNT(*)::int AS count
		FROM (
			SELECT ov."orgId"
			FROM "OrgVolunteer" ov
			JOIN "Organization" o ON o.id = ov."orgId"
			WHERE ov."deletedAt" IS NULL
				AND (
					${source}::"OrgVolunteerSource" IS NULL
					OR ov."source" = ${source}::"OrgVolunteerSource"
				)
				AND (
					${withinDays}::int IS NULL
					OR ov."createdAt" < o."createdAt" + make_interval(days => ${withinDays}::int)
				)
			GROUP BY ov."orgId"
			HAVING COUNT(*) >= ${options.threshold}::int
		) populated
	`;

	return rows[0]?.count ?? 0;
}
