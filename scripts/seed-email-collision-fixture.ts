/**
 * seed-email-collision-fixture.ts — DEV-ONLY. Inserts deliberate case-variant
 * email collisions so the T1 pre-check and resolution can be rehearsed locally.
 *
 *   pnpm tsx scripts/seed-email-collision-fixture.ts
 *   pnpm tsx scripts/check-email-collisions.ts     # now finds 3 groups
 *   pnpm tsx scripts/seed-email-collision-fixture.ts --clean
 *
 * WHY THIS IS NOT IN `pnpm seed:dev`
 * ----------------------------------
 * T1 adds a database-level case-insensitive uniqueness constraint on
 * User.email. Once it lands, these rows CANNOT be inserted — so a collision
 * fixture living in the dev seed would break `pnpm seed:dev` permanently on
 * every fresh database, taking `pnpm e2e` and the screenshot pipeline with it.
 *
 * It also means rehearsing the resolution is inherently a PRE-T1 activity:
 * after the constraint exists, no database can hold a collision to resolve.
 * Run this once, on a pre-T1 schema, to see the real thing.
 *
 * The three groups cover each branch of the documented tie-break:
 *
 *   group                        emailVerified   expected survivor
 *   ---------------------------  --------------  ---------------------------
 *   collide-verified@…           one of two      the verified row (newer!)
 *   collide-neither@…            neither         older createdAt
 *   collide-both@…               both            older createdAt
 *
 * The first is the interesting one: the verified row is deliberately the NEWER
 * of the pair, so a resolver that quietly degraded to "just take the oldest"
 * picks wrong and the rehearsal catches it.
 */

import { pathToFileURL } from 'node:url';
import { prisma } from './prisma-client';

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Refuse to write fixtures into a remote database. Same guard shape as
 * `e2e/utils/db.ts:19-38` — this script intentionally creates rows that a
 * later migration will reject, which would be a genuinely bad thing to do
 * to staging or production.
 */
function assertLocalDatabase() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL is not set');

	const host = new URL(url).hostname;
	if (!LOCAL_DB_HOSTS.has(host)) {
		throw new Error(
			`Refusing to seed email-collision fixtures against non-local host "${host}". ` +
				'These rows are invalid under the T1 constraint and must never reach a real database.',
		);
	}
}

const DOMAIN = 'collision-fixture.local';

const GROUPS = [
	{ local: 'collide-verified', lowerVerified: false, upperVerified: true },
	{ local: 'collide-neither', lowerVerified: false, upperVerified: false },
	{ local: 'collide-both', lowerVerified: true, upperVerified: true },
] as const;

const OLD = new Date('2025-01-01T00:00:00Z');
const NEW = new Date('2026-06-01T00:00:00Z');

async function clean() {
	const { count } = await prisma.user.deleteMany({
		where: { email: { endsWith: `@${DOMAIN}` } },
	});
	console.log(`Removed ${count} fixture user(s).`);
}

async function seed() {
	for (const g of GROUPS) {
		// Lower-case variant is always the OLDER row.
		await prisma.user.create({
			data: {
				email: `${g.local}@${DOMAIN}`,
				name: `${g.local} (lower)`,
				emailVerified: g.lowerVerified ? OLD : null,
				createdAt: OLD,
			},
		});
		// Upper-case variant is always the NEWER row.
		await prisma.user.create({
			data: {
				email: `${g.local.toUpperCase()}@${DOMAIN}`,
				name: `${g.local} (upper)`,
				emailVerified: g.upperVerified ? NEW : null,
				createdAt: NEW,
			},
		});
	}
	console.log(
		`Created ${GROUPS.length * 2} fixture users in ${GROUPS.length} collision groups.`,
	);
	console.log('Now run: pnpm tsx scripts/check-email-collisions.ts');
}

async function main() {
	assertLocalDatabase();
	if (process.argv.includes('--clean')) {
		await clean();
		return;
	}
	// Idempotent: wipe any previous fixture run first.
	await clean();
	await seed();
}

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
