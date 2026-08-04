/**
 * check-email-collisions.ts — READ-ONLY pre-check for T1 (email canonicalization).
 *
 * `User.email` is `String? @unique` — plain text, no citext, no normalization.
 * T1 adds a database-level case-insensitive uniqueness constraint plus a
 * backfill. That backfill FAILS if any two rows already differ only by case,
 * so this must run (and come back clean, or be resolved) first.
 *
 *   pnpm tsx scripts/check-email-collisions.ts
 *
 * Writes nothing. Exit 0 = safe to migrate, exit 1 = collisions found.
 *
 * Resolution rule (decided 2026-07-26): KEEP the row with `emailVerified` set.
 * Tie-break, in order:
 *   1. emailVerified IS NOT NULL wins
 *   2. both or neither verified  -> older createdAt wins
 *   3. identical createdAt       -> lower id wins (deterministic, arbitrary)
 *
 *      collision group (lower(email) equal, count > 1)
 *                      │
 *          ┌───────────┴───────────┐
 *          ▼                       ▼
 *   exactly one verified?    zero or two verified?
 *          │                       │
 *      keep that one          keep older createdAt
 *
 * Blast radius is printed per row because "merge these users" is destructive:
 * ShiftSignup, VolunteerApplication, OrganizationMember and VolunteerCredential
 * all hang off User.id, and User deletion cascades to ShiftSignup — which would
 * silently destroy attendance history an org entered and reported on.
 */

import { pathToFileURL } from 'node:url';
import { normalizeEmail } from '../src/server/domain/org-volunteer';
import { prisma } from './prisma-client';

type CollisionRow = {
	id: string;
	email: string | null;
	name: string | null;
	emailVerified: Date | null;
	createdAt: Date;
};

/** Apply the documented tie-break to pick the survivor of a collision group. */
export function pickSurvivor<T extends CollisionRow>(group: T[]): T {
	const verified = group.filter((r) => r.emailVerified !== null);
	const pool = verified.length === 1 ? verified : group;

	return [...pool].sort((a, b) => {
		const byDate = a.createdAt.getTime() - b.createdAt.getTime();
		if (byDate !== 0) return byDate;
		return a.id < b.id ? -1 : 1;
	})[0];
}

async function main() {
	const users = await prisma.user.findMany({
		where: { email: { not: null } },
		select: {
			id: true,
			email: true,
			name: true,
			emailVerified: true,
			createdAt: true,
		},
		orderBy: { createdAt: 'asc' },
	});

	const groups = new Map<string, CollisionRow[]>();
	for (const u of users) {
		if (!u.email) continue;
		// MUST use the canonical normalizer, not a local copy. This script's whole
		// job is to certify that the migration is safe; forking the definition of
		// "same address" here would let it report "safe to migrate" for data the
		// migration then rejects.
		const key = normalizeEmail(u.email);
		const bucket = groups.get(key);
		if (bucket) bucket.push(u);
		else groups.set(key, [u]);
	}

	const collisions = [...groups.entries()].filter(
		([, rows]) => rows.length > 1,
	);

	console.log(`Scanned ${users.length} users with a non-null email.`);

	if (collisions.length === 0) {
		console.log(
			'\n✓ No case-only email collisions. T1 backfill is safe to run.',
		);
		return;
	}

	console.log(
		`\n✗ ${collisions.length} collision group(s) found. Resolve before migrating.\n`,
	);

	for (const [key, rows] of collisions) {
		const survivor = pickSurvivor(rows);
		console.log(`── ${key} (${rows.length} rows)`);

		for (const r of rows) {
			const [signups, applications, memberships, credentials] =
				await Promise.all([
					prisma.shiftSignup.count({ where: { userId: r.id } }),
					prisma.volunteerApplication.count({
						where: { submittedByUserId: r.id },
					}),
					prisma.organizationMember.count({ where: { userId: r.id } }),
					prisma.volunteerCredential.count({ where: { userId: r.id } }),
				]);

			const verdict = r.id === survivor.id ? 'KEEP  ' : 'MERGE→';
			const verified = r.emailVerified ? 'verified' : 'unverified';
			console.log(
				`   ${verdict} ${r.id}  ${JSON.stringify(r.email)}  ${verified}  ` +
					`created ${r.createdAt.toISOString().slice(0, 10)}  ` +
					`signups=${signups} apps=${applications} orgs=${memberships} creds=${credentials}`,
			);
		}
		console.log();
	}

	console.log(
		'Rule applied: emailVerified wins; else older createdAt; else lower id.\n' +
			'MERGE rows carrying signups/apps/orgs/creds need their FKs repointed at the\n' +
			'KEEP row before deletion — User deletion cascades to ShiftSignup.',
	);

	process.exitCode = 1;
}

// Only self-execute when run directly (`pnpm tsx scripts/check-email-collisions.ts`).
// Without this guard, importing `pickSurvivor` for a unit test would open a
// database connection and run the whole scan as a side effect of the import.
const isDirectRun =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
	main()
		.catch((err) => {
			console.error(err);
			process.exitCode = 1;
		})
		.finally(() => prisma.$disconnect());
}
