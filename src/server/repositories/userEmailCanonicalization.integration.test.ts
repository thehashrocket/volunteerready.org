/**
 * Integration tests for User.email canonicalization (T1).
 *
 * Uses real Postgres. Run with: pnpm test:integration
 *
 * WHY INTEGRATION AND NOT UNIT
 * ----------------------------
 * Everything under test is raw SQL that schema.prisma cannot represent: a
 * BEFORE INSERT/UPDATE trigger and a functional unique index. Prisma has no
 * idea either exists, so a mocked client proves nothing at all — it would
 * happily "store" mixed case and accept duplicates.
 *
 * These tests deliberately use plain `prisma.user.create()` with no service in
 * the path, because that is exactly how NextAuth's PrismaAdapter writes
 * (auth.ts:26). If normalization only worked through a service, the single
 * biggest write path in the app would bypass it — which is the bug T1 exists
 * to close.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { normalizeEmail } from '@/server/domain/org-volunteer';
import { prisma } from '@/server/repositories/prisma';

const PREFIX = '__email_canon_integration__';

afterEach(async () => {
	// Stored addresses are lowercase by definition here, and the prefix is
	// already lowercase, so a startsWith sweep is exact.
	await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('User.email canonicalization', () => {
	it('lowercases on INSERT, even with no service in the path', async () => {
		const created = await prisma.user.create({
			data: { email: `${PREFIX}Bob@Shelter.ORG` },
		});

		// Prisma returns what it sent — it cannot see the trigger — so the stored
		// value has to be re-read. This asymmetry is documented in the migration.
		const stored = await prisma.user.findUnique({ where: { id: created.id } });
		expect(stored?.email).toBe(`${PREFIX}bob@shelter.org`.toLowerCase());
	});

	it('trims surrounding whitespace as well as lowercasing', async () => {
		// A trailing space is the other way two rows that are "the same address"
		// silently fail to match.
		const created = await prisma.user.create({
			data: { email: `  ${PREFIX}Spaced@Example.COM  ` },
		});
		const stored = await prisma.user.findUnique({ where: { id: created.id } });
		expect(stored?.email).toBe(`${PREFIX}spaced@example.com`.toLowerCase());
	});

	it('lowercases on UPDATE too, not just insert', async () => {
		const user = await prisma.user.create({
			data: { email: `${PREFIX}update-me@example.com` },
		});

		await prisma.user.update({
			where: { id: user.id },
			data: { email: `${PREFIX}UPDATED@Example.COM` },
		});

		const stored = await prisma.user.findUnique({ where: { id: user.id } });
		expect(stored?.email).toBe(`${PREFIX}updated@example.com`.toLowerCase());
	});

	it('SECURITY: rejects a second user differing only by case', async () => {
		// This is the failure the unclaimed-email guard depends on being
		// impossible. Two rows for one address means the guard looks up one and
		// mails the other — failing open on a privacy control.
		await prisma.user.create({ data: { email: `${PREFIX}dup@example.com` } });

		await expect(
			prisma.user.create({ data: { email: `${PREFIX}DUP@Example.COM` } }),
		).rejects.toMatchObject({ code: 'P2002' });
	});

	it('SECURITY: a lowercased lookup finds a row created with mixed case', async () => {
		// The actual bug: the guard looks up by to.toLowerCase() while the row was
		// stored as typed, so findUnique missed and the guard failed open.
		const address = `${PREFIX}guard@shelter.org`;
		await prisma.user.create({ data: { email: address.toUpperCase() } });

		const found = await prisma.user.findUnique({
			where: { email: address.toLowerCase() },
		});
		expect(found).not.toBeNull();
	});

	it('leaves a null email alone', async () => {
		// OAuth providers can return no email; the trigger must not turn NULL into
		// an empty string, which would then collide with every other empty row.
		const created = await prisma.user.create({ data: { email: null } });
		const stored = await prisma.user.findUnique({ where: { id: created.id } });
		expect(stored?.email).toBeNull();

		await prisma.user.delete({ where: { id: created.id } });
	});

	it('allows many users with a null email (partial index excludes NULLs)', async () => {
		const a = await prisma.user.create({ data: { email: null } });
		const b = await prisma.user.create({ data: { email: null } });
		expect(a.id).not.toBe(b.id);

		await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
	});

	it('updating an unrelated column does not disturb the email', async () => {
		// The trigger is scoped to `UPDATE OF email`, so this path should not fire
		// it at all — but the stored value must stay correct either way.
		const user = await prisma.user.create({
			data: { email: `${PREFIX}untouched@example.com`, name: 'Before' },
		});
		await prisma.user.update({
			where: { id: user.id },
			data: { name: 'After' },
		});

		const stored = await prisma.user.findUnique({ where: { id: user.id } });
		expect(stored?.email).toBe(`${PREFIX}untouched@example.com`);
		expect(stored?.name).toBe('After');
	});

	it('has both the trigger and the functional unique index installed', async () => {
		const triggers = await prisma.$queryRaw<{ tgname: string }[]>`
			SELECT tgname FROM pg_trigger
			WHERE tgrelid = '"User"'::regclass AND NOT tgisinternal;`;
		expect(triggers.map((t) => t.tgname)).toContain('trg_user_email_normalize');

		const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
			SELECT indexname FROM pg_indexes WHERE tablename = 'User';`;
		expect(indexes.map((i) => i.indexname)).toContain('User_email_lower_key');
	});

	// The domain helper and the database trigger MUST agree. If they drift, a
	// lookup built on normalizeEmail() stops finding rows the trigger wrote —
	// which is exactly the fail-open bug T1 was written to close. Feed one input
	// through BOTH and assert they land on the same string.
	it.each([
		'Bob@Shelter.ORG',
		'  Padded@Example.com  ',
		'ALLCAPS@EXAMPLE.COM',
		'already@lower.com',
		'Mixed.Case+tag@Example.Co.UK',
	])('normalizeEmail() agrees with the DB trigger for %s', async (raw) => {
		const created = await prisma.user.create({
			data: { email: `${PREFIX}${raw}` },
		});
		const stored = await prisma.user.findUnique({ where: { id: created.id } });

		expect(stored?.email).toBe(normalizeEmail(`${PREFIX}${raw}`));
	});

	// ---------------------------------------------------------------------
	// The correlated backfill. Lowercasing User.email alone is silent data
	// loss: these columns hold an address that is matched against a User by
	// EXACT equality, so normalizing one side and not the other de-links them
	// permanently — with no error, just a row that stops being found.
	// ---------------------------------------------------------------------

	it('SECURITY: a mixed-case anonymous application still links to its user', async () => {
		// linkApplicationsToUser matches { submittedByEmail, submittedByUserId:
		// null } against the session address. Before the correlated backfill the
		// User side was lowercased and this side was not, so the application
		// became unclaimable forever and vanished from the volunteer dashboard.
		const address = `${PREFIX}applicant@example.test`;
		const user = await prisma.user.create({ data: { email: address } });
		const org = await prisma.organization.create({
			data: { name: `${PREFIX}app`, slug: `${PREFIX}app` },
		});
		const application = await prisma.volunteerApplication.create({
			data: {
				orgId: org.id,
				submittedByEmail: address,
				submittedByUserId: null,
			},
		});

		// The exact-equality lookup the production code performs.
		const found = await prisma.volunteerApplication.findFirst({
			where: {
				submittedByEmail: normalizeEmail(address),
				submittedByUserId: null,
			},
		});
		expect(found?.id).toBe(application.id);

		await prisma.volunteerApplication.delete({ where: { id: application.id } });
		await prisma.organization.delete({ where: { id: org.id } });
		await prisma.user.delete({ where: { id: user.id } });
	});

	it('the canonicalization migration sorts BEFORE the schema migration', async () => {
		// Prisma runs each migration in its own transaction. If the collision
		// guard RAISEs after a schema migration has committed, _prisma_migrations
		// records this one as failed and every later deploy aborts with P3009.
		// Failing first means failing clean.
		const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
			SELECT migration_name FROM _prisma_migrations
			WHERE migration_name LIKE '%canonicalize_user_email'
			   OR migration_name LIKE '%add_org_volunteer_and_account_state'
			ORDER BY migration_name;`;

		expect(rows).toHaveLength(2);
		expect(rows[0].migration_name).toContain('canonicalize_user_email');
		expect(rows[1].migration_name).toContain('add_org_volunteer');
	});
});
