import type {
	CompanyMemberRole,
	CompanyNonprofitLinkStatus,
	PlanTier,
	PrismaClient,
} from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Returns company fields safe to send to the client.
 * stripeCustomerId / stripeSubscriptionId are intentionally omitted.
 */
export async function findCompanyById(id: string) {
	return prisma.companyAccount.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			slug: true,
			planTier: true,
			trialEndsAt: true,
			createdAt: true,
			updatedAt: true,
		},
	});
}

export async function findCompanyBySlug(slug: string) {
	return prisma.companyAccount.findUnique({
		where: { slug },
		select: { id: true, slug: true },
	});
}

export async function findCompanyByStripeCustomerId(stripeCustomerId: string) {
	return prisma.companyAccount.findUnique({
		where: { stripeCustomerId },
		select: { id: true, planTier: true, stripeCustomerId: true },
	});
}

export async function createCompanyWithOwnerTx(
	tx: TxClient,
	{
		name,
		slug,
		userId,
		sessionToken,
	}: { name: string; slug: string; userId: string; sessionToken: string },
) {
	const company = await tx.companyAccount.create({
		data: { name, slug },
		select: { id: true, slug: true },
	});

	await tx.companyMember.create({
		data: { companyId: company.id, userId, role: 'OWNER' },
	});

	await tx.session.update({
		where: { sessionToken },
		data: { currentCompanyId: company.id },
	});

	return company;
}

export async function updateCompanyPlanTx(
	tx: TxClient,
	companyId: string,
	data: {
		planTier: PlanTier;
		stripeSubscriptionId?: string | null;
		trialEndsAt?: Date | null;
	},
) {
	return tx.companyAccount.update({
		where: { id: companyId },
		data,
		select: { id: true, planTier: true },
	});
}

export async function listCompaniesForUser(userId: string) {
	const memberships = await prisma.companyMember.findMany({
		where: { userId },
		orderBy: { createdAt: 'asc' },
		select: {
			role: true,
			company: {
				select: {
					id: true,
					name: true,
					slug: true,
					planTier: true,
				},
			},
		},
	});
	return memberships;
}

export async function getCompanyMembership(
	userId: string,
	companyId: string,
): Promise<{ role: CompanyMemberRole } | null> {
	return prisma.companyMember.findUnique({
		where: { companyId_userId: { companyId, userId } },
		select: { role: true },
	});
}

export async function upsertNonprofitLinkTx(
	tx: TxClient,
	{ companyId, orgId }: { companyId: string; orgId: string },
) {
	return tx.companyNonprofitLink.upsert({
		where: { companyId_orgId: { companyId, orgId } },
		create: { companyId, orgId, status: 'ACTIVE' },
		update: { status: 'ACTIVE' },
		select: { id: true, status: true },
	});
}

export async function setNonprofitLinkStatusTx(
	tx: TxClient,
	linkId: string,
	status: CompanyNonprofitLinkStatus,
) {
	return tx.companyNonprofitLink.update({
		where: { id: linkId },
		data: { status },
		select: { id: true, status: true },
	});
}

export async function listLinkedNonprofits(companyId: string) {
	return prisma.companyNonprofitLink.findMany({
		where: { companyId, status: 'ACTIVE' },
		orderBy: { createdAt: 'asc' },
		select: {
			id: true,
			status: true,
			createdAt: true,
			org: { select: { id: true, name: true, slug: true } },
		},
	});
}
