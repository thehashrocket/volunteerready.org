import type {
	Prisma,
	PrismaClient,
	ScreenerQuestionType,
} from '@/prisma/generated/client';
import { PLATFORM_ORG_SLUG } from '@/server/domain/reference-data';
import { prisma } from '@/server/repositories/prisma';

export async function listQuestions(
	orgId: string,
	opts?: { cursor?: string; limit?: number },
) {
	const limit = Math.min(opts?.limit ?? 50, 100);

	const items = await prisma.screenerQuestion.findMany({
		where: { orgId, isTemplate: false },
		orderBy: { order: 'asc' },
		take: limit + 1,
		...(opts?.cursor && {
			cursor: { id: opts.cursor },
			skip: 1,
		}),
	});

	const hasMore = items.length > limit;
	if (hasMore) items.pop();

	return {
		items,
		nextCursor: hasMore ? items[items.length - 1]?.id : null,
	};
}

export async function getQuestion(orgId: string, id: string) {
	return prisma.screenerQuestion.findFirst({
		where: { id, orgId, isTemplate: false },
	});
}

export async function getMaxOrder(orgId: string): Promise<number> {
	const agg = await prisma.screenerQuestion.aggregate({
		where: { orgId, isTemplate: false },
		_max: { order: true },
	});
	return agg._max.order ?? 0;
}

export async function createQuestion(
	orgId: string,
	data: {
		key: string;
		prompt: string;
		type: ScreenerQuestionType;
		order: number;
		configJson: Prisma.InputJsonValue;
	},
) {
	return prisma.screenerQuestion.create({
		data: { orgId, ...data, isActive: true },
	});
}

export async function updateQuestion(
	orgId: string,
	id: string,
	data: {
		prompt?: string;
		configJson?: Prisma.InputJsonValue;
		isActive?: boolean;
	},
) {
	const existing = await prisma.screenerQuestion.findFirst({
		where: { id, orgId, isTemplate: false },
		select: { id: true },
	});
	if (!existing) {
		throw new Error(`Question ${id} not found in org ${orgId}`);
	}
	return prisma.screenerQuestion.update({ where: { id }, data });
}

export async function findAdjacentQuestion(
	orgId: string,
	currentOrder: number,
	direction: 'up' | 'down',
) {
	if (direction === 'up') {
		return prisma.screenerQuestion.findFirst({
			where: { orgId, isTemplate: false, order: { lt: currentOrder } },
			orderBy: { order: 'desc' },
		});
	}
	return prisma.screenerQuestion.findFirst({
		where: { orgId, isTemplate: false, order: { gt: currentOrder } },
		orderBy: { order: 'asc' },
	});
}

export async function swapOrders(
	orgId: string,
	id1: string,
	order1: number,
	id2: string,
	order2: number,
) {
	return prisma.$transaction([
		prisma.screenerQuestion.updateMany({
			where: { id: id1, orgId, isTemplate: false },
			data: { order: order2 },
		}),
		prisma.screenerQuestion.updateMany({
			where: { id: id2, orgId, isTemplate: false },
			data: { order: order1 },
		}),
	]);
}

export async function deleteQuestion(orgId: string, id: string) {
	const existing = await prisma.screenerQuestion.findFirst({
		where: { id, orgId, isTemplate: false },
		select: { id: true },
	});
	if (!existing) {
		throw new Error(`Question ${id} not found in org ${orgId}`);
	}
	return prisma.screenerQuestion.delete({ where: { id } });
}

/**
 * Seed default screener questions for a new org by copying active template rows
 * (isTemplate=true, isActive=true, owned by the platform org) into the target org.
 *
 * Platform admins edit the templates via the catalog editor; new orgs
 * created after an edit get the updated wording. Existing orgs are not
 * retroactively updated — each org owns its screener after creation.
 *
 * Inactive templates are skipped (matches the UI contract that deactivating
 * a template removes it from new-org onboarding). Copied rows are always
 * created with isActive=true.
 *
 * If no active templates exist (fresh install before boot guard ran, or all
 * deactivated), we log a warning and create the org with no default questions.
 *
 * Accepts an optional transaction client so it can run inside createOrg's
 * transaction.
 */
export async function seedDefaultQuestions(
	orgId: string,
	tx?: Omit<
		PrismaClient,
		'$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
	>,
) {
	const db = tx ?? prisma;

	const platformOrg = await db.organization.findUnique({
		where: { slug: PLATFORM_ORG_SLUG },
		select: { id: true },
	});
	if (platformOrg && platformOrg.id === orgId) {
		return;
	}

	const templates = await db.screenerQuestion.findMany({
		where: { isTemplate: true, isActive: true },
		orderBy: { order: 'asc' },
		select: {
			key: true,
			prompt: true,
			type: true,
			order: true,
			configJson: true,
		},
	});

	if (templates.length === 0) {
		console.warn(
			`[seedDefaultQuestions] No active template questions found for org ${orgId}. ` +
				'Boot guard may not have run yet, or all templates were deactivated. ' +
				'Org will be created with no default screener questions.',
		);
	}

	for (const t of templates) {
		await db.screenerQuestion.create({
			data: {
				orgId,
				key: t.key,
				prompt: t.prompt,
				type: t.type,
				order: t.order,
				isActive: true,
				configJson: t.configJson as Prisma.InputJsonValue,
			},
		});
	}
}

export async function questionHasAnswers(questionId: string): Promise<boolean> {
	const count = await prisma.volunteerAnswer.count({ where: { questionId } });
	return count > 0;
}
