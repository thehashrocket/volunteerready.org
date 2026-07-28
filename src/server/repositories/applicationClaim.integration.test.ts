/**
 * Integration coverage for the application-claim repository functions.
 *
 * The security property here is a Prisma `where` clause, not service logic, so
 * mocked unit tests cannot prove it. These run against the real database and
 * assert that a claim for an application submitted under a DIFFERENT address
 * binds nothing — which is what stops a forged public application from minting
 * an `APPLICATION` relationship edge over a stranger.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/server/repositories/prisma';
import {
	claimApplicationForUser,
	listClaimableApplicationsByEmail,
} from '@/server/repositories/volunteer-applications';

const PREFIX = 'claim-integ-';
const VICTIM_EMAIL = `${PREFIX}victim@example.test`;
const ATTACKER_EMAIL = `${PREFIX}attacker@example.test`;

let orgId: string;
let victimId: string;
let attackerId: string;
const applicationIds: string[] = [];

beforeAll(async () => {
	// Self-heal after an interrupted run. `slug` is unique and `afterAll` only
	// deletes ids captured in THIS process, so a single Ctrl-C leaves a row that
	// makes every subsequent run fail in beforeAll — disabling the only tests
	// that prove the email predicate until someone cleans the DB by hand.
	// A prefix sweep is safe here specifically because this prefix is unique to
	// this file and `vitest.integration.config.mts` sets `fileParallelism: false`
	// (cf. the CLAUDE.md rule against unscoped prefix sweeps in parallel specs).
	await prisma.volunteerApplication.deleteMany({
		where: { submittedByEmail: { startsWith: PREFIX } },
	});
	await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
	await prisma.organization.deleteMany({
		where: { slug: { startsWith: PREFIX } },
	});

	const org = await prisma.organization.create({
		data: { name: `${PREFIX}org`, slug: `${PREFIX}org` },
	});
	orgId = org.id;

	const victim = await prisma.user.create({ data: { email: VICTIM_EMAIL } });
	victimId = victim.id;

	const attacker = await prisma.user.create({
		data: { email: ATTACKER_EMAIL },
	});
	attackerId = attacker.id;
});

afterAll(async () => {
	// Scoped to ids this file created — never a prefix sweep, per the e2e
	// cleanup rule in CLAUDE.md.
	await prisma.volunteerApplication.deleteMany({
		where: { id: { in: applicationIds } },
	});
	await prisma.organization.deleteMany({ where: { id: orgId } });
	await prisma.user.deleteMany({
		where: { id: { in: [victimId, attackerId] } },
	});
});

async function createOrphanApplication(submittedByEmail: string) {
	const application = await prisma.volunteerApplication.create({
		data: { orgId, submittedByEmail, submittedByUserId: null },
	});
	applicationIds.push(application.id);
	return application;
}

describe('listClaimableApplicationsByEmail', () => {
	it('finds an orphan application submitted under the address', async () => {
		const application = await createOrphanApplication(VICTIM_EMAIL);

		const found = await listClaimableApplicationsByEmail(VICTIM_EMAIL);

		expect(found.map((a) => a.id)).toContain(application.id);
	});

	it('SECURITY: excludes orphans submitted under a different address', async () => {
		// Without this, a broken predicate leaks: the listing discloses the org
		// name and submission date of every row it returns. The sibling
		// `toContain` assertions would all still pass.
		const mine = await createOrphanApplication(VICTIM_EMAIL);
		const theirs = await createOrphanApplication(ATTACKER_EMAIL);

		const found = await listClaimableApplicationsByEmail(VICTIM_EMAIL);
		const ids = found.map((a) => a.id);

		expect(ids).toContain(mine.id);
		expect(ids).not.toContain(theirs.id);
	});

	it('normalizes the CALLER address before matching canonical storage', async () => {
		// Storage is canonical (T1 backfilled this column; `screener.submit` now
		// normalizes on write), so the lookup only has to normalize its input.
		const application = await createOrphanApplication(
			`${PREFIX}mixedcase@example.test`,
		);

		const found = await listClaimableApplicationsByEmail(
			`  ${PREFIX}MixedCase@Example.Test  `,
		);

		expect(found.map((a) => a.id)).toContain(application.id);
	});

	it('SECURITY: an underscore in the claimant address is not a wildcard', async () => {
		// REGRESSION. This matched with `mode: 'insensitive'`, which Prisma
		// compiles to `ILIKE $1` with the value interpolated unescaped — making
		// `_` a single-character wildcard. Since `_` is legal in an address that
		// zod's .email() accepts, `j_smith@x.com` could list and CLAIM
		// `j.smith@x.com`'s application: a different person, and exactly the
		// APPLICATION edge this whole change exists to withhold.
		const victim = await createOrphanApplication(
			`${PREFIX}j.smith@example.test`,
		);

		const found = await listClaimableApplicationsByEmail(
			`${PREFIX}j_smith@example.test`,
		);

		expect(found.map((a) => a.id)).not.toContain(victim.id);
	});

	it('SECURITY: a percent sign in the claimant address is not a wildcard', async () => {
		const victim = await createOrphanApplication(
			`${PREFIX}anyone@example.test`,
		);

		const found = await listClaimableApplicationsByEmail(
			`${PREFIX}%@example.test`,
		);

		expect(found.map((a) => a.id)).not.toContain(victim.id);
	});

	it('does not offer an application already bound to a user', async () => {
		const application = await createOrphanApplication(VICTIM_EMAIL);
		await prisma.volunteerApplication.update({
			where: { id: application.id },
			data: { submittedByUserId: victimId },
		});

		const found = await listClaimableApplicationsByEmail(VICTIM_EMAIL);

		expect(found.map((a) => a.id)).not.toContain(application.id);
	});
});

describe('claimApplicationForUser', () => {
	it('binds an application submitted under the claimant address', async () => {
		const application = await createOrphanApplication(VICTIM_EMAIL);

		const claimed = await claimApplicationForUser(
			application.id,
			victimId,
			VICTIM_EMAIL,
		);

		expect(claimed?.id).toBe(application.id);
		const row = await prisma.volunteerApplication.findUnique({
			where: { id: application.id },
		});
		expect(row?.submittedByUserId).toBe(victimId);
	});

	it('SECURITY: refuses to bind an application submitted under another address', async () => {
		// This is the attack: a forged public application bearing the victim's
		// email. The attacker knows the id and tries to claim it themselves.
		const application = await createOrphanApplication(VICTIM_EMAIL);

		const claimed = await claimApplicationForUser(
			application.id,
			attackerId,
			ATTACKER_EMAIL,
		);

		expect(claimed).toBeNull();
		const row = await prisma.volunteerApplication.findUnique({
			where: { id: application.id },
		});
		expect(row?.submittedByUserId).toBeNull();
	});

	it('SECURITY: an underscore address cannot CLAIM a near-miss row', async () => {
		// The listing counterpart above proves disclosure is closed; this proves
		// the bind is too. Both `where` clauses carry the predicate separately.
		const victim = await createOrphanApplication(
			`${PREFIX}a.b.claim@example.test`,
		);

		const claimed = await claimApplicationForUser(
			victim.id,
			attackerId,
			`${PREFIX}a_b_claim@example.test`,
		);

		expect(claimed).toBeNull();
		const row = await prisma.volunteerApplication.findUnique({
			where: { id: victim.id },
		});
		expect(row?.submittedByUserId).toBeNull();
	});

	it('SECURITY: a second claim of an already-bound application is a no-op', async () => {
		const application = await createOrphanApplication(VICTIM_EMAIL);
		await claimApplicationForUser(application.id, victimId, VICTIM_EMAIL);

		// Same address, different user — models the concurrent double-claim race
		// and an address that has since changed hands.
		const second = await claimApplicationForUser(
			application.id,
			attackerId,
			VICTIM_EMAIL,
		);

		expect(second).toBeNull();
		const row = await prisma.volunteerApplication.findUnique({
			where: { id: application.id },
		});
		expect(row?.submittedByUserId).toBe(victimId);
	});
});
