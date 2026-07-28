/**
 * Pre-deploy check for T4/T5 (v0.33.0.0): find UNCLAIMED users who have
 * ALREADY authenticated.
 *
 * READ-ONLY. Safe to point at production. Exit 1 if any are found.
 *
 * WHY THIS EXISTS
 * ---------------
 * `accountState` was added in v0.32.0.0 and staff-created volunteers have been
 * minted `UNCLAIMED` ever since, for any org with the `staff_created_volunteers`
 * flag on. Nothing has ever flipped that field back — the sign-in flip
 * (`claimAccountOnSignIn`) ships in THIS release.
 *
 * So a volunteer who was added to a roster last month and signed in by magic
 * link the same day is still `UNCLAIMED` in the database today. They are
 * indistinguishable, by column, from someone who never showed up. The moment
 * the T4 guard deploys, all four bulk senders start silently dropping their
 * mail — and the flip that would rescue them only fires on their NEXT sign-in,
 * which with 30-day sessions could be a month away, or never.
 *
 * The guard is a privacy control, so failing closed is right in general. It is
 * wrong for people who demonstrably already claimed their account. This script
 * finds them BEFORE the deploy, so the backfill is a decision rather than a
 * support ticket nobody can diagnose.
 *
 * Mirrors `check-email-collisions.ts`, which does the same job for T1.
 *
 *   pnpm check:stranded-unclaimed
 */

import { prisma } from './prisma-client';

type StrandedRow = {
	id: string;
	email: string | null;
	createdAt: Date;
	emailVerified: Date | null;
	sessions: bigint;
	accounts: bigint;
};

async function main() {
	const total = await prisma.user.count({
		where: { accountState: 'UNCLAIMED' },
	});

	// "Has authenticated" is any of: a verified email (magic link sets this), a
	// live session row, or a linked OAuth account. Each is proof the person
	// reached us, which is exactly what `claimedAt` is supposed to record.
	const stranded = await prisma.$queryRaw<StrandedRow[]>`
		SELECT u.id,
		       u.email,
		       u."createdAt",
		       u."emailVerified",
		       (SELECT count(*) FROM "Session" s WHERE s."userId" = u.id) AS sessions,
		       (SELECT count(*) FROM "Account" a WHERE a."userId" = u.id) AS accounts
		FROM "User" u
		WHERE u."accountState" = 'UNCLAIMED'
		  AND (
		        u."emailVerified" IS NOT NULL
		     OR EXISTS (SELECT 1 FROM "Session" s WHERE s."userId" = u.id)
		     OR EXISTS (SELECT 1 FROM "Account" a WHERE a."userId" = u.id)
		  )
		ORDER BY u."createdAt"
	`;

	console.log(`UNCLAIMED users total:        ${total}`);
	console.log(`...of which have authenticated: ${stranded.length}`);

	if (stranded.length === 0) {
		console.log(
			'\n✅ Nobody is stranded. Every UNCLAIMED user genuinely has never signed in.',
		);
		console.log('   Safe to deploy the T4 guard without a backfill.');
		return;
	}

	console.log(
		'\n❌ These users already authenticated but are still marked UNCLAIMED.',
	);
	console.log(
		'   Deploying the guard without backfilling them silently cuts them off',
		'\n   from digests, re-engagement and shift reminders.\n',
	);
	for (const r of stranded) {
		const proof = [
			r.emailVerified ? 'emailVerified' : null,
			Number(r.sessions) > 0 ? `${r.sessions} session(s)` : null,
			Number(r.accounts) > 0 ? `${r.accounts} linked account(s)` : null,
		]
			.filter(Boolean)
			.join(', ');
		console.log(
			`  ${r.id}  ${r.email ?? '(no email)'}  created ${r.createdAt.toISOString()}  [${proof}]`,
		);
	}

	console.log(`
Backfill (review before running — this is a WRITE):

  UPDATE "User"
     SET "accountState" = 'ACTIVE',
         "claimedAt"    = COALESCE("emailVerified", "createdAt")
   WHERE "accountState" = 'UNCLAIMED'
     AND (
           "emailVerified" IS NOT NULL
        OR EXISTS (SELECT 1 FROM "Session" s WHERE s."userId" = "User".id)
        OR EXISTS (SELECT 1 FROM "Account" a WHERE a."userId" = "User".id)
     );

claimedAt falls back to createdAt because we cannot recover the real first
sign-in for rows that predate this release — an approximate date is more
honest than NULL on a row whose state says it was claimed.
`);
	process.exitCode = 1;
}

main()
	.catch((err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
