/**
 * Integration tests for the credential-expiry notifier's data access.
 *
 * Uses real Postgres. Requires DATABASE_URL to point at the dev/test database.
 * Run with: pnpm test:integration
 *
 * WHY THESE MUST BE INTEGRATION TESTS, NOT UNIT TESTS
 * ---------------------------------------------------
 * Every test of the notifier SERVICE mocks these three functions wholesale,
 * which is right for testing its branching and useless for testing the thing
 * that actually decides who gets warned: the WHERE clauses. A mocked Prisma
 * client returns whatever the mock was told to, so a flipped comparison, a
 * dropped `notifiedAt: null`, or a typo in the role list all pass.
 *
 * Behaviour pinned here:
 *   1. the window's near and far edges — inside is selected, outside is not
 *   2. an already-notified credential never comes back (the idempotency gate)
 *   3. only VERIFIED credentials are warned about
 *   4. a null `expiresAt` is excluded rather than treated as expiring
 *   5. `markCredentialsNotified` will not overwrite an existing stamp — the
 *      race guard its docstring claims
 *   6. `findOrgStaffRecipients` returns OWNER and ADMIN and excludes STAFF and
 *      READONLY, which is the one security boundary in this feature
 */

import { afterEach, describe, expect, it } from 'vitest';
import { CREDENTIAL_EXPIRY_WARNING_DAYS } from '@/server/domain/credential-expiry';
import {
	findExpiryNoticeCredentialsForOrgs,
	findOrgsNeedingExpiryNotice,
	markCredentialsNotifiedTx,
} from '@/server/repositories/credential-expiry-repo';
import { findOrgStaffRecipients } from '@/server/repositories/orgRepo';
import { prisma } from '@/server/repositories/prisma';

const PREFIX = '__credexpiry_integration__';
const DAY_MS = 24 * 60 * 60 * 1000;

/** A fixed clock, so "now" cannot drift between arranging and asserting. */
const NOW = new Date('2026-08-07T12:00:00.000Z');

function daysFromNow(days: number): Date {
	return new Date(NOW.getTime() + days * DAY_MS);
}

/**
 * An org WITH an OWNER, which is what the scan requires.
 *
 * The recipient requirement is part of the query now — an org with nobody to
 * tell is excluded so it cannot hold a slot under the org cap forever — so a
 * bare org would silently drop out of every assertion here.
 * `makeOrgWithoutStaff` is the deliberate exception.
 */
async function makeOrg(suffix: string) {
	const org = await makeOrgWithoutStaff(suffix);
	const owner = await makeUser(`${suffix}-owner`);
	await prisma.organizationMember.create({
		data: { organizationId: org.id, userId: owner.id, role: 'OWNER' },
	});
	return org;
}

/** An org with no OWNER/ADMIN — the excluded case. */
async function makeOrgWithoutStaff(suffix: string) {
	return prisma.organization.create({
		data: { name: `${PREFIX}${suffix}`, slug: `${PREFIX}${suffix}` },
	});
}

async function makeUser(suffix: string) {
	return prisma.user.create({
		data: { email: `${PREFIX}${suffix}@example.test`, name: `User ${suffix}` },
	});
}

async function makeCredential(
	orgId: string,
	userId: string,
	overrides: {
		expiresAt?: Date | null;
		status?: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REVOKED';
		notifiedAt?: Date | null;
	} = {},
) {
	return prisma.volunteerCredential.create({
		data: {
			orgId,
			userId,
			type: 'BACKGROUND_CHECK',
			status: overrides.status ?? 'VERIFIED',
			expiresAt:
				overrides.expiresAt === undefined
					? daysFromNow(10)
					: overrides.expiresAt,
			notifiedAt: overrides.notifiedAt ?? null,
		},
	});
}

/**
 * The two-phase scan, restricted to this suite's orgs.
 *
 * Phase 1 is UNCAPPED here on purpose. With the production org cap a negative
 * assertion (`toEqual([])`) would pass vacuously the moment the target database
 * holds more due orgs than the cap — which the local dev DB does after
 * `pnpm seed:dev`, and which sibling integration files create concurrently.
 */
