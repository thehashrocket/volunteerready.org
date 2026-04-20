import type { Prisma } from '@/prisma/generated/client';
import { prisma } from './prisma';

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

export async function listOrgsPage(options: {
	search?: string;
	cursor?: string | null;
	limit?: number;
}) {
	const take = Math.min(options.limit ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
	const search = options.search?.trim();

	const where: Prisma.OrganizationWhereInput = search
		? {
				OR: [
					{ slug: { contains: search, mode: 'insensitive' } },
					{ name: { contains: search, mode: 'insensitive' } },
				],
			}
		: {};

	const rows = await prisma.organization.findMany({
		where,
		take: take + 1,
		cursor: options.cursor ? { id: options.cursor } : undefined,
		skip: options.cursor ? 1 : 0,
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			slug: true,
			name: true,
			planTier: true,
			suspendedAt: true,
			createdAt: true,
			_count: {
				select: {
					members: true,
					opportunities: true,
					applications: true,
				},
			},
		},
	});

	const hasMore = rows.length > take;
	const sliced = hasMore ? rows.slice(0, take) : rows;
	const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

	return {
		orgs: sliced.map((o) => ({
			id: o.id,
			slug: o.slug,
			name: o.name,
			planTier: o.planTier,
			suspendedAt: o.suspendedAt,
			createdAt: o.createdAt,
			memberCount: o._count.members,
			opportunityCount: o._count.opportunities,
			applicationCount: o._count.applications,
		})),
		nextCursor,
	};
}

export async function getOrgDetail(id: string) {
	const org = await prisma.organization.findUnique({
		where: { id },
		select: {
			id: true,
			slug: true,
			name: true,
			planTier: true,
			stripeCustomerId: true,
			stripeSubscriptionId: true,
			trialEndsAt: true,
			timezone: true,
			logoUrl: true,
			consentToPublicize: true,
			onboardingComplete: true,
			showPoweredBy: true,
			firstApplicationReceivedAt: true,
			checkrAccountId: true,
			sterlingAccountId: true,
			suspendedAt: true,
			suspendedReason: true,
			suspendedById: true,
			suspendedBy: { select: { id: true, email: true, name: true } },
			createdAt: true,
			updatedAt: true,
			_count: {
				select: {
					members: true,
					opportunities: true,
					applications: true,
					credentials: true,
					shifts: true,
					screenerQuestions: true,
				},
			},
		},
	});

	return org;
}

export async function listOrgMembers(orgId: string) {
	return prisma.organizationMember.findMany({
		where: { organizationId: orgId },
		orderBy: { createdAt: 'asc' },
		select: {
			id: true,
			role: true,
			createdAt: true,
			lastActivityAt: true,
			user: {
				select: { id: true, email: true, name: true, isPlatformAdmin: true },
			},
		},
	});
}

export async function listOrgOpportunities(orgId: string, limit = 50) {
	return prisma.volunteerOpportunity.findMany({
		where: { orgId },
		orderBy: { createdAt: 'desc' },
		take: Math.min(limit, 200),
		select: {
			id: true,
			title: true,
			status: true,
			createdAt: true,
			updatedAt: true,
		},
	});
}

export async function listOrgApplications(orgId: string, limit = 50) {
	return prisma.volunteerApplication.findMany({
		where: { orgId },
		orderBy: { submittedAt: 'desc' },
		take: Math.min(limit, 200),
		select: {
			id: true,
			status: true,
			screeningStatus: true,
			submittedByEmail: true,
			submittedAt: true,
			opportunity: { select: { id: true, title: true } },
		},
	});
}

type Tx = Prisma.TransactionClient;

export async function setOrgSuspendedTx(
	tx: Tx,
	args: {
		id: string;
		suspendedAt: Date | null;
		suspendedReason: string | null;
		suspendedById: string | null;
	},
) {
	return tx.organization.update({
		where: { id: args.id },
		data: {
			suspendedAt: args.suspendedAt,
			suspendedReason: args.suspendedReason,
			suspendedById: args.suspendedById,
		},
		select: {
			id: true,
			slug: true,
			name: true,
			suspendedAt: true,
			suspendedReason: true,
			suspendedById: true,
		},
	});
}

export async function getOrgSuspensionStatus(orgId: string): Promise<{
	suspendedAt: Date | null;
	suspendedReason: string | null;
} | null> {
	return prisma.organization.findUnique({
		where: { id: orgId },
		select: { suspendedAt: true, suspendedReason: true },
	});
}
