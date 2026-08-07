import type { PrismaClient } from '@/prisma/generated/client';
import {
	CREDENTIAL_EXPIRY_NOTICE_ORG_CAP,
	credentialExpiryWindowEnd,
	credentialNoticeCycleStart,
} from '../domain/credential-expiry';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Find VERIFIED credentials with expiresAt in the past.
 *
 * Takes `now` so the cron can hand the SAME instant to this and to
 * `findOrgsNeedingExpiryNotice`. They ran off two separate `new Date()` reads
 * before, which made the "disjoint" claim below true only by near-simultaneity
 * — a credential expiring between the two reads matched `lt` here and `gt`
 * there, so it could be expired and warned about in one run, with the notice
 * saying it expires in 0 days.
 */
export async function findExpiredCredentials(now = new Date(), limit = 500) {
	return prisma.volunteerCredential.findMany({
		where: {
			status: 'VERIFIED',
			expiresAt: { lt: now },
		},
		select: { id: true, userId: true, orgId: true, type: true },
		take: limit,
	});
}

/** Mark a single credential as EXPIRED inside a transaction. */
export async function markCredentialExpiredTx(
	tx: TxClient,
	credentialId: string,
) {
	return tx.volunteerCredential.update({
		where: { id: credentialId },
		data: { status: 'EXPIRED' },
	});
}

/**
 * The `where` shared by both halves of the notice scan.
 *
 * One definition, because the org-selection query and the per-org fetch MUST
 * agree: if they drift, phase 1 promises an org a slot and phase 2 hands it a
 * different set of credentials — or none, producing an empty email.
 *
 * `expiresAt: { gt: now }` is what keeps this set disjoint from
 * `findExpiredCredentials`' `lt: now`, so both can run inside the same cron's
 * fan-out. That holds only because the cron passes ONE `now` to both; it is not
 * true by construction if they each read the clock.
 */
function noticeDueWhere(now: Date) {
	return {
		status: 'VERIFIED' as const,
		expiresAt: { gt: now, lte: credentialExpiryWindowEnd(now) },
		// Renewal-aware, NOT `notifiedAt: null` — see credentialNoticeCycleStart.
		OR: [
			{ notifiedAt: null },
			{ notifiedAt: { lt: credentialNoticeCycleStart(now) } },
		],
		organization: {
			// A suspended tenant is frozen; it must not be emailed its volunteers'
			// names, and every marketplace query in this repo filters the same way.
			suspendedAt: null,
			// SECURITY + LIVENESS. An org with nobody to tell can never be stamped,
			// so without this it re-enters every night, sorts FIRST because it is
			// the most urgent, and progressively eats the org cap until no
			// reachable org is served at all. Excluding it at the query is what
			// bounds that; it costs those credentials their notice, which is
			// already true, and surfaces as `orgsWithNoRecipients`.
			members: { some: { role: { in: ['OWNER' as const, 'ADMIN' as const] } } },
		},
	};
}

/**
 * Phase 1 — which ORGS get a notice this run, most urgent first.
 *
 * The cap is on orgs rather than credentials because the email enumerates a
 * bundle and claims to be complete. A row-capped scan truncates whichever org
 * straddles the limit, so that org is told about four of its seven expiring
 * credentials in a message that reads as the whole list. Selecting orgs first
 * and fetching their credentials second means a bundle is served whole or
 * waits for tomorrow.
 *
 * `distinct` + `orderBy expiresAt` gives each org the position of its most
 * urgent credential, which is the ordering that matters when the cap bites.
 */
export async function findOrgsNeedingExpiryNotice(
	now: Date,
	limit = CREDENTIAL_EXPIRY_NOTICE_ORG_CAP,
) {
	const rows = await prisma.volunteerCredential.findMany({
		where: noticeDueWhere(now),
		select: { orgId: true },
		distinct: ['orgId'],
		orderBy: { expiresAt: 'asc' },
		take: limit,
	});
	return rows.map((r) => r.orgId);
}

/** Phase 2 — every due credential for the orgs phase 1 picked. Uncapped. */
export async function findExpiryNoticeCredentialsForOrgs(
	now: Date,
	orgIds: readonly string[],
) {
	if (orgIds.length === 0) return [];
	return prisma.volunteerCredential.findMany({
		where: { ...noticeDueWhere(now), orgId: { in: [...orgIds] } },
		select: {
			id: true,
			orgId: true,
			type: true,
			expiresAt: true,
			notifiedAt: true,
			user: { select: { name: true } },
			organization: { select: { name: true } },
		},
		orderBy: { expiresAt: 'asc' },
	});
}

/**
 * Stamp `notifiedAt` on a batch, inside the caller's transaction so the audit
 * row and the stamp cannot disagree.
 *
 * The WHERE re-states the cycle predicate rather than a bare `notifiedAt: null`
 * so a concurrent run cannot overwrite a stamp from THIS cycle, while a stamp
 * from a previous cycle (a renewal) is still allowed to be replaced. A short
 * `count` means someone else got there first, which the caller reports rather
 * than treating as its own success.
 */
export async function markCredentialsNotifiedTx(
	tx: TxClient,
	credentialIds: readonly string[],
	now: Date,
) {
	if (credentialIds.length === 0) return { count: 0 };
	return tx.volunteerCredential.updateMany({
		where: {
			id: { in: [...credentialIds] },
			OR: [
				{ notifiedAt: null },
				{ notifiedAt: { lt: credentialNoticeCycleStart(now) } },
			],
		},
		data: { notifiedAt: now },
	});
}

/** Find ACTIVE share tokens with expiresAt in the past. */
export async function findExpiredShareTokens(limit = 500) {
	return prisma.credentialShareToken.findMany({
		where: {
			status: 'ACTIVE',
			expiresAt: { lt: new Date() },
		},
		select: { id: true },
		take: limit,
	});
}
