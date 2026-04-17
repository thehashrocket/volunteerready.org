import type { Prisma, PrismaClient } from '@/prisma/generated/client';
import { prisma } from './prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

export async function listUsersPage(options: {
	search?: string;
	cursor?: string | null;
	limit?: number;
}) {
	const take = Math.min(options.limit ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
	const search = options.search?.trim();

	const where: Prisma.UserWhereInput = search
		? {
				OR: [
					{ email: { contains: search, mode: 'insensitive' } },
					{ name: { contains: search, mode: 'insensitive' } },
				],
			}
		: {};

	const rows = await prisma.user.findMany({
		where,
		take: take + 1,
		cursor: options.cursor ? { id: options.cursor } : undefined,
		skip: options.cursor ? 1 : 0,
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			email: true,
			name: true,
			createdAt: true,
			isPlatformAdmin: true,
			_count: {
				select: { memberships: true, companyMemberships: true },
			},
			sessions: {
				orderBy: { expires: 'desc' },
				take: 1,
				select: { expires: true },
			},
		},
	});

	const hasMore = rows.length > take;
	const sliced = hasMore ? rows.slice(0, take) : rows;
	const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

	return {
		users: sliced.map((u) => ({
			id: u.id,
			email: u.email,
			name: u.name,
			createdAt: u.createdAt,
			isPlatformAdmin: u.isPlatformAdmin,
			orgMembershipCount: u._count.memberships,
			companyMembershipCount: u._count.companyMemberships,
			lastSessionExpires: u.sessions[0]?.expires ?? null,
		})),
		nextCursor,
	};
}

export async function getUserDetail(id: string) {
	const user = await prisma.user.findUnique({
		where: { id },
		select: {
			id: true,
			email: true,
			name: true,
			image: true,
			emailVerified: true,
			isPlatformAdmin: true,
			createdAt: true,
			updatedAt: true,
			memberships: {
				select: {
					id: true,
					role: true,
					createdAt: true,
					lastActivityAt: true,
					organization: {
						select: { id: true, slug: true, name: true },
					},
				},
				orderBy: { createdAt: 'asc' },
			},
			companyMemberships: {
				select: {
					companyId: true,
					role: true,
					createdAt: true,
					company: { select: { id: true, name: true } },
				},
				orderBy: { createdAt: 'asc' },
			},
			sessions: {
				select: {
					id: true,
					expires: true,
					createdAt: true,
					updatedAt: true,
					currentOrgId: true,
					currentCompanyId: true,
				},
				orderBy: { expires: 'desc' },
			},
		},
	});

	return user;
}

export async function countSubmittedApplications(userId: string) {
	return prisma.volunteerApplication.count({
		where: { submittedByUserId: userId },
	});
}

export async function listSubmittedApplications(userId: string, take = 100) {
	return prisma.volunteerApplication.findMany({
		where: { submittedByUserId: userId },
		take,
		orderBy: { submittedAt: 'desc' },
		select: {
			id: true,
			status: true,
			screeningStatus: true,
			submittedAt: true,
			organization: { select: { id: true, slug: true, name: true } },
			opportunity: { select: { id: true, title: true } },
		},
	});
}

export async function updateUserPlatformAdminTx(
	tx: TxClient,
	id: string,
	value: boolean,
) {
	return tx.user.update({
		where: { id },
		data: { isPlatformAdmin: value },
		select: { id: true, isPlatformAdmin: true, email: true, name: true },
	});
}

export async function deleteUserSessionsTx(tx: TxClient, userId: string) {
	return tx.session.deleteMany({ where: { userId } });
}
