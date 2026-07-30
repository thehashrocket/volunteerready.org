import type { PlanTier, Prisma, PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export async function userIsMemberOfOrg(userId: string, orgId: string) {
	const membership = await prisma.organizationMember.findUnique({
		where: { organizationId_userId: { organizationId: orgId, userId } },
		select: { role: true },
	});
	return membership; // null if not member
}

export async function getFirstOrgForUser(userId: string) {
	const m = await prisma.organizationMember.findFirst({
		where: { userId },
		orderBy: { createdAt: 'asc' },
		select: { organizationId: true, role: true },
	});
	return m; // {orgId, role} | null
}

export async function findOrgBySlug(slug: string) {
	return prisma.organization.findUnique({
		where: { slug },
		select: { id: true, slug: true },
	});
}

/**
 * Suspension state alone, for guards that must not pull the whole org row.
 *
 * `orgProcedure` inlines this same lookup; `requireOrgAccess` — the raw
 * Route-Handler counterpart — needs it too, and a suspended org bulk-exporting
 * its roster through a route that skipped tRPC is exactly the gap that would
 * open if the second guard forgot it.
 */
export async function getOrgSuspension(orgId: string) {
	return prisma.organization.findUnique({
		where: { id: orgId },
		select: { suspendedAt: true },
	});
}

/**
 * Resolve an org from whatever an operator typed on a command line.
 *
 * Exists for the concierge importer (T17), where the person running it knows
 * the org by its apply slug ("riverside-animal-shelter") but the id is what
 * actually appears in a support thread. Accepting either removes a lookup step
 * from a flow whose whole point is being fast.
 *
 * Returns `name` because the script prints it back for confirmation before
 * writing — an import into the wrong org is the mistake worth spending a query
 * to prevent.
 */
export async function findOrgByIdOrSlug(idOrSlug: string) {
	// SECURITY: id FIRST, as two separate unique lookups — never one `findFirst`
	// with `OR: [{ id }, { slug }]`. `Organization.id` is a cuid, a 25-char
	// lowercase alphanumeric string, and `ORG_SLUG_PATTERN`
	// (/^[a-z0-9]+(-[a-z0-9]+)*$/) accepts exactly that shape — verified. So an
	// org can register another org's id as its own slug, and an unordered
	// `findFirst` would return whichever row Postgres happened to reach. That
	// hands the squatter a concierge import aimed at the victim's id, and 404s
	// the victim's own roster export. Two `findUnique` calls make the precedence
	// explicit: an id always beats a slug, and the second query only runs on a
	// miss.
	const byId = await prisma.organization.findUnique({
		where: { id: idOrSlug },
		select: { id: true, slug: true, name: true, suspendedAt: true },
	});
	if (byId) return byId;

	return prisma.organization.findUnique({
		where: { slug: idOrSlug },
		select: { id: true, slug: true, name: true, suspendedAt: true },
	});
}

export async function getOrgPlanTier(orgId: string): Promise<PlanTier> {
	const org = await prisma.organization.findUniqueOrThrow({
		where: { id: orgId },
		select: { planTier: true },
	});
	return org.planTier;
}

export async function findOrgByStripeCustomerId(stripeCustomerId: string) {
	return prisma.organization.findUnique({
		where: { stripeCustomerId },
		select: { id: true, planTier: true, stripeCustomerId: true },
	});
}

export async function findOrgWithOwnerEmail(orgId: string) {
	return prisma.organization.findUnique({
		where: { id: orgId },
		select: {
			id: true,
			name: true,
			members: {
				where: { role: 'OWNER' },
				take: 1,
				select: { user: { select: { email: true, name: true } } },
			},
		},
	});
}

export async function updateOrgPlanTx(
	tx: TxClient,
	orgId: string,
	data: {
		planTier: PlanTier;
		stripeCustomerId?: string;
		stripeSubscriptionId?: string | null;
		trialEndsAt?: Date | null;
	},
) {
	return tx.organization.update({
		where: { id: orgId },
		data: data as Prisma.OrganizationUpdateInput,
		select: { id: true, planTier: true },
	});
}

export async function getOrgProfile(orgId: string) {
	return prisma.organization.findUnique({
		where: { id: orgId },
		select: { id: true, name: true, slug: true },
	});
}

/**
 * Resolve an old (renamed-away) slug to the org's CURRENT slug via
 * OrgSlugHistory. Callers must check the current slug first — a live org
 * slug always wins over history. Returns null when no history matches or
 * the org is suspended.
 */
export async function findCurrentSlugByHistory(oldSlug: string) {
	const row = await prisma.orgSlugHistory.findFirst({
		where: { oldSlug },
		orderBy: { createdAt: 'desc' },
		select: { organization: { select: { slug: true, suspendedAt: true } } },
	});
	if (!row || row.organization.suspendedAt) return null;
	return row.organization.slug;
}

/** True when any org (including suspended) has ever held this slug. */
export async function slugExistsInHistory(slug: string) {
	const row = await prisma.orgSlugHistory.findFirst({
		where: { oldSlug: slug },
		select: { id: true },
	});
	return row !== null;
}
