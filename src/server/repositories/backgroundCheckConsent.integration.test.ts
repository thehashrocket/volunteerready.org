/**
 * Integration tests for the FCRA consent attestation columns.
 *
 * Uses real Postgres. Requires DATABASE_URL. Run with: pnpm test:integration
 *
 * WHY THIS MUST BE AN INTEGRATION TEST
 * ------------------------------------
 * The service-level unit test can only prove that `initiateProviderCheck` PASSES
 * `consentAttestedBy` to the repository — the repository is mocked there, so the
 * write itself is invisible to it. That gap is not theoretical: deleting both
 * columns from `createBackgroundCheckRequestTx`'s `data` block leaves the whole
 * unit suite green, which is how this file came to exist.
 *
 * What is being protected is evidence. These columns are the only record that
 * anyone accepted the obligation /terms §4 assigns to the org ("Obtaining
 * appropriate consent from volunteers before initiating background checks")
 * for a given check, and the question they answer — "who said they had the
 * signed form, and when?" — is asked precisely when someone disputes that a
 * check was authorized at all.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createBackgroundCheckRequestTx } from './backgroundCheckRepo';
import { prisma } from './prisma';

const PREFIX = '__bgconsent_integration__';

const createdOrgIds: string[] = [];
const createdUserIds: string[] = [];

async function fixture(suffix: string) {
	const org = await prisma.organization.create({
		data: { name: `${PREFIX}${suffix}`, slug: `${PREFIX}${suffix}` },
	});
	const [volunteer, actor] = await Promise.all([
		prisma.user.create({
			data: {
				email: `${PREFIX}${suffix}-volunteer@example.test`,
				accountState: 'UNCLAIMED',
			},
		}),
		prisma.user.create({
			data: { email: `${PREFIX}${suffix}-actor@example.test` },
		}),
	]);
	createdOrgIds.push(org.id);
	createdUserIds.push(volunteer.id, actor.id);
	return { org, volunteer, actor };
}

// Deletes ONLY the ids this file created — never an unscoped prefix sweep, which
// could catch a sibling worker's live rows (CLAUDE.md).
afterEach(async () => {
	if (createdOrgIds.length > 0) {
		await prisma.backgroundCheckRequest.deleteMany({
			where: { orgId: { in: createdOrgIds } },
		});
		await prisma.organization.deleteMany({
			where: { id: { in: createdOrgIds } },
		});
		createdOrgIds.length = 0;
	}
	if (createdUserIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
		createdUserIds.length = 0;
	}
});

describe('consent attestation persistence', () => {
	it('writes the attesting actor and a timestamp onto the request row', async () => {
		const { org, volunteer, actor } = await fixture('write');

		const before = new Date();
		const created = await prisma.$transaction((tx) =>
			createBackgroundCheckRequestTx(tx, {
				orgId: org.id,
				userId: volunteer.id,
				externalId: `${PREFIX}write-report`,
				packageName: 'tasker_standard',
				consentAttestedBy: actor.id,
			}),
		);

		const row = await prisma.backgroundCheckRequest.findUniqueOrThrow({
			where: { id: created.id },
			select: { consentAttestedAt: true, consentAttestedBy: true },
		});

		expect(row.consentAttestedBy).toBe(actor.id);
		expect(row.consentAttestedAt).toBeInstanceOf(Date);
		// Stamped by the repository at write time rather than taken from the
		// caller, so it cannot be back-dated.
		expect(row.consentAttestedAt?.getTime()).toBeGreaterThanOrEqual(
			before.getTime() - 1000,
		);
	});

	it('SECURITY: the attestation survives the attesting coordinator being deleted', async () => {
		// The whole reason `consentAttestedBy` is a plain String and not a User
		// relation. `AuditLog.actorId` carries ON DELETE SET NULL, which is right
		// for an audit trail keyed on a live actor and wrong for evidence: an
		// attestation that empties itself when the coordinator leaves the org is
		// worthless in exactly the dispute it exists for. A dangling id is still
		// distinguishable from "never attested"; NULL is not.
		const { org, volunteer, actor } = await fixture('orphan');

		const created = await prisma.$transaction((tx) =>
			createBackgroundCheckRequestTx(tx, {
				orgId: org.id,
				userId: volunteer.id,
				externalId: `${PREFIX}orphan-report`,
				packageName: 'tasker_standard',
				consentAttestedBy: actor.id,
			}),
		);

		await prisma.user.delete({ where: { id: actor.id } });

		const row = await prisma.backgroundCheckRequest.findUniqueOrThrow({
			where: { id: created.id },
			select: { consentAttestedBy: true },
		});

		expect(row.consentAttestedBy).toBe(actor.id);
	});

	it('leaves both columns null on rows that predate the attestation', async () => {
		// NULL means "we do not know", and that is the truth for every row written
		// before v0.40.0.0. The migration deliberately does not backfill —
		// inventing a value here would manufacture evidence about a real person's
		// consent. This pins that a direct write without the columns stays NULL,
		// so a future backfill has to be a deliberate act.
		const { org, volunteer } = await fixture('legacy');

		const legacy = await prisma.backgroundCheckRequest.create({
			data: {
				orgId: org.id,
				userId: volunteer.id,
				externalId: `${PREFIX}legacy-report`,
				status: 'PENDING',
			},
			select: { consentAttestedAt: true, consentAttestedBy: true },
		});

		expect(legacy.consentAttestedAt).toBeNull();
		expect(legacy.consentAttestedBy).toBeNull();
	});
});
