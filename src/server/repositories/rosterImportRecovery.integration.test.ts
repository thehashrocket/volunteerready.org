/**
 * Integration tests for the two reads `pnpm import:roster --notify-only` is
 * built on. Real Postgres. Run with: pnpm test:integration
 *
 * WHY THESE MUST BE INTEGRATION TESTS
 * -----------------------------------
 * Both queries assert something about the DATABASE, not about our code, and a
 * mocked Prisma client asserts neither:
 *
 *   1. `findConciergeImportAuditRows` filters `AuditLog.metadata` with Prisma's
 *      JSON `path` filter (`{ path: ['via'], equals: 'CONCIERGE_IMPORT' }`).
 *      Whether that compiles to a predicate Postgres actually applies is a fact
 *      about Prisma 7 + the PrismaPg adapter — the same layer where
 *      `isUniqueViolationOn` found that `meta.target` is silently never
 *      populated. A mock returning whatever we handed it proves nothing.
 *   2. `findSentAddresses` matches `EmailEvent.subject` by exact string. The
 *      recovery mode skips a resend on the strength of that match, so a match
 *      that is looser than believed silently withholds a notice from someone
 *      who never got one.
 *
 * The EXCLUSIONS are the load-bearing assertions. A query missing any one of its
 * WHERE clauses still passes an inclusion-only test, and each missing clause has
 * a distinct real consequence: no `orgId` mails another org's volunteers, no
 * `via` mails everyone a coordinator ever added by hand, no `action` reads rows
 * that are not adds at all.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { rosterAddedEmailSubject } from '@/server/domain/org-volunteer';
import { findConciergeImportAuditRows } from './auditRepo';
import { findSentAddresses } from './emailEventRepo';
import { prisma } from './prisma';

const PREFIX = '__notifyonly_integration__';

const createdOrgIds: string[] = [];
const createdEmails: string[] = [];

async function org(suffix: string) {
	const created = await prisma.organization.create({
		data: { name: `${PREFIX}${suffix}`, slug: `${PREFIX}${suffix}` },
	});
	createdOrgIds.push(created.id);
	return created;
}

/** An audit row shaped exactly as `addVolunteer` writes one. */
async function auditRow(input: {
	orgId: string;
	email: string;
	outcome?: string;
	via?: string | null;
	action?: string;
	actorId?: string | null;
	createdAt?: Date;
}) {
	return prisma.auditLog.create({
		data: {
			orgId: input.orgId,
			actorId: input.actorId ?? null,
			action: input.action ?? 'VOLUNTEER_ADDED',
			entityType: 'OrgVolunteer',
			entityId: `ov_${input.email}`,
			createdAt: input.createdAt,
			metadata: {
				email: input.email,
				outcome: input.outcome ?? 'LINKED_ACTIVE',
				// Spread conditionally, exactly as `addVolunteer` does — an
				// interactive add has NO `via` key at all, rather than a null one.
				...(input.via === undefined
					? {}
					: input.via === null
						? {}
						: { via: input.via }),
			},
		},
	});
}

async function emailEvent(input: {
	to: string;
	subject: string;
	eventType?: 'SENT' | 'BOUNCED' | 'SUPPRESSED_UNCLAIMED';
}) {
	createdEmails.push(input.to);
	return prisma.emailEvent.create({
		data: {
			to: input.to,
			subject: input.subject,
			eventType: input.eventType ?? 'SENT',
		},
	});
}

/**
 * Age-gated prefix sweep, so a run killed before `afterEach` self-heals.
 *
 * `EmailEvent` is the one fixture here with no org to clean up by — it carries
 * no `orgId` at all — so a stale SENT row left by an interrupted run would make
 * three of the exclusion assertions below fail on every subsequent run until
 * someone deleted it by hand. In `beforeAll` and age-gated at 30 minutes, per
 * CLAUDE.md: a prefix sweep must never be able to catch a parallel sibling's
 * fresh rows.
 */
beforeAll(async () => {
	await prisma.emailEvent.deleteMany({
		where: {
			to: { startsWith: PREFIX },
			createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
		},
	});
});

