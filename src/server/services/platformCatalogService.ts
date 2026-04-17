import { TRPCError } from '@trpc/server';
import type { Prisma, ScreenerQuestionType } from '@/prisma/generated/client';
import type {
	CreateDefaultQuestionInput,
	CreateSkillFamilyInput,
	CreateSkillInput,
	UpdateDefaultQuestionInput,
	UpdateSkillFamilyInput,
	UpdateSkillInput,
} from '@/server/domain/platform-catalog';
import { PLATFORM_ORG_SLUG } from '@/server/domain/reference-data';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	createFamilyTx,
	createSkillTx,
	createTemplateQuestionTx,
	getFamilyById,
	getFamilyByName,
	getFamilyBySlug,
	getSkillById,
	getSkillByName,
	getSkillBySlug,
	getTemplateQuestionById,
	getTemplateQuestionByKey,
	listFamilies,
	listSkills,
	listTemplateQuestions,
	updateFamilyTx,
	updateSkillTx,
	updateTemplateQuestionTx,
} from '@/server/repositories/platformCatalogRepo';
import { prisma } from '@/server/repositories/prisma';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getCatalog() {
	const [families, skills] = await Promise.all([listFamilies(), listSkills()]);
	return { families, skills };
}

export async function getDefaultQuestions() {
	const questions = await listTemplateQuestions();
	return { questions };
}

// ---------------------------------------------------------------------------
// Skill families
// ---------------------------------------------------------------------------

export async function createSkillFamily(
	input: CreateSkillFamilyInput & { actorId: string },
) {
	const existing = await getFamilyBySlug(input.slug);
	if (existing) {
		throw new TRPCError({
			code: 'CONFLICT',
			message: `A skill family with slug "${input.slug}" already exists.`,
		});
	}

	const nameClash = await getFamilyByName(input.name);
	if (nameClash) {
		throw new TRPCError({
			code: 'CONFLICT',
			message: `A skill family with name "${input.name}" already exists.`,
		});
	}

	return prisma.$transaction(async (tx) => {
		const family = await createFamilyTx(tx, {
			name: input.name,
			slug: input.slug,
			order: input.order,
		});
		await writeAuditLogTx(tx, {
			actorId: input.actorId,
			action: 'SKILL_FAMILY_CREATED',
			entityType: 'SkillFamily',
			entityId: family.id,
			metadata: {
				name: family.name,
				slug: family.slug,
				order: family.order,
			},
		});
		return family;
	});
}

export async function updateSkillFamily(
	input: UpdateSkillFamilyInput & { actorId: string },
) {
	const existing = await getFamilyById(input.id);
	if (!existing) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found.' });
	}

	if (input.slug && input.slug !== existing.slug) {
		const slugClash = await getFamilyBySlug(input.slug);
		if (slugClash && slugClash.id !== existing.id) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: `A skill family with slug "${input.slug}" already exists.`,
			});
		}
	}

	if (input.name && input.name !== existing.name) {
		const nameClash = await getFamilyByName(input.name);
		if (nameClash && nameClash.id !== existing.id) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: `A skill family with name "${input.name}" already exists.`,
			});
		}
	}

	return prisma.$transaction(async (tx) => {
		const updated = await updateFamilyTx(tx, input.id, {
			name: input.name,
			slug: input.slug,
			order: input.order,
			isActive: input.isActive,
		});
		await writeAuditLogTx(tx, {
			actorId: input.actorId,
			action:
				input.isActive === false && existing.isActive
					? 'SKILL_FAMILY_DEACTIVATED'
					: input.isActive === true && !existing.isActive
						? 'SKILL_FAMILY_REACTIVATED'
						: 'SKILL_FAMILY_UPDATED',
			entityType: 'SkillFamily',
			entityId: updated.id,
			metadata: {
				before: {
					name: existing.name,
					slug: existing.slug,
					order: existing.order,
					isActive: existing.isActive,
				},
				after: {
					name: updated.name,
					slug: updated.slug,
					order: updated.order,
					isActive: updated.isActive,
				},
			},
		});
		return updated;
	});
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export async function createSkill(
	input: CreateSkillInput & { actorId: string },
) {
	const family = await getFamilyById(input.familyId);
	if (!family) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found.' });
	}

	const slugClash = await getSkillBySlug(input.slug);
	if (slugClash) {
		throw new TRPCError({
			code: 'CONFLICT',
			message: `A skill with slug "${input.slug}" already exists.`,
		});
	}

	const nameClash = await getSkillByName(input.name);
	if (nameClash) {
		throw new TRPCError({
			code: 'CONFLICT',
			message: `A skill with name "${input.name}" already exists.`,
		});
	}

	return prisma.$transaction(async (tx) => {
		const skill = await createSkillTx(tx, {
			familyId: input.familyId,
			name: input.name,
			slug: input.slug,
			order: input.order,
		});
		await writeAuditLogTx(tx, {
			actorId: input.actorId,
			action: 'SKILL_CREATED',
			entityType: 'Skill',
			entityId: skill.id,
			metadata: {
				name: skill.name,
				slug: skill.slug,
				familyId: skill.familyId,
				familySlug: family.slug,
				order: skill.order,
			},
		});
		return skill;
	});
}

