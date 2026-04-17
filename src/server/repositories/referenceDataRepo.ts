import type { Prisma } from '@/prisma/generated/client';
import {
	CATALOG_VERSION,
	PLATFORM_ORG_NAME,
	PLATFORM_ORG_SLUG,
	SKILL_CATALOG,
} from '@/server/domain/reference-data';
import { DEFAULT_SCREENER_QUESTIONS } from '@/server/domain/volunteer-screening';
import { prisma } from '@/server/repositories/prisma';

const META_KEY = 'catalog_version';

/** Check whether the skill catalog has been seeded and is up-to-date. */
export async function isCatalogSeeded(): Promise<boolean> {
	const [familyCount, meta] = await Promise.all([
		prisma.skillFamily.count(),
		prisma.referenceDataMeta.findUnique({ where: { key: META_KEY } }),
	]);

	if (familyCount === 0) return false;
	if (!meta) return false;

	const storedVersion = Number(meta.value);
	return storedVersion === CATALOG_VERSION;
}

/** Check whether the platform org exists. */
export async function isPlatformOrgSeeded(): Promise<boolean> {
	const org = await prisma.organization.findUnique({
		where: { slug: PLATFORM_ORG_SLUG },
		select: { id: true },
	});
	return org !== null;
}

/** Check whether the platform org has any template questions seeded. */
export async function areTemplateQuestionsSeeded(): Promise<boolean> {
	const count = await prisma.screenerQuestion.count({
		where: { isTemplate: true },
	});
	return count > 0;
}

/**
 * Seed the skill catalog in a single transaction. Create-only semantics: new
 * families/skills from SKILL_CATALOG are added if missing, but existing rows
 * are never overwritten. This means admin edits via the catalog editor are
 * preserved across version bumps.
 */
export async function seedCatalog(): Promise<{
	families: number;
	skills: number;
}> {
	let familyCount = 0;
	let skillCount = 0;

	await prisma.$transaction(async (tx) => {
		for (const familyDef of SKILL_CATALOG) {
			const existing = await tx.skillFamily.findUnique({
				where: { slug: familyDef.slug },
				select: { id: true },
			});
			let familyId = existing?.id;
			if (!familyId) {
				const created = await tx.skillFamily.create({
					data: { name: familyDef.name, slug: familyDef.slug },
					select: { id: true },
				});
				familyId = created.id;
			}
			familyCount++;

			for (const skillDef of familyDef.skills) {
				const existingSkill = await tx.skill.findUnique({
					where: { slug: skillDef.slug },
					select: { id: true },
				});
				if (!existingSkill) {
					await tx.skill.create({
						data: {
							name: skillDef.name,
							slug: skillDef.slug,
							familyId,
						},
					});
				}
				skillCount++;
			}
		}

		await tx.referenceDataMeta.upsert({
			where: { key: META_KEY },
			update: { value: String(CATALOG_VERSION) },
			create: { key: META_KEY, value: String(CATALOG_VERSION) },
		});
	});

	return { families: familyCount, skills: skillCount };
}

/** Seed the platform org if it doesn't exist. Idempotent. */
export async function seedPlatformOrg(): Promise<void> {
	await prisma.organization.upsert({
		where: { slug: PLATFORM_ORG_SLUG },
		update: {},
		create: { name: PLATFORM_ORG_NAME, slug: PLATFORM_ORG_SLUG },
	});
}

/**
 * Seed DEFAULT_SCREENER_QUESTIONS into the platform org as template rows
 * (isTemplate=true). Create-only: existing template rows (matched by key)
 * are never overwritten — admin edits via the catalog editor are preserved.
 */
export async function seedPlatformTemplateQuestions(): Promise<{
	created: number;
}> {
	const platformOrg = await prisma.organization.findUnique({
		where: { slug: PLATFORM_ORG_SLUG },
		select: { id: true },
	});
	if (!platformOrg) {
		throw new Error(
			'Platform org must be seeded before template questions can be seeded.',
		);
	}

	let created = 0;
	await prisma.$transaction(async (tx) => {
		for (const q of DEFAULT_SCREENER_QUESTIONS) {
			const existing = await tx.screenerQuestion.findFirst({
				where: { isTemplate: true, key: q.key },
				select: { id: true },
			});
			if (existing) continue;

			await tx.screenerQuestion.create({
				data: {
					orgId: platformOrg.id,
					key: q.key,
					prompt: q.prompt,
					type: q.type,
					order: q.order,
					isActive: true,
					isTemplate: true,
					configJson: q.configJson as Prisma.InputJsonValue,
				},
			});
			created++;
		}
	});

	return { created };
}