// Deletes ONLY the ids this file created — never an unscoped prefix sweep,
// which could catch a sibling worker's live rows (CLAUDE.md).
afterEach(async () => {
	if (createdOrgIds.length > 0) {
		await prisma.auditLog.deleteMany({
			where: { orgId: { in: createdOrgIds } },
		});
		await prisma.organization.deleteMany({
			where: { id: { in: createdOrgIds } },
		});
		createdOrgIds.length = 0;
	}
	if (createdEmails.length > 0) {
		await prisma.emailEvent.deleteMany({
			where: { to: { in: createdEmails } },
		});
		createdEmails.length = 0;
	}
});

describe('findConciergeImportAuditRows', () => {
	it('finds a concierge-import add and carries its email, outcome and actor', async () => {
		const o = await org('found');
		await auditRow({
			orgId: o.id,
			email: '__notifyonly_integration__ada@example.test',
			via: 'CONCIERGE_IMPORT',
			actorId: null,
		});

		const rows = await findConciergeImportAuditRows(o.id);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			email: '__notifyonly_integration__ada@example.test',
			outcome: 'LINKED_ACTIVE',
			actorId: null,
		});
		expect(rows[0]?.createdAt).toBeInstanceOf(Date);
	});

	it('SECURITY: excludes an interactive add, which carries no `via`', async () => {
		// The JSON path filter is the ONLY thing separating these. Without it a
		// recovery run mails everyone the coordinator ever typed into the add form
		// — people whose notice already went out at the time, months ago.
		const o = await org('novia');
		await auditRow({
			orgId: o.id,
			email: '__notifyonly_integration__typed@example.test',
			via: null,
		});

		expect(await findConciergeImportAuditRows(o.id)).toEqual([]);
	});

	it('SECURITY: excludes another org’s concierge imports', async () => {
		const mine = await org('mine');
		const theirs = await org('theirs');
		await auditRow({
			orgId: theirs.id,
			email: '__notifyonly_integration__someone@example.test',
			via: 'CONCIERGE_IMPORT',
		});

		expect(await findConciergeImportAuditRows(mine.id)).toEqual([]);
	});

	it('excludes a different action on the same entity type', async () => {
		const o = await org('action');
		await auditRow({
			orgId: o.id,
			email: '__notifyonly_integration__left@example.test',
			via: 'CONCIERGE_IMPORT',
			action: 'VOLUNTEER_REMOVED',
		});

		expect(await findConciergeImportAuditRows(o.id)).toEqual([]);
	});

	it('excludes a `via` that is not ours', async () => {
		const o = await org('othervia');
		await auditRow({
			orgId: o.id,
			email: '__notifyonly_integration__other@example.test',
			via: 'SOME_OTHER_TOOL',
		});

		expect(await findConciergeImportAuditRows(o.id)).toEqual([]);
	});

	it('drops a row with no email rather than returning an unmailable one', async () => {
		// Nothing to key it to a CSV line and nothing to send it to.
		const o = await org('noemail');
		await prisma.auditLog.create({
			data: {
				orgId: o.id,
				action: 'VOLUNTEER_ADDED',
				entityType: 'OrgVolunteer',
				metadata: { outcome: 'LINKED_ACTIVE', via: 'CONCIERGE_IMPORT' },
			},
		});

		expect(await findConciergeImportAuditRows(o.id)).toEqual([]);
	});

	it('surfaces a missing outcome as null rather than throwing', async () => {
		// `computeOwedNotices` reports this as MALFORMED_AUDIT_ROW. A throw here
		// would take down a recovery run over one unreadable row.
		const o = await org('nooutcome');
		await prisma.auditLog.create({
			data: {
				orgId: o.id,
				action: 'VOLUNTEER_ADDED',
				entityType: 'OrgVolunteer',
				metadata: {
					email: '__notifyonly_integration__ada@example.test',
					via: 'CONCIERGE_IMPORT',
				},
			},
		});

		const rows = await findConciergeImportAuditRows(o.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.outcome).toBeNull();
	});

	it('returns newest first, so a truncated scan drops the OLDEST adds', async () => {
		// The cap exists as a blast-radius bound. Ordering decides which rows
		// survive it, and the run being recovered is always the most recent one.
		const o = await org('ordering');
		await auditRow({
			orgId: o.id,
			email: '__notifyonly_integration__old@example.test',
			via: 'CONCIERGE_IMPORT',
			createdAt: new Date('2026-01-01T00:00:00Z'),
		});
		await auditRow({
			orgId: o.id,
			email: '__notifyonly_integration__new@example.test',
			via: 'CONCIERGE_IMPORT',
			createdAt: new Date('2026-06-01T00:00:00Z'),
		});

		const rows = await findConciergeImportAuditRows(o.id);
		expect(rows.map((r) => r.email)).toEqual([
			'__notifyonly_integration__new@example.test',
			'__notifyonly_integration__old@example.test',
		]);

		// And the cap actually truncates, keeping the newest.
		const capped = await findConciergeImportAuditRows(o.id, 1);
		expect(capped.map((r) => r.email)).toEqual([
			'__notifyonly_integration__new@example.test',
		]);
	});
});