async function scanForPrefix() {
	const orgIds = await findOrgsNeedingExpiryNotice(NOW, 100_000);
	const rows = await findExpiryNoticeCredentialsForOrgs(NOW, orgIds);
	return rows.filter((r) => r.organization.name.startsWith(PREFIX));
}

/** `markCredentialsNotifiedTx` outside a transaction, for arranging state. */
function stamp(ids: readonly string[], now = NOW) {
	return prisma.$transaction((tx) => markCredentialsNotifiedTx(tx, ids, now));
}

afterEach(async () => {
	await prisma.volunteerCredential.deleteMany({
		where: { organization: { slug: { startsWith: PREFIX } } },
	});
	await prisma.organizationMember.deleteMany({
		where: { organization: { slug: { startsWith: PREFIX } } },
	});
	await prisma.organization.deleteMany({
		where: { slug: { startsWith: PREFIX } },
	});
	await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('findCredentialsNeedingExpiryNotice', () => {
	it('selects a credential inside the window', async () => {
		const [org, user] = await Promise.all([makeOrg('a'), makeUser('a')]);
		const cred = await makeCredential(org.id, user.id, {
			expiresAt: daysFromNow(10),
		});

		const found = await scanForPrefix();

		expect(found.map((r) => r.id)).toEqual([cred.id]);
	});

	it('selects at the far edge of the window but not past it', async () => {
		const [org, user1, user2] = await Promise.all([
			makeOrg('b'),
			makeUser('b1'),
			makeUser('b2'),
		]);
		const inside = await makeCredential(org.id, user1.id, {
			// One hour inside the boundary — `setDate(+30)` lands exactly on it.
			expiresAt: new Date(
				daysFromNow(CREDENTIAL_EXPIRY_WARNING_DAYS).getTime() - 60 * 60 * 1000,
			),
		});
		await makeCredential(org.id, user2.id, {
			expiresAt: daysFromNow(CREDENTIAL_EXPIRY_WARNING_DAYS + 1),
		});

		const found = await scanForPrefix();

		expect(found.map((r) => r.id)).toEqual([inside.id]);
	});

	it('excludes a credential that has already expired', async () => {
		// The disjointness that lets this run beside the expirer in one
		// Promise.all: that one takes `expiresAt < now`, this one `> now`.
		const [org, user] = await Promise.all([makeOrg('c'), makeUser('c')]);
		await makeCredential(org.id, user.id, { expiresAt: daysFromNow(-1) });

		expect(await scanForPrefix()).toEqual([]);
	});

	it('excludes a credential that was already notified about', async () => {
		const [org, user] = await Promise.all([makeOrg('d'), makeUser('d')]);
		await makeCredential(org.id, user.id, {
			expiresAt: daysFromNow(10),
			notifiedAt: daysFromNow(-1),
		});

		expect(await scanForPrefix()).toEqual([]);
	});

	it('excludes credentials that are not VERIFIED', async () => {
		const org = await makeOrg('e');
		const users = await Promise.all([
			makeUser('e1'),
			makeUser('e2'),
			makeUser('e3'),
		]);
		// One org can hold at most one credential per (user, type), so each
		// status needs its own user.
		await makeCredential(org.id, users[0].id, { status: 'PENDING' });
		await makeCredential(org.id, users[1].id, { status: 'EXPIRED' });
		await makeCredential(org.id, users[2].id, { status: 'REVOKED' });

		expect(await scanForPrefix()).toEqual([]);
	});

	it('excludes a credential with no expiry date at all', async () => {
		// A NULL expiresAt is "never expires", not "expiring now".
		const [org, user] = await Promise.all([makeOrg('f'), makeUser('f')]);
		await makeCredential(org.id, user.id, { expiresAt: null });

		expect(await scanForPrefix()).toEqual([]);
	});

	it('returns the most urgent credential first', async () => {
		// Load-bearing when the scan cap truncates a run: the rows that get
		// served must be the ones closest to lapsing.
		const org = await makeOrg('g');
		const users = await Promise.all([makeUser('g1'), makeUser('g2')]);
		const later = await makeCredential(org.id, users[0].id, {
			expiresAt: daysFromNow(25),
		});
		const sooner = await makeCredential(org.id, users[1].id, {
			expiresAt: daysFromNow(2),
		});

		const found = await scanForPrefix();

		expect(found.map((r) => r.id)).toEqual([sooner.id, later.id]);
	});

	it('projects the volunteer and org names the summary email needs', async () => {
		const [org, user] = await Promise.all([makeOrg('h'), makeUser('h')]);
		await makeCredential(org.id, user.id);

		const [found] = await scanForPrefix();

		expect(found.user.name).toBe('User h');
		expect(found.organization.name).toBe(`${PREFIX}h`);
		expect(found.type).toBe('BACKGROUND_CHECK');
	});
});

describe('renewal', () => {
	it('warns again after a credential is re-issued with a later expiry', async () => {
		// THE defect that made the first version of this feature useless.
		// VolunteerCredential is unique on (userId, orgId, type), so re-issuing a
		// background check UPDATES the existing row — and upsertCredential's
		// `update: data` never touches notifiedAt. Under the original
		// `notifiedAt: null` filter that row was excluded FOREVER, so every
		// annual renewal after the first expired with no warning at all.
		const [org, user] = await Promise.all([makeOrg('n'), makeUser('n')]);
		const cred = await makeCredential(org.id, user.id, {
			expiresAt: daysFromNow(5),
			// Warned during the PREVIOUS cycle, i.e. longer ago than the window.
			notifiedAt: daysFromNow(-45),
		});

		expect((await scanForPrefix()).map((r) => r.id)).toEqual([cred.id]);
	});

	it('does not warn twice within one cycle', async () => {
		const [org, user] = await Promise.all([makeOrg('o'), makeUser('o')]);
		await makeCredential(org.id, user.id, {
			expiresAt: daysFromNow(5),
			// Warned inside the current window — the same expiry date.
			notifiedAt: daysFromNow(-2),
		});

		expect(await scanForPrefix()).toEqual([]);
	});
});

describe('org eligibility', () => {
	it('skips a suspended org', async () => {
		// A suspended tenant is frozen; it must not be emailed its volunteers'
		// names. Every marketplace query in this repo filters the same way.
		const [org, user] = await Promise.all([makeOrg('p'), makeUser('p')]);
		await prisma.organization.update({
			where: { id: org.id },
			data: { suspendedAt: new Date() },
		});
		await makeCredential(org.id, user.id);

		expect(await scanForPrefix()).toEqual([]);
	});

	it('skips an org with no OWNER or ADMIN so it cannot hold a cap slot', async () => {
		// Such an org can never be stamped, so without this filter it re-enters
		// every night, sorts FIRST because it is the most urgent, and eats the
		// org cap until no reachable org is served.
		const [org, user, staff] = await Promise.all([
			makeOrgWithoutStaff('q'),
			makeUser('q'),
			makeUser('q-staff'),
		]);
		await prisma.organizationMember.create({
			data: { organizationId: org.id, userId: staff.id, role: 'STAFF' },
		});
		await makeCredential(org.id, user.id);

		expect(await scanForPrefix()).toEqual([]);
	});

	it('includes an org whose only qualifying member is an ADMIN', async () => {
		const [org, user, admin] = await Promise.all([
			makeOrgWithoutStaff('r'),
			makeUser('r'),
			makeUser('r-admin'),
		]);
		await prisma.organizationMember.create({
			data: { organizationId: org.id, userId: admin.id, role: 'ADMIN' },
		});
		const cred = await makeCredential(org.id, user.id);

		expect((await scanForPrefix()).map((r) => r.id)).toEqual([cred.id]);
	});
});

describe('findOrgsNeedingExpiryNotice', () => {
	it('caps by ORG and returns whole bundles, most urgent org first', async () => {
		// Capping by credential truncates whichever org straddles the limit, and
		// the email that org receives reads as a complete list. Capping by org
		// means a bundle is served whole or waits for tomorrow.
		const [urgent, later] = await Promise.all([makeOrg('s1'), makeOrg('s2')]);
		const users = await Promise.all([
			makeUser('s1a'),
			makeUser('s1b'),
			makeUser('s2a'),
		]);
		await makeCredential(urgent.id, users[0].id, { expiresAt: daysFromNow(2) });
		await makeCredential(urgent.id, users[1].id, { expiresAt: daysFromNow(9) });
		await makeCredential(later.id, users[2].id, { expiresAt: daysFromNow(20) });

		const orgIds = await findOrgsNeedingExpiryNotice(NOW, 100_000);
		const ours = orgIds.filter((id) => id === urgent.id || id === later.id);
		expect(ours).toEqual([urgent.id, later.id]);

		// Only the urgent org fits — and it arrives WHOLE, both credentials.
		const capped = await findExpiryNoticeCredentialsForOrgs(NOW, [urgent.id]);
		expect(capped).toHaveLength(2);
		expect(capped.every((r) => r.orgId === urgent.id)).toBe(true);
	});
});

describe('markCredentialsNotifiedTx', () => {
	it('stamps a batch and removes it from the scan', async () => {
		const org = await makeOrg('i');
		const users = await Promise.all([makeUser('i1'), makeUser('i2')]);
		const creds = await Promise.all([
			makeCredential(org.id, users[0].id),
			makeCredential(org.id, users[1].id),
		]);

		const result = await stamp(creds.map((c) => c.id));

		expect(result.count).toBe(2);
		expect(await scanForPrefix()).toEqual([]);
	});

	it('will not overwrite a stamp another run already wrote', async () => {
		// The `notifiedAt: null` guard in the WHERE. Without it a concurrent run
		// rewrites the timestamp, and the audit trail says the notice went out
		// later than it did.
		const earlier = daysFromNow(-5);
		const [org, user] = await Promise.all([makeOrg('j'), makeUser('j')]);
		const cred = await makeCredential(org.id, user.id, {
			notifiedAt: earlier,
		});

		const result = await stamp([cred.id]);

		expect(result.count).toBe(0);
		const after = await prisma.volunteerCredential.findUniqueOrThrow({
			where: { id: cred.id },
		});
		expect(after.notifiedAt?.toISOString()).toBe(earlier.toISOString());
	});

	it('short-circuits an empty batch without touching the database', async () => {
		expect(await stamp([])).toEqual({ count: 0 });
	});
});

describe('findOrgStaffRecipients', () => {
	it('returns OWNER and ADMIN and excludes STAFF and READONLY', async () => {
		// SECURITY: the recipient set. A lapsing credential is a compliance
		// exposure, and this list decides who is told about one.
		const org = await makeOrgWithoutStaff('k');
		const [owner, admin, staff, readonly] = await Promise.all([
			makeUser('k-owner'),
			makeUser('k-admin'),
			makeUser('k-staff'),
			makeUser('k-readonly'),
		]);
		await prisma.organizationMember.createMany({
			data: [
				{ organizationId: org.id, userId: owner.id, role: 'OWNER' },
				{ organizationId: org.id, userId: admin.id, role: 'ADMIN' },
				{ organizationId: org.id, userId: staff.id, role: 'STAFF' },
				{ organizationId: org.id, userId: readonly.id, role: 'READONLY' },
			],
		});

		const recipients = await findOrgStaffRecipients(org.id);

		expect(recipients.map((r) => r.userId).sort()).toEqual(
			[owner.id, admin.id].sort(),
		);
		expect(recipients.map((r) => r.user.email).sort()).toEqual(
			[`${PREFIX}k-owner@example.test`, `${PREFIX}k-admin@example.test`].sort(),
		);
	});

	it('does not return another org’s staff', async () => {
		const [orgA, orgB] = await Promise.all([
			makeOrgWithoutStaff('l1'),
			makeOrgWithoutStaff('l2'),
		]);
		const [userA, userB] = await Promise.all([
			makeUser('l1-owner'),
			makeUser('l2-owner'),
		]);
		await prisma.organizationMember.createMany({
			data: [
				{ organizationId: orgA.id, userId: userA.id, role: 'OWNER' },
				{ organizationId: orgB.id, userId: userB.id, role: 'OWNER' },
			],
		});

		const recipients = await findOrgStaffRecipients(orgA.id);

		expect(recipients.map((r) => r.userId)).toEqual([userA.id]);
	});

	it('returns an empty list for an org with no OWNER or ADMIN', async () => {
		const org = await makeOrgWithoutStaff('m');
		const user = await makeUser('m-staff');
		await prisma.organizationMember.create({
			data: { organizationId: org.id, userId: user.id, role: 'STAFF' },
		});

		expect(await findOrgStaffRecipients(org.id)).toEqual([]);
	});
});
