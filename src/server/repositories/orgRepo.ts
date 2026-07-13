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