export async function updateSkill(
	input: UpdateSkillInput & { actorId: string },
) {
	const existing = await getSkillById(input.id);
	if (!existing) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found.' });
	}

	if (input.slug && input.slug !== existing.slug) {
		const slugClash = await getSkillBySlug(input.slug);
		if (slugClash && slugClash.id !== existing.id) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: `A skill with slug "${input.slug}" already exists.`,
			});
		}
	}

	if (input.name && input.name !== existing.name) {
		const nameClash = await getSkillByName(input.name);
		if (nameClash && nameClash.id !== existing.id) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: `A skill with name "${input.name}" already exists.`,
			});
		}
	}

	if (input.familyId && input.familyId !== existing.familyId) {
		const family = await getFamilyById(input.familyId);
		if (!family) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'Family not found.',
			});
		}
	}

	return prisma.$transaction(async (tx) => {
		const updated = await updateSkillTx(tx, input.id, {
			name: input.name,
			slug: input.slug,
			familyId: input.familyId,
			order: input.order,
			isActive: input.isActive,
		});
		await writeAuditLogTx(tx, {
			actorId: input.actorId,
			action:
				input.isActive === false && existing.isActive
					? 'SKILL_DEACTIVATED'
					: input.isActive === true && !existing.isActive
						? 'SKILL_REACTIVATED'
						: 'SKILL_UPDATED',
			entityType: 'Skill',
			entityId: updated.id,
			metadata: {
				before: {
					name: existing.name,
					slug: existing.slug,
					familyId: existing.familyId,
					order: existing.order,
					isActive: existing.isActive,
				},
				after: {
					name: updated.name,
					slug: updated.slug,
					familyId: updated.familyId,
					order: updated.order,
					isActive: updated.isActive,
				},
			},
		});
		return updated;
	});
}

// ---------------------------------------------------------------------------
// Default screener questions — stored as isTemplate=true rows on platform org
// ---------------------------------------------------------------------------

async function getPlatformOrgIdOrThrow(): Promise<string> {
	const org = await prisma.organization.findUnique({
		where: { slug: PLATFORM_ORG_SLUG },
		select: { id: true },
	});
	if (!org) {
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message:
				'Platform org is missing. Reference data boot guard should have seeded it.',
		});
	}
	return org.id;
}

export async function createDefaultQuestion(
	input: CreateDefaultQuestionInput & { actorId: string },
) {
	const keyClash = await getTemplateQuestionByKey(input.key);
	if (keyClash) {
		throw new TRPCError({
			code: 'CONFLICT',
			message: `A default question with key "${input.key}" already exists.`,
		});
	}

	const orgId = await getPlatformOrgIdOrThrow();

	return prisma.$transaction(async (tx) => {
		const created = await createTemplateQuestionTx(tx, {
			orgId,
			key: input.key,
			prompt: input.prompt,
			type: input.type as ScreenerQuestionType,
			order: input.order ?? 0,
			configJson: input.configJson as Prisma.InputJsonValue,
		});
		await writeAuditLogTx(tx, {
			actorId: input.actorId,
			action: 'DEFAULT_QUESTION_CREATED',
			entityType: 'ScreenerQuestionTemplate',
			entityId: created.id,
			metadata: {
				key: created.key,
				prompt: created.prompt,
				type: created.type,
				order: created.order,
			},
		});
		return created;
	});
}

export async function updateDefaultQuestion(
	input: UpdateDefaultQuestionInput & { actorId: string },
) {
	const existing = await getTemplateQuestionById(input.id);
	if (!existing) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Default question not found.',
		});
	}

	return prisma.$transaction(async (tx) => {
		const updated = await updateTemplateQuestionTx(tx, input.id, {
			prompt: input.prompt,
			type: input.type as ScreenerQuestionType | undefined,
			order: input.order,
			configJson: input.configJson as Prisma.InputJsonValue | undefined,
			isActive: input.isActive,
		});
		await writeAuditLogTx(tx, {
			actorId: input.actorId,
			action:
				input.isActive === false && existing.isActive
					? 'DEFAULT_QUESTION_DEACTIVATED'
					: input.isActive === true && !existing.isActive
						? 'DEFAULT_QUESTION_REACTIVATED'
						: 'DEFAULT_QUESTION_UPDATED',
			entityType: 'ScreenerQuestionTemplate',
			entityId: updated.id,
			metadata: {
				key: updated.key,
				before: {
					prompt: existing.prompt,
					type: existing.type,
					order: existing.order,
					isActive: existing.isActive,
					configJson: existing.configJson,
				},
				after: {
					prompt: updated.prompt,
					type: updated.type,
					order: updated.order,
					isActive: updated.isActive,
					configJson: updated.configJson,
				},
			},
		});
		return updated;
	});
}
