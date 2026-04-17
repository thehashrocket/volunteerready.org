import type { Prisma, PrismaClient } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Skill families
// ---------------------------------------------------------------------------

export async function listFamilies() {
	return prisma.skillFamily.findMany({
		orderBy: [{ order: 'asc' }, { name: 'asc' }],
		select: {
			id: true,
			name: true,
			slug: true,
			isActive: true,
			order: true,
			createdAt: true,
			updatedAt: true,
			_count: { select: { skills: true } },
		},
	});
}

export async function getFamilyBySlug(slug: string) {
	return prisma.skillFamily.findUnique({ where: { slug } });
}

export async function getFamilyByName(name: string) {
	return prisma.skillFamily.findUnique({ where: { name } });
}

export async function getFamilyById(id: string) {
	return prisma.skillFamily.findUnique({ where: { id } });
}

export async function createFamilyTx(
	tx: TxClient,
	data: { name: string; slug: string; order?: number },
) {
	return tx.skillFamily.create({
		data: {
			name: data.name,
			slug: data.slug,
			order: data.order ?? 0,
		},
	});
}

export async function updateFamilyTx(
	tx: TxClient,
	id: string,
	data: {
		name?: string;
		slug?: string;
		order?: number;
		isActive?: boolean;
	},
) {
	return tx.skillFamily.update({ where: { id }, data });
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export async function listSkills() {
	return prisma.skill.findMany({
		orderBy: [{ family: { order: 'asc' } }, { order: 'asc' }, { name: 'asc' }],
		select: {
			id: true,
			name: true,
			slug: true,
			familyId: true,
			isActive: true,
			order: true,
			createdAt: true,
			updatedAt: true,
			family: { select: { id: true, name: true, slug: true } },
		},
	});
}

export async function getSkillBySlug(slug: string) {
	return prisma.skill.findUnique({ where: { slug } });
}

export async function getSkillByName(name: string) {
	return prisma.skill.findUnique({ where: { name } });
}

export async function getSkillById(id: string) {
	return prisma.skill.findUnique({ where: { id } });
}

export async function createSkillTx(
	tx: TxClient,
	data: { familyId: string; name: string; slug: string; order?: number },
) {
	return tx.skill.create({
		data: {
			familyId: data.familyId,
			name: data.name,
			slug: data.slug,
			order: data.order ?? 0,
		},
	});
}

export async function updateSkillTx(
	tx: TxClient,
	id: string,
	data: {
		name?: string;
		slug?: string;
		familyId?: string;
		order?: number;
		isActive?: boolean;
	},
) {
	return tx.skill.update({ where: { id }, data });
}

// ---------------------------------------------------------------------------
// Default screener questions (template rows on platform org)
// ---------------------------------------------------------------------------

export async function listTemplateQuestions() {
	return prisma.screenerQuestion.findMany({
		where: { isTemplate: true },
		orderBy: { order: 'asc' },
	});
}

export async function getTemplateQuestionById(id: string) {
	return prisma.screenerQuestion.findFirst({
		where: { id, isTemplate: true },
	});
}

export async function getTemplateQuestionByKey(key: string) {
	return prisma.screenerQuestion.findFirst({
		where: { isTemplate: true, key },
	});
}

export async function createTemplateQuestionTx(
	tx: TxClient,
	data: {
		orgId: string;
		key: string;
		prompt: string;
		type: Prisma.ScreenerQuestionCreateInput['type'];
		order: number;
		configJson: Prisma.InputJsonValue;
	},
) {
	return tx.screenerQuestion.create({
		data: {
			orgId: data.orgId,
			key: data.key,
			prompt: data.prompt,
			type: data.type,
			order: data.order,
			configJson: data.configJson,
			isActive: true,
			isTemplate: true,
		},
	});
}

export async function updateTemplateQuestionTx(
	tx: TxClient,
	id: string,
	data: {
		prompt?: string;
		type?: Prisma.ScreenerQuestionUpdateInput['type'];
		order?: number;
		configJson?: Prisma.InputJsonValue;
		isActive?: boolean;
	},
) {
	return tx.screenerQuestion.update({
		where: { id },
		data,
	});
}