describe('findSentAddresses', () => {
	const SUBJECT = rosterAddedEmailSubject(`${PREFIX}Shelter`);

	it('matches a SENT event for the exact subject', async () => {
		await emailEvent({
			to: '__notifyonly_integration__ada@example.test',
			subject: SUBJECT,
		});

		const found = await findSentAddresses(
			['__notifyonly_integration__ada@example.test'],
			SUBJECT,
		);
		expect([...found]).toEqual(['__notifyonly_integration__ada@example.test']);
	});

	it('SECURITY: does not match a DIFFERENT subject to the same address', async () => {
		// Every other email this platform sends lands in the same table keyed by
		// the same address. Matching loosely would suppress a roster notice on the
		// strength of an unrelated digest.
		await emailEvent({
			to: '__notifyonly_integration__ada@example.test',
			subject: 'Your weekly volunteer opportunities',
		});

		expect(
			await findSentAddresses(
				['__notifyonly_integration__ada@example.test'],
				SUBJECT,
			),
		).toEqual(new Set());
	});

	it('does not match a subject for a DIFFERENT org', async () => {
		// The subject embeds the org name, which is what scopes this at all —
		// EmailEvent carries no orgId.
		await emailEvent({
			to: '__notifyonly_integration__ada@example.test',
			subject: rosterAddedEmailSubject(`${PREFIX}Other Shelter`),
		});

		expect(
			await findSentAddresses(
				['__notifyonly_integration__ada@example.test'],
				SUBJECT,
			),
		).toEqual(new Set());
	});

	it('ignores a non-SENT event for the same address and subject', async () => {
		// A bounce is not a delivery. Treating it as one withholds the resend from
		// exactly the person whose notice demonstrably did not arrive.
		await emailEvent({
			to: '__notifyonly_integration__ada@example.test',
			subject: SUBJECT,
			eventType: 'BOUNCED',
		});

		expect(
			await findSentAddresses(
				['__notifyonly_integration__ada@example.test'],
				SUBJECT,
			),
		).toEqual(new Set());
	});

	it('returns only the addresses that were asked about', async () => {
		await emailEvent({
			to: '__notifyonly_integration__ada@example.test',
			subject: SUBJECT,
		});
		await emailEvent({
			to: '__notifyonly_integration__grace@example.test',
			subject: SUBJECT,
		});

		const found = await findSentAddresses(
			['__notifyonly_integration__ada@example.test'],
			SUBJECT,
		);
		expect([...found]).toEqual(['__notifyonly_integration__ada@example.test']);
	});

	it('collapses several SENT events for one address', async () => {
		// A resend leaves two rows; the caller wants a set membership test.
		await emailEvent({
			to: '__notifyonly_integration__ada@example.test',
			subject: SUBJECT,
		});
		await emailEvent({
			to: '__notifyonly_integration__ada@example.test',
			subject: SUBJECT,
		});

		const found = await findSentAddresses(
			['__notifyonly_integration__ada@example.test'],
			SUBJECT,
		);
		expect(found.size).toBe(1);
	});

	it('short-circuits an empty address list', async () => {
		expect(await findSentAddresses([], SUBJECT)).toEqual(new Set());
	});
});
