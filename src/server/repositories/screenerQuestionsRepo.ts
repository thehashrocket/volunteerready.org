import type { Prisma, ScreenerQuestionType } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

export async function listQuestions(orgId: string) {
	return prisma.screenerQuestion.findMany({
		where: { orgId },
		orderBy: { order: 'asc' },
	});
}

export async function getQuestion(orgId: string, id: string) {
	return prisma.screenerQuestion.findFirst({ where: { id, orgId } });
}

export async function getMaxOrder(orgId: string): Promise<number> {
	const agg = await prisma.screenerQuestion.aggregate({
		where: { orgId },
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
	return prisma.screenerQuestion.update({ where: { id, orgId }, data });
}

export async function findAdjacentQuestion(
	orgId: string,
	currentOrder: number,
	direction: 'up' | 'down',
) {
	if (direction === 'up') {
		return prisma.screenerQuestion.findFirst({
			where: { orgId, order: { lt: currentOrder } },
			orderBy: { order: 'desc' },
		});
	}
	return prisma.screenerQuestion.findFirst({
		where: { orgId, order: { gt: currentOrder } },
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
		prisma.screenerQuestion.update({
			where: { id: id1, orgId },
			data: { order: order2 },
		}),
		prisma.screenerQuestion.update({
			where: { id: id2, orgId },
			data: { order: order1 },
		}),
	]);
}

export async function deleteQuestion(orgId: string, id: string) {
	return prisma.screenerQuestion.delete({ where: { id, orgId } });
}

export async function questionHasAnswers(questionId: string): Promise<boolean> {
	const count = await prisma.volunteerAnswer.count({ where: { questionId } });
	return count > 0;
}
