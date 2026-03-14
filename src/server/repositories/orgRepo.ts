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
