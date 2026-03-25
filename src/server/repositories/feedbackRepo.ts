import type {
	FeedbackMood,
	FeedbackStatus,
	Prisma,
} from '@/prisma/generated/client';
import { MOOD_CATEGORY_MAP } from '@/server/domain/user-feedback';
import { prisma } from './prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface CreateFeedbackData {
	userId: string;
	orgId: string | null;
	mood: FeedbackMood;
	message: string;
	pageUrl: string;
	pageName: string | null;
	userAgent: string | null;
	userRole: string | null;
}

interface ListFeedbackFilters {
	status?: FeedbackStatus;
	mood?: FeedbackMood;
	orgId?: string;
	page?: number;
	pageSize?: number;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export async function createFeedback(tx: TxClient, data: CreateFeedbackData) {
	return tx.userFeedback.create({
		data: {
			userId: data.userId,
			orgId: data.orgId,
			mood: data.mood,
			message: data.message,
			pageUrl: data.pageUrl,
			pageName: data.pageName,
			userAgent: data.userAgent,
			userRole: data.userRole,
		},
	});
}

export async function listFeedback(filters: ListFeedbackFilters) {
	const page = filters.page ?? 1;
	const pageSize = filters.pageSize ?? 20;

	const where: Prisma.UserFeedbackWhereInput = {
		deletedAt: null,
		...(filters.status && { status: filters.status }),
		...(filters.mood && { mood: filters.mood }),
		...(filters.orgId && { orgId: filters.orgId }),
	};

	const [items, total] = await Promise.all([
		prisma.userFeedback.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			skip: (page - 1) * pageSize,
			take: pageSize,
			include: {
				user: { select: { id: true, name: true, email: true } },
				organization: { select: { id: true, name: true } },
			},
		}),
		prisma.userFeedback.count({ where }),
	]);

	return { items, total, page, pageSize };
}

export async function findFeedbackById(id: string) {
	return prisma.userFeedback.findFirst({
		where: { id, deletedAt: null },
		include: {
			user: { select: { id: true, name: true, email: true } },
			organization: { select: { id: true, name: true } },
		},
	});
}

export async function updateFeedbackStatus(
	tx: TxClient,
	id: string,
	status: FeedbackStatus,
	actorId: string,
) {
	const existing = await tx.userFeedback.findFirst({
		where: { id, deletedAt: null },
		select: { id: true },
	});
	if (!existing) throw new Error(`Feedback ${id} not found or deleted`);

	const isResolved = status === 'RESOLVED';
	return tx.userFeedback.update({
		where: { id },
		data: {
			status,
			...(isResolved && { resolvedAt: new Date(), resolvedBy: actorId }),
			...(!isResolved && { resolvedAt: null, resolvedBy: null }),
		},
	});
}

export async function updateFeedbackReply(
	tx: TxClient,
	id: string,
	replyMessage: string,
	repliedBy: string,
) {
	const existing = await tx.userFeedback.findFirst({
		where: { id, deletedAt: null },
		select: { id: true },
	});
	if (!existing) throw new Error(`Feedback ${id} not found or deleted`);

	return tx.userFeedback.update({
		where: { id },
		data: {
			replyMessage,
			repliedAt: new Date(),
			repliedBy,
		},
	});
}

export async function listByUser(userId: string) {
	return prisma.userFeedback.findMany({
		where: { userId, deletedAt: null },
		orderBy: { createdAt: 'desc' },
		take: 100,
		select: {
			id: true,
			mood: true,
			message: true,
			pageName: true,
			status: true,
			createdAt: true,
			replyMessage: true,
			repliedAt: true,
		},
	});
}

export async function getFeedbackStats(since?: Date) {
	const sinceDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

	const [byMood, byStatus, topPages, newCount] = await Promise.all([
		// Count by mood
		prisma.userFeedback.groupBy({
			by: ['mood'],
			where: { deletedAt: null, createdAt: { gte: sinceDate } },
			_count: true,
		}),
		// Count by status
		prisma.userFeedback.groupBy({
			by: ['status'],
			where: { deletedAt: null },
			_count: true,
		}),
		// Top 5 pages by bug-mood count
		prisma.userFeedback.groupBy({
			by: ['pageName'],
			where: {
				deletedAt: null,
				createdAt: { gte: sinceDate },
				mood: { in: ['BUG', 'FRUSTRATED'] },
				pageName: { not: null },
			},
			_count: true,
			orderBy: { _count: { mood: 'desc' } },
			take: 5,
		}),
		// New count for dashboard notice
		prisma.userFeedback.count({
			where: { deletedAt: null, status: 'NEW' },
		}),
	]);

	// Derive category breakdown from mood counts
	const byCategory: Record<string, number> = {};
	for (const entry of byMood) {
		const category = MOOD_CATEGORY_MAP[entry.mood];
		byCategory[category] = (byCategory[category] ?? 0) + entry._count;
	}

	return {
		byMood: byMood.map((e) => ({ mood: e.mood, count: e._count })),
		byStatus: byStatus.map((e) => ({ status: e.status, count: e._count })),
		byCategory,
		topFrictionPages: topPages.map((e) => ({
			pageName: e.pageName,
			count: e._count,
		})),
		newCount,
	};
}
